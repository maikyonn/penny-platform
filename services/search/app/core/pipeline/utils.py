"""Utility helpers used by pipeline stages."""
from __future__ import annotations

from typing import Iterable, List, Dict, Any, Optional

from app.core.models.domain import CreatorProfile
from app.models.search import ProfileRef


def build_profile_refs(items: Iterable[CreatorProfile]) -> List[Dict[str, Any]]:
    return [ProfileRef.from_result(item).model_dump() for item in (items or [])]


def normalized_profile_key(record: Any) -> Optional[str]:
    if record is None:
        return None
    if isinstance(record, dict):
        profile_url = record.get("profile_url") or record.get("url") or record.get("input_url")
        if isinstance(profile_url, str) and profile_url.strip():
            return profile_url.strip().lower()
        username = record.get("username") or record.get("account")
        if isinstance(username, str) and username.strip():
            return username.strip().lower()
        return None

    profile_url = getattr(record, "profile_url", None) or getattr(record, "url", None)
    if isinstance(profile_url, str) and profile_url.strip():
        return profile_url.strip().lower()
    username = getattr(record, "username", None) or getattr(record, "account", None)
    if isinstance(username, str) and username.strip():
        return username.strip().lower()
    return None
