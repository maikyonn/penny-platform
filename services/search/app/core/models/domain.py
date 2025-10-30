"""Domain-level dataclasses shared across the creator discovery pipeline."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class CreatorProfile:
    """Internal representation of a creator profile returned from search."""

    id: int
    account: str
    profile_name: str
    followers: int
    avg_engagement: float
    business_category_name: str
    business_address: str
    biography: str
    profile_image_link: str = ""
    profile_url: Optional[str] = None
    is_personal_creator: bool = True
    is_verified: Optional[bool] = None
    posts_raw: Optional[str] = None
    lance_db_id: Optional[str] = None
    platform: Optional[str] = None
    platform_id: Optional[str] = None
    username: Optional[str] = None
    display_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    individual_vs_org_score: int = 0
    generational_appeal_score: int = 0
    professionalization_score: int = 0
    relationship_status_score: int = 0
    bm25_fts_score: Optional[float] = None
    cos_sim_profile: Optional[float] = None
    cos_sim_posts: Optional[float] = None
    combined_score: float = 0.0
    keyword_similarity: Optional[float] = None
    profile_similarity: Optional[float] = None
    content_similarity: Optional[float] = None
    vector_similarity_score: Optional[float] = None
    similarity_explanation: str = ""
    score_mode: str = "hybrid"
    profile_fts_source: Optional[str] = None
    posts_fts_source: Optional[str] = None
    fit_score: Optional[int] = None
    fit_rationale: Optional[str] = None
    fit_error: Optional[str] = None
    fit_prompt: Optional[str] = None
    fit_raw_response: Optional[str] = None
    rerank_score: Optional[float] = None
    following: Optional[int] = None
    business_email: Optional[str] = None
    email_address: Optional[str] = None
