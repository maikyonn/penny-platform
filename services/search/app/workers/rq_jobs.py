"""RQ job callables used by FastAPI enqueue endpoints."""
from __future__ import annotations

import os
from typing import Any, Dict, List
from rq import get_current_job

from app.api.serializers import serialize_creator_profile, serialize_stage_payload
from app.config import settings
from app.core.search_engine import FastAPISearchEngine
from app.core.models.domain import CreatorProfile
from app.dependencies import get_search_engine, init_search_engine
from app.models.search import (
    BrightDataStageRequest,
    CategorySearchRequest,
    PipelineEnrichRequest,
    ProfileFitStageRequest,
    SearchPipelineRequest,
    SearchRequest,
    SimilarSearchRequest,
)
from app.services.pipeline import SearchPipelineService
from app.services.stages import normalize_stage_name
from app.workers.progress import ProgressEmitter

_ENGINE: FastAPISearchEngine | None = None
_ENGINE_PID: int | None = None


def _log_env_state() -> None:
    """Log key environment values so worker visibility issues are obvious."""
    db_path = settings.DB_PATH
    db_exists = os.path.exists(db_path) if db_path else False
    redis_url = settings.REDIS_URL
    _log(
        f"[env] pid={os.getpid()} DB_PATH={db_path!r} exists={db_exists} REDIS_URL={redis_url!r}"
    )


def _engine() -> FastAPISearchEngine:
    """Initialize the search engine per worker process (post-fork safe)."""
    global _ENGINE, _ENGINE_PID
    current_pid = os.getpid()
    if _ENGINE is None or _ENGINE_PID != current_pid:
        if not init_search_engine():
            raise RuntimeError("Search engine failed to initialize inside worker process")
        _ENGINE = get_search_engine()
        _ENGINE_PID = current_pid
        _log(f"[engine] Initialized LanceDB handle in PID {current_pid}")
    return _ENGINE


def _log(message: str) -> None:
    print(f"[RQ Worker] {message}", flush=True)


def _serialize_results(results: List[CreatorProfile]) -> List[Dict[str, Any]]:
    return [serialize_creator_profile(result) for result in results]


def _make_emitter(job) -> ProgressEmitter:
    return ProgressEmitter(job.connection, settings.RQ_EVENTS_CHANNEL_PREFIX)  # type: ignore[arg-type]


def _emit(emitter: ProgressEmitter, stage: str, data: Dict[str, Any]) -> None:
    emitter.emit(normalize_stage_name(stage), serialize_stage_payload(data))


