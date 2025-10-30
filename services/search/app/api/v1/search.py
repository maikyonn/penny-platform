"""Simplified Search API endpoints."""
import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_search_engine
from app.queues import get_queue
from app.api.serializers import serialize_creator_profile
from app.models.search import (
    SearchRequest,
    SimilarSearchRequest,
    CategorySearchRequest,
    PipelineEnrichRequest,
    UsernameSearchResponse,
    SearchPipelineRequest,
    BrightDataStageRequest,
    ProfileFitStageRequest,
    JobEnqueueResponse,
)

router = APIRouter()

logger = logging.getLogger("search_api")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[SearchAPI] %(asctime)s %(levelname)s: %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


def _enqueue_job(queue_name: str, func_path: str, payload: Dict[str, Any]) -> JobEnqueueResponse:
    queue = get_queue(queue_name)
    job = queue.enqueue(func_path, payload)
    return JobEnqueueResponse(job_id=job.id, queue=queue.name)


@router.get("/username/{username}", response_model=UsernameSearchResponse)
async def get_creator_by_username(username: str, search_engine=Depends(get_search_engine)):
    sanitized = username.strip()
    if not sanitized:
        raise HTTPException(status_code=400, detail="Username is required")

    try:
        result = search_engine.get_creator_by_username(sanitized)
        if not result:
            raise HTTPException(status_code=404, detail=f"Creator '@{sanitized}' not found")
        return {"success": True, "result": serialize_creator_profile(result)}
    except HTTPException:
        raise
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Username lookup failed: %s", exc)
        raise HTTPException(status_code=500, detail="Username lookup failed") from exc


@router.post("/", response_model=JobEnqueueResponse)
async def search_creators(request: SearchRequest):
    logger.info(
        "Enqueue search | method=%s limit=%s query=%s",
        request.method,
        request.limit,
        request.query,
    )
    return _enqueue_job("search", "app.workers.rq_jobs.run_search_job", request.model_dump())


@router.post("/similar", response_model=JobEnqueueResponse)
async def similar_creators(request: SimilarSearchRequest):
    logger.info("Enqueue similar search | account=%s limit=%s", request.account, request.limit)
    return _enqueue_job("search", "app.workers.rq_jobs.run_similar_job", request.model_dump())


@router.post("/category", response_model=JobEnqueueResponse)
async def category_search(request: CategorySearchRequest):
    logger.info(
        "Enqueue category search | category=%s location=%s limit=%s",
        request.category,
        request.location,
        request.limit,
    )
    return _enqueue_job("search", "app.workers.rq_jobs.run_category_job", request.model_dump())


@router.post("/pipeline", response_model=JobEnqueueResponse)
async def search_pipeline(request: SearchPipelineRequest):
    logger.info(
        "Enqueue pipeline | method=%s limit=%s brightdata=%s llm=%s",
        request.search.method,
        request.search.limit,
        request.run_brightdata,
        request.run_llm,
    )
    return _enqueue_job("pipeline", "app.workers.rq_jobs.run_pipeline_job", request.model_dump())




@router.post("/pipeline/enrich", response_model=JobEnqueueResponse)
async def pipeline_enrich_profiles(request: PipelineEnrichRequest):
    logger.info(
        "Enqueue pipeline enrichment | brightdata=%s llm=%s count=%s",
        request.run_brightdata,
        request.run_llm,
        len(request.profiles),
    )
    return _enqueue_job("pipeline", "app.workers.rq_jobs.run_pipeline_enrich_job", request.model_dump())


@router.post("/pipeline/brightdata", response_model=JobEnqueueResponse)
async def pipeline_brightdata_stage(request: BrightDataStageRequest):
    profile_count = len(request.profiles)
    logger.info("Enqueue BrightData stage | normalized_profiles=%s", profile_count)
    return _enqueue_job("pipeline", "app.workers.rq_jobs.run_brightdata_stage_job", request.model_dump())


@router.post("/pipeline/llm", response_model=JobEnqueueResponse)
async def pipeline_llm_stage(request: ProfileFitStageRequest):
    logger.info(
        "Enqueue LLM stage | count=%s model=%s use_brightdata=%s",
        len(request.profiles),
        request.model,
        request.use_brightdata,
    )
    return _enqueue_job("pipeline", "app.workers.rq_jobs.run_profile_fit_stage_job", request.model_dump())
