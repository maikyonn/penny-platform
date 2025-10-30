"""Service wrapper that delegates to the structured pipeline orchestrator."""

from __future__ import annotations

from typing import Callable, Dict, List, Optional, Tuple

from app.config import settings
from app.core.models.domain import CreatorProfile
from app.core.pipeline.orchestrator import CreatorDiscoveryPipeline
from app.core.search_engine import CreatorSearchEngine
from app.models.search import SearchPipelineRequest
from app.services.rerank_client import RerankClient, RerankError

ProgressCallback = Optional[Callable[[str, Dict[str, object]], None]]


def _build_rerank_client() -> Tuple[Optional[RerankClient], Optional[str]]:
    if not settings.RERANKER_ENABLED:
        return None, "disabled_in_settings"
    try:
        return RerankClient(), None
    except RerankError:
        return None, "module_unavailable"


class SearchPipelineService:
    """Thin facade that maintains existing service API while using new pipeline."""

    def __init__(self, search_engine: CreatorSearchEngine) -> None:
        self._engine = search_engine
        self._rerank_client, self._rerank_skip_reason = _build_rerank_client()
        self._rerank_available = self._rerank_client is not None
        self._pipeline = CreatorDiscoveryPipeline(
            search_engine=self._engine,
            rerank_client=self._rerank_client,
        )

    def run_pipeline(
        self,
        request: SearchPipelineRequest,
        *,
        progress_cb: ProgressCallback = None,
    ) -> Tuple[List[CreatorProfile], Dict[str, object]]:
        callback = progress_cb

        # Emit compatibility events if rerank was requested but unavailable
        if request.run_rerank and not self._rerank_available and progress_cb:
            reason = self._rerank_skip_reason or "unavailable"
            callback("RERANK_SKIPPED", {"reason": reason})

        results, debug = self._pipeline.run(request, progress_cb=callback)
        return results, debug


__all__ = ["SearchPipelineService"]
