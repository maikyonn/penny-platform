"""Stage responsible for running the initial creator search."""
from __future__ import annotations

from typing import List, Optional, Dict, Any

from typing import TYPE_CHECKING

from app.core.models.domain import CreatorProfile
from app.core.pipeline.base import Stage, StageResult, StageName, ProgressCallback
from app.core.pipeline.utils import build_profile_refs
from app.models.search import StageIO

if TYPE_CHECKING:
    from app.core.search_engine import CreatorSearchEngine


class SearchStage(Stage):
    name = StageName.SEARCH

    def __init__(self, engine: "CreatorSearchEngine") -> None:
        self._engine = engine

    def run(
        self,
        profiles: List[CreatorProfile],
        *,
        progress_cb: ProgressCallback = None,
        query: str,
        method: str = "hybrid",
        limit: int = 20,
        min_followers: Optional[int] = None,
        max_followers: Optional[int] = None,
        min_engagement: Optional[float] = None,
        max_engagement: Optional[float] = None,
        location: Optional[str] = None,
        category: Optional[str] = None,
        is_verified: Optional[bool] = None,
        is_business_account: Optional[bool] = None,
        lexical_scope: str = "bio",
    ) -> StageResult:
        del profiles  # Search stage ignores incoming profiles

        if progress_cb:
            progress_cb(
                f"{self.name}_STARTED",
                {
                    "query": query,
                    "method": method,
                    "limit": limit,
                    "io": StageIO(inputs=[], outputs=[]).model_dump(),
                },
            )

        results = self._engine.search_creators_for_campaign(
            query=query,
            method=method,
            limit=limit,
            min_followers=min_followers,
            max_followers=max_followers,
            min_engagement=min_engagement,
            max_engagement=max_engagement,
            location=location,
            category=category,
            is_verified=is_verified,
            is_business_account=is_business_account,
            lexical_scope=lexical_scope,
        )

        io_payload = StageIO(inputs=[], outputs=build_profile_refs(results))
        if progress_cb:
            progress_cb(
                f"{self.name}_COMPLETED",
                {
                    "count": len(results),
                    "io": io_payload.model_dump(),
                },
            )

        return StageResult(
            profiles=results,
            io=io_payload,
            debug={"count": len(results)},
        )
