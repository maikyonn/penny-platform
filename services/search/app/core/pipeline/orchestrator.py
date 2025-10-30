"""Pipeline orchestrator that wires stages together to mirror the runtime flow."""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple, TYPE_CHECKING

from app.core.models.domain import CreatorProfile
from app.core.pipeline.base import ProgressCallback, StageResult
from app.core.pipeline.stages import (
    BrightDataStage,
    LLMFitStage,
    RerankStage,
    SearchStage,
)
from app.core.pipeline.utils import build_profile_refs, normalized_profile_key
from app.core.post_filter import BrightDataServiceClient, ProfileFitAssessor
from app.models.search import SearchPipelineRequest, StageIO
from app.services.rerank_client import RerankClient

if TYPE_CHECKING:
    from app.core.search_engine import CreatorSearchEngine


class CreatorDiscoveryPipeline:
    """High-level orchestrator for the creator discovery pipeline."""

    def __init__(
        self,
        *,
        search_engine: "CreatorSearchEngine",
        rerank_client: Optional[RerankClient] = None,
        brightdata_client: Optional[BrightDataServiceClient] = None,
        assessor_factory=ProfileFitAssessor,
    ) -> None:
        self._search = SearchStage(search_engine)
        self._rerank = RerankStage(rerank_client) if rerank_client else None
        self._brightdata = BrightDataStage(brightdata_client)
        self._llm = LLMFitStage(assessor_factory)

    def run(
        self,
        request: SearchPipelineRequest,
        *,
        progress_cb: ProgressCallback = None,
    ) -> Tuple[List[CreatorProfile], Dict[str, List[Dict[str, object]]]]:
        search_req = request.search
        search_result = self._search.run(
            [],
            progress_cb=progress_cb,
            query=search_req.query,
            method=search_req.method,
            limit=search_req.limit,
            min_followers=search_req.min_followers,
            max_followers=search_req.max_followers,
            min_engagement=search_req.min_engagement,
            max_engagement=search_req.max_engagement,
            location=search_req.location,
            category=search_req.category,
            is_verified=search_req.is_verified,
            is_business_account=search_req.is_business_account,
            lexical_scope=search_req.lexical_scope,
        )
        profiles = list(search_result.profiles)

        if request.max_profiles is not None and profiles:
            limit = max(1, min(request.max_profiles, len(profiles)))
            profiles = profiles[:limit]

        debug: Dict[str, List[Dict[str, object]]] = {
            "brightdata_results": [],
            "profile_fit": [],
        }

        if request.run_rerank and self._rerank:
            rerank_top_k = max(
                1,
                min(request.rerank_top_k, len(profiles)),
            )
            rerank_result = self._rerank.run(
                profiles,
                progress_cb=progress_cb,
                query=search_req.query,
                mode=request.rerank_mode,
                top_k=rerank_top_k,
            )
            profiles = rerank_result.profiles

        success_keys: List[str] = []
        if request.run_brightdata:
            brightdata_result = self._brightdata.run(profiles, progress_cb=progress_cb)
            profiles = brightdata_result.profiles
            debug["brightdata_results"] = brightdata_result.debug.get("brightdata_results", [])
            success_keys = brightdata_result.debug.get("success_keys", []) or []

        if request.run_llm:
            if not request.business_fit_query:
                raise ValueError("business_fit_query is required when run_llm is True")

            llm_inputs = list(profiles)
            if request.run_brightdata:
                key_set = {key.lower() for key in success_keys}
                if key_set:
                    survivors = [
                        profile
                        for profile in profiles
                        if normalized_profile_key(profile) in key_set
                    ]
                else:
                    survivors = []

                if progress_cb:
                    progress_cb(
                        "BRIGHTDATA_FILTERED",
                        {
                            "survivors": len(survivors),
                            "dropped": max(0, len(profiles) - len(survivors)),
                            "io": StageIO(
                                inputs=build_profile_refs(profiles),
                                outputs=build_profile_refs(survivors),
                            ).model_dump(),
                        },
                    )

                llm_inputs = survivors
                profiles = survivors

            if not llm_inputs:
                debug["profile_fit"] = []
                return llm_inputs, debug

            llm_result = self._llm.run(
                llm_inputs,
                progress_cb=progress_cb,
                business_fit_query=request.business_fit_query or "",
                max_posts=request.max_posts,
                concurrency=request.concurrency,
                model=request.model,
                verbosity=request.verbosity,
            )
            profiles = llm_result.profiles
            debug["profile_fit"] = llm_result.debug.get("profile_fit", [])

        return profiles, debug
