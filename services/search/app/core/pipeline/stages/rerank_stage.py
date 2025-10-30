"""Stage that reorders profiles using an external rerank service."""
from __future__ import annotations

from typing import Dict, List, Optional

from app.core.models.domain import CreatorProfile
from app.core.pipeline.base import Stage, StageResult, StageName, ProgressCallback
from app.core.pipeline.utils import build_profile_refs
from app.models.search import StageIO
from app.services.rerank_client import RerankClient, RerankError


def _normalize_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _doc_for(profile: CreatorProfile, mode: str) -> str:
    bio = _normalize_text(profile.biography)
    profile_text = _normalize_text(profile.profile_fts_source) or bio
    posts_source = profile.posts_fts_source or profile.posts_raw
    posts_text = _normalize_text(posts_source)

    if mode == "bio":
        return bio or profile_text or profile.profile_name or profile.account
    if mode == "posts":
        return posts_text or bio or profile_text or profile.profile_name or profile.account

    combined = " ".join(filter(None, (bio, posts_text)))
    return combined or profile_text or profile.profile_name or profile.account


class RerankStage(Stage):
    name = StageName.RERANK

    def __init__(self, client: RerankClient) -> None:
        self._client = client

    def run(
        self,
        profiles: List[CreatorProfile],
        *,
        progress_cb: ProgressCallback = None,
        query: str,
        mode: str,
        top_k: int,
    ) -> StageResult:
        if not profiles:
            if progress_cb:
                progress_cb(
                    f"{self.name}_SKIPPED",
                    {"reason": "no_profiles", "io": StageIO(inputs=[], outputs=[]).model_dump()},
                )
            return StageResult(profiles=[], io=StageIO(inputs=[], outputs=[]))

        k = max(1, min(top_k, len(profiles)))
        inputs_subset = profiles[:k]
        io_inputs = build_profile_refs(inputs_subset)

        if progress_cb:
            progress_cb(
                f"{self.name}_STARTED",
                {
                    "count": len(inputs_subset),
                    "top_k": k,
                    "mode": mode,
                    "io": StageIO(inputs=io_inputs, outputs=[]).model_dump(),
                },
            )

        docs = [_doc_for(profile, mode) for profile in inputs_subset]
        try:
            ranking = self._client.rerank(query, docs, k)
        except RerankError as exc:
            if progress_cb:
                progress_cb(
                    f"{self.name}_FAILED",
                    {
                        "error": str(exc),
                        "io": StageIO(inputs=io_inputs, outputs=[]).model_dump(),
                    },
                )
            return StageResult(profiles=profiles, io=StageIO(inputs=io_inputs, outputs=[]))

        ordered: List[CreatorProfile] = []
        seen_indices = set()
        for idx, score in ranking:
            if idx in seen_indices or not (0 <= idx < len(inputs_subset)):
                continue
            seen_indices.add(idx)
            candidate = inputs_subset[idx]
            candidate.rerank_score = float(score)
            ordered.append(candidate)

        if ordered:
            seen_ids = {id(item) for item in ordered}
            remainder = [item for item in profiles if id(item) not in seen_ids]
            reordered = ordered + remainder
        else:
            reordered = profiles

        outputs = build_profile_refs(ordered) if ordered else []
        if progress_cb:
            progress_cb(
                f"{self.name}_COMPLETED",
                {
                    "top_k": k,
                    "reranked": len(ordered),
                    "io": StageIO(inputs=io_inputs, outputs=outputs).model_dump(),
                },
            )

        return StageResult(profiles=reordered, io=StageIO(inputs=io_inputs, outputs=outputs))
