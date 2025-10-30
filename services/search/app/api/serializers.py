"""Shared serializers for API responses."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Sequence

from app.core.models.domain import CreatorProfile
from app.models.search import ProfileRef


def _format_number(value: int) -> str:
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"{value / 1_000:.1f}K"
    return str(int(value))


def _format_engagement(rate: float) -> float:
    return rate * 100 if rate is not None else 0.0


def _parse_posts(raw_posts: Any) -> List[Any]:
    if not raw_posts:
        return []
    if isinstance(raw_posts, list):
        return raw_posts[:3]
    if isinstance(raw_posts, dict):
        return [raw_posts]
    return []


def serialize_creator_profile(profile: CreatorProfile) -> Dict[str, Any]:
    """Convert a `CreatorProfile` domain object into an API-friendly payload."""
    platform = profile.platform.lower() if isinstance(profile.platform, str) else None

    profile_image = (
        profile.profile_image_link
        or profile.profile_image_url
        or ""
    )

    account_value = profile.account
    profile_url = profile.profile_url or ""
    if not profile_url and account_value:
        if platform == "tiktok":
            profile_url = f"https://www.tiktok.com/@{account_value}"
        else:
            profile_url = f"https://instagram.com/{account_value}"

    return {
        "id": profile.id,
        "lance_db_id": profile.lance_db_id,
        "account": account_value,
        "username": profile.username or account_value,
        "display_name": profile.display_name or profile.profile_name,
        "profile_name": profile.profile_name,
        "platform": platform,
        "platform_id": profile.platform_id,
        "followers": profile.followers,
        "followers_formatted": _format_number(profile.followers),
        "avg_engagement": _format_engagement(profile.avg_engagement),
        "avg_engagement_raw": profile.avg_engagement,
        "business_category_name": profile.business_category_name,
        "business_address": profile.business_address,
        "biography": profile.biography,
        "profile_image_link": profile_image,
        "profile_image_url": profile_image,
        "profile_url": profile_url,
        "business_email": profile.business_email or "",
        "email_address": profile.email_address or "",
        "posts": _parse_posts(profile.posts_raw),
        "is_personal_creator": profile.is_personal_creator,
        "individual_vs_org_score": profile.individual_vs_org_score,
        "generational_appeal_score": profile.generational_appeal_score,
        "professionalization_score": profile.professionalization_score,
        "relationship_status_score": profile.relationship_status_score,
        "bm25_fts_score": profile.bm25_fts_score,
        "cos_sim_profile": profile.cos_sim_profile,
        "cos_sim_posts": profile.cos_sim_posts,
        "combined_score": profile.combined_score,
        "keyword_similarity": profile.keyword_similarity,
        "profile_similarity": profile.profile_similarity,
        "content_similarity": profile.content_similarity,
        "vector_similarity_score": profile.vector_similarity_score,
        "profile_fts_source": profile.profile_fts_source,
        "posts_fts_source": profile.posts_fts_source,
        "score_mode": profile.score_mode,
        "similarity_explanation": profile.similarity_explanation,
        "fit_score": profile.fit_score,
        "fit_rationale": profile.fit_rationale,
        "fit_error": profile.fit_error,
        "fit_prompt": profile.fit_prompt,
        "fit_raw_response": profile.fit_raw_response,
        "rerank_score": profile.rerank_score,
    }


def serialize_stage_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    """Serialize stage payloads, ensuring creators are converted via serializer."""
    if not data:
        return {}

    serialized: Dict[str, Any] = {}
    for key, value in data.items():
        if key == "results" and isinstance(value, Sequence):
            serialized[key] = [
                serialize_creator_profile(item)
                if isinstance(item, CreatorProfile)
                else item
                for item in value
            ]
        else:
            serialized[key] = value
    return serialized


