"""Pydantic models for image refresh requests and responses."""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class ProfileHandle(BaseModel):
    """Represents a social profile to refresh."""

    username: str = Field(..., min_length=1, max_length=255)
    platform: str = Field(default="instagram")

    @field_validator("username")
    @classmethod
    def _normalize_username(cls, value: str) -> str:
        cleaned = (value or "").strip().lstrip("@")
        if not cleaned:
            raise ValueError("username must not be empty")
        return cleaned

    @field_validator("platform")
    @classmethod
    def _normalize_platform(cls, value: str) -> str:
        normalized = (value or "").strip().lower()
        if normalized not in {"instagram", "tiktok"}:
            raise ValueError("platform must be 'instagram' or 'tiktok'")
        return normalized or "instagram"


class ImageRefreshRequest(BaseModel):
    """Payload to refresh images for explicit usernames."""

    usernames: Optional[List[str]] = Field(default=None, min_items=1, max_items=50)
    profiles: Optional[List[ProfileHandle]] = Field(default=None, min_items=1, max_items=50)
    update_database: bool = Field(
        default=False,
        description="Placeholder flag retained for backwards compatibility.",
    )

    @model_validator(mode="after")
    def _ensure_payload(self):
        profiles = self.resolve_profiles()
        if not profiles:
            raise ValueError("Provide at least one 'username' or 'profiles' entry.")
        if len(profiles) > 50:
            raise ValueError("Cannot refresh more than 50 profiles in a single request.")
        return self

    def resolve_profiles(self) -> List[ProfileHandle]:
        handles: List[ProfileHandle] = []
        if self.profiles:
            handles.extend(self.profiles)
        if self.usernames:
            handles.extend(ProfileHandle(username=name) for name in self.usernames)

        seen = set()
        unique: List[ProfileHandle] = []
        for handle in handles:
            key = (handle.platform, handle.username.lower())
            if key in seen:
                continue
            seen.add(key)
            unique.append(handle)
        return unique


class ImageRefreshSearchRequest(BaseModel):
    """Payload to refresh images for a batch of search results."""

    search_results: List[Dict[str, str]] = Field(..., min_items=1)
    update_database: bool = Field(
        default=True,
        description="Placeholder flag retained for backwards compatibility.",
    )


class ImageRefreshResult(BaseModel):
    """Result of image refresh operation."""

    username: str
    success: bool
    profile_image_url: Optional[str] = None
    error: Optional[str] = None


class ImageRefreshSummary(BaseModel):
    """Summary of image refresh operation."""

    total: int
    successful: int
    failed: int
