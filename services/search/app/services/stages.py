"""Utilities for consistent pipeline/evaluation stage naming."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List

from app.core.pipeline.utils import build_profile_refs as _build_profile_refs

_STAGE_REMAP: Dict[str, str] = {
    "search_started": "SEARCH_STARTED",
    "search_completed": "SEARCH_COMPLETED",
    "retrieve_started": "SEARCH_STARTED",
    "retrieve_completed": "SEARCH_COMPLETED",
    "lancedb_search_started": "SEARCH_STARTED",
    "lancedb_search_completed": "SEARCH_COMPLETED",
    "rerank_started": "RERANK_STARTED",
    "rerank_completed": "RERANK_COMPLETED",
    "rerank_failed": "RERANK_FAILED",
    "rerank_skipped": "RERANK_SKIPPED",
    "score_started": "LLM_FIT_STARTED",
    "score_progress": "LLM_FIT_PROGRESS",
    "score_completed": "LLM_FIT_COMPLETED",
    "evaluation_started": "LLM_FIT_STARTED",
    "evaluation_progress": "LLM_FIT_PROGRESS",
    "fit_progress": "LLM_FIT_PROGRESS",
    "fit_completed": "LLM_FIT_COMPLETED",
    "brightdata_started": "BRIGHTDATA_STARTED",
    "brightdata_completed": "BRIGHTDATA_COMPLETED",
    "brightdata_profile_started": "BRIGHTDATA_PROFILE_STARTED",
    "brightdata_profile_completed": "BRIGHTDATA_PROFILE_COMPLETED",
    "brightdata_profile_failed": "BRIGHTDATA_PROFILE_FAILED",
    "enrich_brightdata_started": "BRIGHTDATA_STARTED",
    "enrich_brightdata_completed": "BRIGHTDATA_COMPLETED",
    "enrich_brightdata_profile_started": "BRIGHTDATA_PROFILE_STARTED",
    "enrich_brightdata_profile_completed": "BRIGHTDATA_PROFILE_COMPLETED",
    "enrich_brightdata_profile_failed": "BRIGHTDATA_PROFILE_FAILED",
    "enrich_brightdata_filtered": "BRIGHTDATA_FILTERED",
    "brightdata_profile_skipped": "BRIGHTDATA_PROFILE_FAILED",
}


def normalize_stage_name(stage: str) -> str:
    """Map legacy stage identifiers onto the new canonical names."""
    if not stage:
        return stage
    if stage.isupper():
        return stage
    return _STAGE_REMAP.get(stage, stage)


def build_profile_refs(items: Iterable[Any]) -> List[Dict[str, Any]]:
    """Return compact profile reference dictionaries for IO tracing."""
    return _build_profile_refs(items)
