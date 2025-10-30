"""Stage that scores creators against a business brief using the LLM assessor."""
from __future__ import annotations

from typing import Callable, Dict, List, Optional

from app.core.models.domain import CreatorProfile
from app.core.pipeline.base import Stage, StageResult, StageName, ProgressCallback
from app.core.pipeline.utils import build_profile_refs
from app.core.post_filter import ProfileFitAssessor, ProfileFitResult, build_profile_documents
from app.models.search import StageIO


AssessorFactory = Callable[..., ProfileFitAssessor]


class LLMFitStage(Stage):
    name = StageName.LLM_FIT

    def __init__(self, assessor_factory: AssessorFactory) -> None:
        self._assessor_factory = assessor_factory

    def run(
        self,
        profiles: List[CreatorProfile],
        *,
        progress_cb: ProgressCallback = None,
        business_fit_query: str,
        max_posts: int,
        concurrency: int,
        model: str,
        verbosity: str,
    ) -> StageResult:
        if not business_fit_query:
            raise ValueError("business_fit_query is required for LLM fit stage")

        if not profiles:
            io_payload = StageIO(inputs=[], outputs=[])
            if progress_cb:
                progress_cb(
                    f"{self.name}_COMPLETED",
                    {"count": 0, "io": io_payload.model_dump()},
                )
            return StageResult(profiles=[], io=io_payload, debug={"profile_fit": []})

        io_payload = StageIO(inputs=build_profile_refs(profiles), outputs=[])
        if progress_cb:
            progress_cb(
                f"{self.name}_STARTED",
                {"count": len(profiles), "io": io_payload.model_dump()},
            )

        documents: List[Dict[str, object]] = []
        for profile in profiles:
            doc = {
                "account": profile.account,
                "profile_url": profile.profile_url or _best_profile_url(profile),
                "followers": profile.followers,
                "biography": profile.biography,
                "profile_name": profile.profile_name,
                "business_category_name": profile.business_category_name,
                "category_name": profile.business_category_name,
                "is_verified": profile.is_verified,
                "posts": profile.posts_raw,
            }
            documents.append(doc)

        assessor = self._assessor_factory(
            business_query=business_fit_query,
            model=model,
            verbosity=verbosity,
            max_posts=max_posts,
            concurrency=concurrency,
        )

        payloads = build_profile_documents(documents, max_posts=max_posts)
        debug_payload: List[Dict[str, object]] = []

        def _on_progress(completed: int, total: int, fit: ProfileFitResult) -> None:
            if progress_cb:
                progress_cb(
                    f"{self.name}_PROGRESS",
                    {"completed": completed, "total": total, "account": fit.account},
                )

        results = assessor.score_profiles(payloads, progress_cb=_on_progress)

        fit_map: Dict[str, ProfileFitResult] = {}
        for fit in results:
            key = _fit_key(fit)
            if key:
                fit_map[key] = fit

            debug_payload.append(
                {
                    "account": fit.account,
                    "profile_url": fit.profile_url,
                    "followers": fit.followers,
                    "score": fit.score,
                    "rationale": fit.rationale,
                    "error": fit.error,
                    "prompt": fit.prompt,
                    "raw_response": fit.raw_response,
                }
            )
        for profile in profiles:
            key = _normalized_profile_key(profile)
            fit = fit_map.get(key)
            if fit:
                profile.fit_score = fit.score
                profile.fit_rationale = fit.rationale
                profile.fit_error = fit.error
                profile.fit_prompt = fit.prompt
                profile.fit_raw_response = fit.raw_response
            else:
                profile.fit_score = None
                profile.fit_rationale = None
                profile.fit_error = None
                profile.fit_prompt = None
                profile.fit_raw_response = None

        scored = sorted(
            profiles,
            key=lambda profile: ((profile.fit_score or 0), profile.combined_score),
            reverse=True,
        )
        io_payload.outputs = build_profile_refs(scored)

        if progress_cb:
            progress_cb(
                f"{self.name}_COMPLETED",
                {
                    "count": len(scored),
                    "io": io_payload.model_dump(),
                },
            )

        return StageResult(
            profiles=scored,
            io=io_payload,
            debug={"profile_fit": debug_payload},
        )


def _fit_key(fit: ProfileFitResult) -> Optional[str]:
    if fit.account:
        return fit.account.strip().lower()
    if fit.profile_url:
        return fit.profile_url.strip().lower()
    return None


def _normalized_profile_key(profile: CreatorProfile) -> Optional[str]:
    if profile.account:
        return profile.account.strip().lower()
    if profile.profile_url:
        return profile.profile_url.strip().lower()
    if profile.username:
        return profile.username.strip().lower()
    return None


def _best_profile_url(profile: CreatorProfile) -> Optional[str]:
    url = profile.profile_url
    if url:
        return url
    handle = (profile.username or profile.account or "").strip().lstrip("@")
    if not handle:
        return None
    if (profile.platform or "").lower() == "tiktok":
        return f"https://www.tiktok.com/@{handle}"
    return f"https://instagram.com/{handle}"
