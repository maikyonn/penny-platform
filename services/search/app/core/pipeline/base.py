"""Shared abstractions for the creator discovery pipeline stages."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Protocol, Any

from app.core.models.domain import CreatorProfile
from app.models.search import StageIO


class StageName:
    SEARCH = "SEARCH"
    RERANK = "RERANK"
    BRIGHTDATA = "BRIGHTDATA"
    LLM_FIT = "LLM_FIT"


ProgressCallback = Optional[Callable[[str, Dict[str, Any]], None]]


@dataclass
class StageResult:
    profiles: List[CreatorProfile]
    io: StageIO
    debug: Dict[str, Any] = field(default_factory=dict)


class Stage(Protocol):
    name: str

    def run(
        self,
        profiles: List[CreatorProfile],
        *,
        progress_cb: ProgressCallback = None,
        **kwargs: Any,
    ) -> StageResult:
        ...
