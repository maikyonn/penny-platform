"""Stage that enriches profiles via the BrightData proxy service."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

import pandas as pd

from app.config import settings
from app.core.models.domain import CreatorProfile
from app.core.pipeline.base import Stage, StageResult, StageName, ProgressCallback
from app.core.pipeline.utils import build_profile_refs, normalized_profile_key
from app.core.post_filter import BrightDataServiceClient
from app.models.search import StageIO


def _profile_url(profile: CreatorProfile) -> Optional[str]:
    if profile.profile_url and profile.profile_url.strip():
        return profile.profile_url.strip()
    handle = (profile.username or profile.account or "").strip().lstrip("@")
    if not handle:
        return None
    platform = (profile.platform or "").lower()
    if platform == "tiktok":
        return f"https://www.tiktok.com/@{handle}"
    return f"https://instagram.com/{handle}"


def _is_success(record: Dict[str, Any]) -> bool:
    for key in ("warning", "warning_code", "error", "error_code"):
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return False
    return True


def _apply_record(profile: CreatorProfile, record: Dict[str, Any]) -> None:
    biography = record.get("biography")
    if isinstance(biography, str) and biography.strip():
        profile.biography = biography.strip()

    followers = record.get("followers")
    if followers not in (None, ""):
        try:
            profile.followers = int(float(followers))
        except (TypeError, ValueError):
            pass

    following = record.get("following")
    if following not in (None, ""):
        try:
            profile.following = int(float(following))
        except (TypeError, ValueError):
            pass

    posts_value = record.get("posts") or record.get("posts_json")
    if posts_value:
        profile.posts_raw = posts_value

    profile_image_link = record.get("profile_image_url") or record.get("profile_image_link")
    if profile_image_link:
        profile.profile_image_link = profile_image_link
        profile.profile_image_url = profile_image_link

    profile_url = record.get("profile_url") or record.get("url")
    if isinstance(profile_url, str) and profile_url.strip():
        profile.profile_url = profile_url.strip()

    business_email = record.get("business_email") or record.get("email_address")
    if isinstance(business_email, str):
        profile.business_email = business_email

    email_address = record.get("email_address")
    if isinstance(email_address, str):
        profile.email_address = email_address


class BrightDataStage(Stage):
    name = StageName.BRIGHTDATA

    def __init__(self, client: Optional[BrightDataServiceClient] = None, max_chunk_size: Optional[int] = None) -> None:
        self._client = client
        configured = max_chunk_size or settings.BRIGHTDATA_MAX_URLS or 50
        self._chunk_size = max(1, int(configured))

    def run(
        self,
        profiles: List[CreatorProfile],
        *,
        progress_cb: ProgressCallback = None,
    ) -> StageResult:
        if not profiles:
            empty_io = StageIO(inputs=[], outputs=[])
            if progress_cb:
                progress_cb(f"{self.name}_COMPLETED", {"count": 0, "io": empty_io.model_dump()})
            return StageResult(profiles=[], io=empty_io, debug={"brightdata_results": []})

        url_map: Dict[str, CreatorProfile] = {}
        missing_records: List[Dict[str, Any]] = []

        for profile in profiles:
            url = _profile_url(profile)
            if not url:
                missing = {
                    "profile_url": None,
                    "account": profile.account,
                    "username": profile.username or profile.account,
                    "warning": "missing_profile_url",
                    "warning_code": "missing_profile_url",
                }
                missing_records.append(missing)
                if progress_cb:
                    progress_cb(
                        f"{self.name}_PROFILE_FAILED",
                        {"account": profile.account, "profile_url": None, "error": "missing_profile_url"},
                    )
                continue
            url_map[url] = profile

        urls = list(url_map.keys())
        total_chunks = 0
        if urls:
            total_chunks = (len(urls) + self._chunk_size - 1) // self._chunk_size

        io_payload = StageIO(inputs=build_profile_refs(profiles), outputs=build_profile_refs(profiles))
        if progress_cb:
            progress_cb(
                f"{self.name}_STARTED",
                {"count": len(urls), "chunks": total_chunks, "io": io_payload.model_dump()},
            )

        if not urls:
            if progress_cb:
                progress_cb(
                    f"{self.name}_COMPLETED",
                    {"count": 0, "io": io_payload.model_dump()},
                )
            return StageResult(
                profiles=profiles,
                io=io_payload,
                debug={"brightdata_results": missing_records},
            )

        records: List[Dict[str, Any]] = []
        debug_errors: List[str] = []
        client = self._client or BrightDataServiceClient()
        self._client = client
        def _forward(event: str, data: Dict[str, Any]) -> None:
            if progress_cb:
                progress_cb(event, data)

        try:
            df = client.fetch_profiles(urls, progress_cb=_forward if progress_cb else None)
            if isinstance(df, pd.DataFrame) and not df.empty:
                records.extend(df.to_dict(orient="records"))
        except Exception as exc:  # pylint: disable=broad-except
            debug_errors.append(str(exc))
            if progress_cb:
                progress_cb(
                    f"{self.name}_PROFILE_FAILED",
                    {"error": str(exc)},
                )

        records.extend(missing_records)

        record_map: Dict[str, Dict[str, Any]] = {}
        success_keys: List[str] = []
        for record in records:
            key = normalized_profile_key(record)
            if key:
                record_map[key] = record

        success_count = 0
        for url, profile in url_map.items():
            key = normalized_profile_key({"profile_url": url, "account": profile.account, "username": profile.username})
            record = record_map.get(key or "")
            if not record:
                if progress_cb:
                    progress_cb(
                        f"{self.name}_PROFILE_FAILED",
                        {"account": profile.account, "profile_url": url, "error": "not_returned"},
                    )
                continue
            _apply_record(profile, record)
            is_success = _is_success(record)
            event = f"{self.name}_PROFILE_COMPLETED" if is_success else f"{self.name}_PROFILE_FAILED"
            payload: Dict[str, Any] = {"account": profile.account, "profile_url": url}
            if not _is_success(record):
                payload["error"] = record.get("error") or record.get("warning")
            if progress_cb:
                progress_cb(event, payload)
            if is_success:
                success_count += 1
                if key:
                    success_keys.append(key)

        if progress_cb:
            progress_cb(
                f"{self.name}_COMPLETED",
                {
                    "count": success_count,
                    "errors": debug_errors,
                    "io": io_payload.model_dump(),
                },
            )

        return StageResult(
            profiles=profiles,
            io=io_payload,
            debug={"brightdata_results": records, "errors": debug_errors, "success_keys": success_keys},
        )