def run_search_job(search_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Run a single search request fully off the API thread."""
    job = get_current_job()
    emitter = _make_emitter(job) if job else None
    _log(f"[search] Starting search job: query={search_payload.get('query')} limit={search_payload.get('limit')}")
    _log_env_state()
    engine = _engine()
    req = SearchRequest(**search_payload)
    results = engine.search_creators_for_campaign(
        query=req.query,
        method=req.method,
        limit=req.limit,
        min_followers=req.min_followers,
        max_followers=req.max_followers,
        min_engagement=req.min_engagement,
        max_engagement=req.max_engagement,
        location=req.location,
        category=req.category,
        is_verified=req.is_verified,
        is_business_account=req.is_business_account,
        lexical_scope=req.lexical_scope,
    )
    payload = _serialize_results(results)
    response = {
        "success": True,
        "results": payload,
        "count": len(payload),
        "query": req.query,
        "method": req.method,
    }
    _log(f"[search] Completed search job: {response['count']} results for '{req.query}'")
    if emitter:
        emitter.emit("completed", serialize_stage_payload(response))
    return response


def run_similar_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    job = get_current_job()
    emitter = _make_emitter(job) if job else None
    _log(f"[search] Starting similar search job: account={payload.get('account')} limit={payload.get('limit')}")
    engine = _engine()
    req = SimilarSearchRequest(**payload)
    results = engine.find_similar_creators(
        reference_account=req.account,
        limit=req.limit,
        min_followers=req.min_followers,
        max_followers=req.max_followers,
        min_engagement=req.min_engagement,
        max_engagement=req.max_engagement,
        location=req.location,
        category=req.category,
    )
    serialized = _serialize_results(results)
    response = {
        "success": True,
        "results": serialized,
        "count": len(serialized),
        "query": req.account,
        "method": "similar",
    }
    _log(f"[search] Completed similar search job for @{req.account}: {response['count']} results")
    if emitter:
        emitter.emit("completed", serialize_stage_payload(response))
    return response


def run_category_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    job = get_current_job()
    emitter = _make_emitter(job) if job else None
    _log(f"[search] Starting category search job: category={payload.get('category')} location={payload.get('location')}")
    engine = _engine()
    req = CategorySearchRequest(**payload)
    results = engine.search_by_category(
        category=req.category,
        location=req.location,
        limit=req.limit,
        min_followers=req.min_followers,
        max_followers=req.max_followers,
        min_engagement=req.min_engagement,
        max_engagement=req.max_engagement,
    )
    serialized = _serialize_results(results)
    response = {
        "success": True,
        "results": serialized,
        "count": len(serialized),
        "query": req.category,
        "method": "category",
    }
    _log(f"[search] Completed category search job for '{req.category}': {response['count']} results")
    if emitter:
        emitter.emit("completed", serialize_stage_payload(response))
    return response


def run_pipeline_job(pipeline_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Run the staged pipeline with progress events stored in job.meta."""
    job = get_current_job()
    if job is None:
        raise RuntimeError("run_pipeline_job must be invoked inside an RQ job")

    _log(f"[pipeline] Starting pipeline job {job.id} (query={pipeline_payload.get('search', {}).get('query')})")
    engine = _engine()
    emitter = _make_emitter(job)
    pipeline = SearchPipelineService(engine)
    req = SearchPipelineRequest(**pipeline_payload)

    results, debug = pipeline.run_pipeline(
        req,
        progress_cb=lambda stage, data: _emit(emitter, stage, data),
    )
    payload = _serialize_results(results)
    completed = {
        "results": payload,
        "brightdata_results": debug.get("brightdata_results", []),
        "profile_fit": debug.get("profile_fit", []),
        "count": len(payload),
    }
    emitter.emit("completed", completed)
    _log(f"[pipeline] Completed pipeline job {job.id}: {completed['count']} final results")
    return {"success": True, **completed}


def run_pipeline_enrich_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    job = get_current_job()
    if job is None:
        raise RuntimeError("run_pipeline_enrich_job must be invoked via RQ")

    _log(f"[pipeline] Starting enrichment job {job.id}: profiles={len(payload.get('profiles') or [])}")
    engine = _engine()
    req = PipelineEnrichRequest(**payload)
    emitter = _make_emitter(job)

    results, debug = engine.evaluate_profiles(
        req.profiles,
        business_fit_query=req.business_fit_query,
        run_brightdata=req.run_brightdata,
        run_llm=req.run_llm,
        max_profiles=req.max_profiles,
        max_posts=req.max_posts,
        model=req.model,
        verbosity=req.verbosity,
        concurrency=req.concurrency,
        progress_cb=lambda stage, data: _emit(emitter, stage, data),
    )
    serialized = _serialize_results(results)
    completed = {
        "results": serialized,
        "brightdata_results": debug.get("brightdata_results", []),
        "profile_fit": debug.get("profile_fit", []),
        "count": len(serialized),
    }
    emitter.emit("completed", completed)
    _log(f"[pipeline] Completed enrichment job {job.id}: {completed['count']} profiles scored")
    return {"success": True, **completed}


def run_brightdata_stage_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    job = get_current_job()
    if job is None:
        raise RuntimeError("run_brightdata_stage_job must be invoked via RQ")
    _log(f"[pipeline] Starting BrightData stage job {job.id}")
    engine = _engine()
    req = BrightDataStageRequest(**payload)
    emitter = _make_emitter(job)
    results, debug = engine.run_brightdata_stage(
        req.profiles,
        max_profiles=req.max_profiles,
        progress_cb=lambda stage, data: _emit(emitter, stage, data),
    )
    serialized = _serialize_results(results)
    completed = {
        "results": serialized,
        "brightdata_results": debug.get("brightdata_results", []),
        "count": len(serialized),
    }
    emitter.emit("completed", completed)
    _log(f"[pipeline] Completed BrightData stage job {job.id}: refreshed={len(debug.get('brightdata_results', []))}")
    return {"success": True, **completed}


def run_profile_fit_stage_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    job = get_current_job()
    if job is None:
        raise RuntimeError("run_profile_fit_stage_job must be invoked via RQ")
    _log(f"[pipeline] Starting LLM stage job {job.id}: profiles={len(payload.get('profiles') or [])}")
    engine = _engine()
    req = ProfileFitStageRequest(**payload)
    emitter = _make_emitter(job)

    openai_key = settings.OPENAI_API_KEY.get_secret_value() if settings.OPENAI_API_KEY else None
    if not openai_key:
        raise RuntimeError("OPENAI_API_KEY must be configured to run the profile fit stage")
    results, debug = engine.run_profile_fit_stage(
        req.profiles,
        business_fit_query=req.business_fit_query,
        max_profiles=req.max_profiles,
        concurrency=req.concurrency,
        max_posts=req.max_posts,
        model=req.model,
        verbosity=req.verbosity,
        use_brightdata=req.use_brightdata,
        progress_cb=lambda stage, data: _emit(emitter, stage, data),
    )
    serialized = _serialize_results(results)
    completed = {
        "results": serialized,
        "brightdata_results": debug.get("brightdata_results", []),
        "profile_fit": debug.get("profile_fit", []),
        "count": len(serialized),
    }
    emitter.emit("completed", completed)
    _log(f"[pipeline] Completed LLM stage job {job.id}: scored={completed['count']}")
    return {"success": True, **completed}

__all__ = [
    "run_search_job",
    "run_similar_job",
    "run_category_job",
    "run_pipeline_job",
    "run_pipeline_enrich_job",
    "run_brightdata_stage_job",
    "run_profile_fit_stage_job",
]
