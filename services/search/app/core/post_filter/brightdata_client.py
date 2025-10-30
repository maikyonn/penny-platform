"""BrightData client that proxies through the DIME-AI-BD service."""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse

import pandas as pd
import requests

from app.config import settings


class BrightDataServiceClient:
    """Wrapper around the DIME-AI-BD HTTP API for BrightData snapshots."""

    def __init__(self) -> None:
        base_url = str(settings.BRIGHTDATA_SERVICE_URL or "").rstrip("/")
        if not base_url:
            raise RuntimeError("BRIGHTDATA_SERVICE_URL must be configured to use BrightData features")

        self.base_url = base_url
        self.poll_interval = max(1, settings.BRIGHTDATA_JOB_POLL_INTERVAL or 5)
        self.job_timeout = settings.BRIGHTDATA_JOB_TIMEOUT or 600
        self.max_chunk_size = max(1, settings.BRIGHTDATA_MAX_URLS or 50)
        self.session = requests.Session()

    def fetch_profiles(
        self,
        profile_urls: Iterable[str],
        *,
        progress_cb: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> pd.DataFrame:
        handles = self._extract_profile_handles(profile_urls)
        if not handles:
            raise ValueError("No profile URLs provided to BrightData service")

        total = len(handles)

        if len(handles) <= self.max_chunk_size:
            df = self._fetch_chunk(handles)
            if progress_cb:
                progress_cb(
                    "BRIGHTDATA_PROGRESS",
                    {"completed": total, "total": total, "chunk_size": total},
                )
            return df

        chunks = [handles[idx : idx + self.max_chunk_size] for idx in range(0, len(handles), self.max_chunk_size)]
        frames: List[pd.DataFrame] = []
        completed = 0
        with ThreadPoolExecutor(max_workers=len(chunks)) as executor:
            future_map = {executor.submit(self._fetch_chunk, chunk): chunk for chunk in chunks}
            for future in as_completed(future_map):
                df = future.result()
                frames.append(df)
                if progress_cb:
                    chunk_handles = future_map[future]
                    chunk_size = len(chunk_handles)
                    completed += chunk_size
                    progress_cb(
                        "BRIGHTDATA_PROGRESS",
                        {"completed": completed, "total": total, "chunk_size": chunk_size},
                    )
        if not frames:
            return pd.DataFrame()
        return pd.concat(frames, ignore_index=True)

    def _fetch_chunk(self, handles: List[Dict[str, str]]) -> pd.DataFrame:
        payload: Dict[str, Any] = {
            "profiles": handles,
            "update_database": False,
        }

        response = self.session.post(f"{self.base_url}/refresh", json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        job_id = data.get("job_id")
        if not job_id:
            result = data.get("result")
            if result:
                return self._records_to_dataframe(result.get("records", []))
            raise RuntimeError("BrightData service did not return job_id")

        result_payload = self._wait_for_job(job_id)
        records = result_payload.get("records", [])
        return self._records_to_dataframe(records)

    def _wait_for_job(self, job_id: str) -> Dict[str, object]:
        deadline = time.monotonic() + self.job_timeout
        last_status: Optional[str] = None
        while time.monotonic() < deadline:
            response = self.session.get(f"{self.base_url}/refresh/job/{job_id}", timeout=30)
            if response.status_code == 404:
                raise RuntimeError(f"BrightData job '{job_id}' not found")
            response.raise_for_status()
            payload = response.json().get("job", {})
            status = payload.get("status")
            last_status = status or last_status
            if status == "finished":
                return payload.get("result", {})
            if status == "failed":
                raise RuntimeError(payload.get("error") or f"BrightData job '{job_id}' failed")
            time.sleep(self.poll_interval)

        raise RuntimeError(
            f"Timed out after {self.job_timeout}s waiting for BrightData job '{job_id}' (last status: {last_status})"
        )

    def _extract_profile_handles(self, profile_urls: Iterable[str]) -> List[Dict[str, str]]:
        handles: List[Dict[str, str]] = []
        for raw in profile_urls:
            platform, handle = self._parse_social_url(raw)
            if not handle:
                continue
            handles.append({"username": handle, "platform": platform or "instagram"})
        return handles

    @staticmethod
    def _parse_social_url(url: str) -> Tuple[str, Optional[str]]:
        if not url:
            return "", None

        try:
            parsed = urlparse(url)
        except Exception:
            return "", None

        host = (parsed.netloc or "").lower()
        path = (parsed.path or "").strip("/")
        if "instagram.com" in host and path:
            handle = path.split("/")[0].lstrip("@")
            return "instagram", handle
        if "tiktok.com" in host and path:
            # After strip("/") TikTok usernames appear as "@handle" or "handle[/...]"
            if path.startswith("@"):
                handle = path[1:]
            else:
                handle = path.split("/")[0]
            return "tiktok", handle
        return "", None

    @staticmethod
    def _records_to_dataframe(records: List[Dict[str, object]]) -> pd.DataFrame:
        if not records:
            return pd.DataFrame()
        return pd.DataFrame.from_records(records)

    @staticmethod
    def dataframe_to_profile_map(df: pd.DataFrame) -> Dict[str, Dict[str, Optional[str]]]:
        profile_map: Dict[str, Dict[str, Optional[str]]] = {}
        if df.empty:
            return profile_map
        for _, row in df.iterrows():
            profile_url = row.get("profile_url") or row.get("url")
            account = row.get("account")
            key = str(profile_url or account or "").strip().lower()
            if not key:
                continue
            profile_map[key] = row.to_dict()
        return profile_map
