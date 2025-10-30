"""Worker logic for BrightData refresh jobs."""

from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Union

import pandas as pd

from app.config import settings
from app.core import BrightDataClient
from app.models import ImageRefreshResult, ProfileHandle
from app.utils import normalize_profile_record

SUPPORTED_PLATFORMS = {"instagram", "tiktok"}
ChunkProgressCallback = Optional[Callable[[str, Dict[str, Any]], None]]


class ImageRefreshWorker:
    """Contains the heavy BrightData logic executed inside Huey tasks."""

    def __init__(self) -> None:
        self.instagram_client = BrightDataClient(dataset_id_override=settings.BRIGHTDATA_INSTAGRAM_DATASET_ID)
        self.tiktok_client = BrightDataClient(dataset_id_override=settings.BRIGHTDATA_TIKTOK_DATASET_ID)

    def refresh_profiles(
        self,
        profiles: Sequence[Union[ProfileHandle, Dict[str, Any], str]],
        *,
        progress_cb: ChunkProgressCallback = None,
    ) -> Dict[str, Any]:
        handles = [_coerce_profile(handle) for handle in profiles if handle]
        if not handles:
            raise ValueError("At least one profile handle is required")

        grouped: Dict[str, List[str]] = {}
        for handle in handles:
            grouped.setdefault(handle.platform, []).append(handle.username)

        aggregated_results: List[ImageRefreshResult] = []
        aggregated_records: List[Dict[str, Any]] = []
        aggregated_raw: List[Dict[str, Any]] = []
        snapshot_ids: Dict[str, List[str]] = {}

        for platform, usernames in grouped.items():
            client = self._client_for_platform(platform)
            max_urls = max(1, client.config.max_urls)
            chunks = list(_chunked(usernames, max_urls))
            total_chunks = len(chunks)
            total_profiles = len(usernames)

            if progress_cb:
                progress_cb(
                    "platform_started",
                    {"platform": platform, "chunks": total_chunks, "total_profiles": total_profiles},
                )

            futures = {}
            with ThreadPoolExecutor(max_workers=max(1, total_chunks)) as pool:
                for index, chunk in enumerate(chunks, start=1):
                    if progress_cb:
                        progress_cb(
                            "chunk_started",
                            {
                                "platform": platform,
                                "chunk_index": index,
                                "chunk_size": len(chunk),
                                "total_chunks": total_chunks,
                                "total_profiles": total_profiles,
                            },
                        )
                    profile_urls = build_profile_urls(chunk, platform=platform)
                    futures[pool.submit(client.refresh_profiles, profile_urls)] = (index, chunk)

                for completed_index, future in enumerate(as_completed(futures), start=1):
                    chunk_index, chunk_usernames = futures[future]
                    snapshot_id, dataframe = future.result()

                    snapshot_ids.setdefault(platform, []).append(snapshot_id)
                    payload = build_payload(chunk_usernames, snapshot_id, dataframe, platform=platform)
                    aggregated_results.extend(ImageRefreshResult(**result) for result in payload["results"])
                    aggregated_records.extend(payload.get("records", []))
                    aggregated_raw.extend(payload.get("raw_records", []))

                    if progress_cb:
                        progress_cb(
                            "chunk_finished",
                            {
                                "platform": platform,
                                "chunk_index": chunk_index,
                                "completed_chunks": completed_index,
                                "total_chunks": total_chunks,
                                "chunk_size": len(chunk_usernames),
                                "snapshot_id": snapshot_id,
                                "total_profiles": total_profiles,
                            },
                        )

            if progress_cb:
                progress_cb(
                    "platform_finished",
                    {
                        "platform": platform,
                        "chunks": total_chunks,
                        "snapshots": snapshot_ids.get(platform, []),
                        "total_profiles": total_profiles,
                    },
                )

        summary = summarise_results(aggregated_results)

        snapshot_value: Optional[Union[str, Dict[str, Union[str, List[str]]]]] = None
        if not snapshot_ids:
            snapshot_value = None
        elif all(len(ids) == 1 for ids in snapshot_ids.values()):
            if len(snapshot_ids) == 1:
                snapshot_value = next(iter(snapshot_ids.values()))[0]
            else:
                snapshot_value = {platform: ids[0] for platform, ids in snapshot_ids.items()}
        else:
            snapshot_value = snapshot_ids

        return {
            "snapshot_id": snapshot_value,
            "results": [result.model_dump() for result in aggregated_results],
            "summary": summary,
            "records": aggregated_records,
            "raw_records": aggregated_raw,
        }

    def fetch_single_profile(self, username: str, platform: str) -> Dict[str, Any]:
        handle = normalise_handle(username)
        if not handle:
            raise ValueError("Username is required")

        platform_normalised = platform.lower()
        if platform_normalised not in SUPPORTED_PLATFORMS:
            raise ValueError(f"Unsupported platform '{platform}'. Use one of: {', '.join(sorted(SUPPORTED_PLATFORMS))}.")

        profile_urls = build_profile_urls([handle], platform=platform_normalised)
        snapshot_id, dataframe = self._client_for_platform(platform_normalised).refresh_profiles(profile_urls)
        return build_payload([handle], snapshot_id, dataframe, platform=platform_normalised)

    def _client_for_platform(self, platform: str) -> BrightDataClient:
        if platform == "tiktok" and settings.BRIGHTDATA_TIKTOK_DATASET_ID:
            return self.tiktok_client
        return self.instagram_client


