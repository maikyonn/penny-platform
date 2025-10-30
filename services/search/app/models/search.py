"""Search-related Pydantic models for the simplified API."""
from typing import Any, Dict, List, Optional, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Search query for creators")
    method: Literal["lexical", "semantic", "hybrid"] = Field(
        default="hybrid", description="Search mode"
    )
    limit: int = Field(default=20, ge=1, le=50000, description="Maximum results to return")

    min_followers: Optional[int] = Field(default=None, ge=0)
    max_followers: Optional[int] = Field(default=None, ge=0)
    min_engagement: Optional[float] = Field(default=None, ge=0.0)
    max_engagement: Optional[float] = Field(default=None, ge=0.0)

    location: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)
    is_verified: Optional[bool] = Field(default=None)
    is_business_account: Optional[bool] = Field(default=None)
    lexical_scope: Literal["bio", "bio_posts"] = Field(
        default="bio", description="Lexical search scope"
    )


class SimilarSearchRequest(BaseModel):
    account: str = Field(..., min_length=1, description="Reference account username")
    limit: int = Field(default=10, ge=1, le=100)

    min_followers: Optional[int] = Field(default=None, ge=0)
    max_followers: Optional[int] = Field(default=None, ge=0)
    min_engagement: Optional[float] = Field(default=None, ge=0.0)
    max_engagement: Optional[float] = Field(default=None, ge=0.0)

    location: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)


class CategorySearchRequest(BaseModel):
    category: str = Field(..., min_length=1)
    location: Optional[str] = Field(default=None)
    limit: int = Field(default=15, ge=1, le=200)

    min_followers: Optional[int] = Field(default=None, ge=0)
    max_followers: Optional[int] = Field(default=None, ge=0)
    min_engagement: Optional[float] = Field(default=None, ge=0.0)
    max_engagement: Optional[float] = Field(default=None, ge=0.0)


class PipelineEnrichRequest(BaseModel):
    profiles: List[Dict[str, Any]] = Field(..., min_items=1, description="Profiles to evaluate")
    run_brightdata: bool = Field(default=False)
    run_llm: bool = Field(default=False)
    business_fit_query: Optional[str] = Field(default=None)
    max_profiles: Optional[int] = Field(default=None, ge=1, le=50000)
    max_posts: int = Field(default=6, ge=1, le=20)
    model: str = Field(default="gpt-5-mini")
    verbosity: str = Field(default="medium")
    concurrency: int = Field(default=64, ge=1, le=64)


class SearchResponse(BaseModel):
    success: bool
    results: List[Dict[str, Any]]
    count: int
    query: str
    method: str


class UsernameSearchResponse(BaseModel):
    success: bool
    result: Dict[str, Any]


class PipelineEnrichResponse(BaseModel):
    success: bool
    results: List[Dict[str, Any]]
    brightdata_results: List[Dict[str, Any]]
    profile_fit: List[Dict[str, Any]]
    count: int


class JobEnqueueResponse(BaseModel):
    """Standard response for async job submissions."""

    job_id: str
    queue: str
    status: Literal["queued"] = "queued"


class PipelineStageEvent(BaseModel):
    """Structured stage telemetry for the search pipeline."""

    stage: str
    data: Dict[str, Any]


class ProfileRef(BaseModel):
    """Minimal, stable profile identifier carried across stages."""

    lance_db_id: Optional[str] = None
    account: Optional[str] = None
    profile_url: Optional[str] = None

    @classmethod
    def from_result(cls, result: Any) -> "ProfileRef":
        if isinstance(result, dict):
            lance = result.get("lance_db_id")
            account = result.get("account") or result.get("username")
            url = result.get("profile_url") or result.get("url")
        else:
            lance = getattr(result, "lance_db_id", None)
            account = getattr(result, "account", None) or getattr(result, "username", None)
            url = (
                getattr(result, "profile_url", None)
                or getattr(result, "url", None)
            )
        if isinstance(url, str):
            url = url.strip() or None
        return cls(
            lance_db_id=lance,
            account=account,
            profile_url=url,
        )


class StageIO(BaseModel):
    """Uniform inputs/outputs envelope per stage."""

    inputs: List[ProfileRef] = Field(default_factory=list)
    outputs: List[ProfileRef] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)


class SearchPipelineRequest(BaseModel):
    """Run discovery plus optional enrichment in a single request."""

    search: SearchRequest
    run_brightdata: bool = Field(default=False)
    run_llm: bool = Field(default=False)
    run_rerank: bool = Field(default=False)
    rerank_top_k: int = Field(default=200, ge=1, le=1000)
    rerank_mode: Literal["bio", "posts", "bio+posts"] = Field(default="bio+posts")
    business_fit_query: Optional[str] = Field(default=None)
    max_profiles: Optional[int] = Field(default=None, ge=1, le=50000)
    max_posts: int = Field(default=6, ge=1, le=20)
    model: str = Field(default="gpt-5-mini")
    verbosity: str = Field(default="medium")
    concurrency: int = Field(default=64, ge=1, le=64)


class SearchPipelineResponse(BaseModel):
    """Response returned by the staged search pipeline."""

    success: bool
    results: List[Dict[str, Any]]
    brightdata_results: List[Dict[str, Any]]
    profile_fit: List[Dict[str, Any]]
    stages: List[PipelineStageEvent]
    count: int


class BrightDataStageRequest(BaseModel):
    profiles: List[Dict[str, Any]] = Field(..., min_items=1)
    max_profiles: Optional[int] = Field(default=None, ge=1, le=50000)

    @model_validator(mode="after")
    def ensure_profile_urls_present(self):
        missing = [
            idx
            for idx, profile in enumerate(self.profiles)
            if not _extract_profile_url(profile)
        ]
        if missing:
            raise ValueError("Each profile must include a 'profile_url' or 'url' value")
        return self


def _extract_profile_url(profile: Dict[str, Any]) -> Optional[str]:
    url_value = profile.get("profile_url") or profile.get("url") or profile.get("input_url")
    if isinstance(url_value, str) and url_value.strip():
        return url_value.strip()
    return None


class BrightDataStageResponse(BaseModel):
    success: bool
    results: List[Dict[str, Any]]
    brightdata_results: List[Dict[str, Any]]
    count: int


class ProfileFitStageRequest(BaseModel):
    profiles: List[Dict[str, Any]] = Field(..., min_items=1)
    business_fit_query: str = Field(..., min_length=1)
    max_profiles: Optional[int] = Field(default=None, ge=1, le=50000)
    max_posts: int = Field(default=6, ge=1, le=20)
    model: str = Field(default="gpt-5-mini")
    verbosity: str = Field(default="medium")
    concurrency: int = Field(default=64, ge=1, le=64)
    use_brightdata: bool = Field(default=False)


class ProfileFitStageResponse(BaseModel):
    success: bool
    results: List[Dict[str, Any]]
    brightdata_results: List[Dict[str, Any]]
    profile_fit: List[Dict[str, Any]]
    count: int


class ImageRefreshRequest(BaseModel):
    """Payload to refresh images for explicit usernames."""

    usernames: List[str] = Field(..., min_items=1, max_items=50)
    update_database: bool = Field(default=False)


class ImageRefreshSearchRequest(BaseModel):
    """Payload to refresh images for a batch of search results."""

    search_results: List[Dict[str, Any]] = Field(..., min_items=1)
    update_database: bool = Field(default=True)