def _coerce_profile(profile: Union[ProfileHandle, Dict[str, Any], str]) -> ProfileHandle:
    if isinstance(profile, ProfileHandle):
        return profile
    if isinstance(profile, str):
        return ProfileHandle(username=profile)
    if isinstance(profile, dict):
        return ProfileHandle(**profile)
    raise ValueError("Unsupported profile handle type")


def build_payload(
    usernames: Sequence[str],
    snapshot_id: str,
    dataframe: pd.DataFrame,
    *,
    platform: str = "instagram",
) -> Dict[str, Any]:
    raw_records = dataframe.to_dict(orient="records") if not dataframe.empty else []
    raw_records = [_json_safe(record) for record in raw_records]
    normalized_records = [normalize_profile_record(record) for record in raw_records] if raw_records else []
    sanitized_df = pd.DataFrame.from_records(raw_records) if raw_records else pd.DataFrame()
    results = results_from_dataframe(usernames, sanitized_df, platform=platform)
    summary = summarise_results(results)
    return {
        "snapshot_id": snapshot_id,
        "results": [result.model_dump() for result in results],
        "summary": summary,
        "records": normalized_records,
        "raw_records": raw_records,
    }


def normalise_handle(value: Optional[str]) -> str:
    return (value or "").strip().lstrip("@")


def build_profile_urls(usernames: Sequence[str], platform: str = "instagram") -> List[str]:
    platform_normalised = platform.lower()
    urls: List[str] = []
    for username in usernames:
        handle = normalise_handle(username)
        if not handle:
            continue
        if platform_normalised == "tiktok":
            urls.append(f"https://www.tiktok.com/@{handle}")
        else:
            urls.append(f"https://www.instagram.com/{handle}")
    return urls


def results_from_dataframe(
    usernames: Sequence[str],
    dataframe: pd.DataFrame,
    *,
    platform: str = "instagram",
) -> List[ImageRefreshResult]:
    profile_map = BrightDataClient.dataframe_to_profile_map(dataframe)
    results: List[ImageRefreshResult] = []

    for username in usernames:
        handle = normalise_handle(username)
        if not handle:
            results.append(ImageRefreshResult(username=username, success=False, error="Invalid username"))
            continue

        candidates = build_candidate_keys(handle, platform=platform)
        match = next((profile_map.get(key) for key in candidates if key in profile_map), None)

        if match:
            warning = match.get("warning") or match.get("warning_message")
            warning_code = match.get("warning_code")
            if warning or warning_code:
                results.append(
                    ImageRefreshResult(
                        username=handle,
                        success=False,
                        error=warning or warning_code or "BrightData reported a warning",
                    )
                )
                continue

            profile_image_url = extract_profile_image(match)
            results.append(
                ImageRefreshResult(
                    username=handle,
                    success=True,
                    profile_image_url=str(profile_image_url) if profile_image_url else None,
                )
            )
        else:
            results.append(
                ImageRefreshResult(
                    username=handle,
                    success=False,
                    error="Profile not returned by BrightData",
                )
            )

    return results


def build_candidate_keys(handle: str, platform: str = "instagram") -> List[str]:
    handle = handle.lower()
    candidates = [handle]
    candidates.append(f"https://instagram.com/{handle}")
    candidates.append(f"https://www.instagram.com/{handle}")
    candidates.append(f"https://tiktok.com/@{handle}")
    candidates.append(f"https://www.tiktok.com/@{handle}")
    return [candidate.lower() for candidate in candidates]


def extract_profile_image(record: Dict[str, Any]) -> Optional[str]:
    keys = [
        "profile_image_url",
        "profile_image_link",
        "profile_pic_url_hd",
        "profile_pic_url",
        "profile_picture",
        "profile_pic",
        "picture",
        "avatar",
    ]
    for key in keys:
        value = record.get(key)
        if value:
            return str(value)
    return None


def summarise_results(results: Sequence[ImageRefreshResult]) -> Dict[str, int]:
    total = len(results)
    successful = sum(1 for result in results if result.success)
    failed = total - successful
    return {"total": total, "successful": successful, "failed": failed}


__all__ = [
    "ImageRefreshWorker",
    "build_profile_urls",
    "results_from_dataframe",
    "summarise_results",
    "build_candidate_keys",
    "extract_profile_image",
    "normalise_handle",
]


def _json_safe(value: Any) -> Any:
    """Recursively convert NaN/inf values into JSON-safe None."""
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_safe(val) for key, val in value.items()}
    return value


def _chunked(seq: Sequence[str], size: int) -> Iterable[List[str]]:
    for index in range(0, len(seq), size):
        yield list(seq[index : index + size])
