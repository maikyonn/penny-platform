"""BrightData client helper for refreshing Instagram profile snapshots."""
from __future__ import annotations

import io
import time
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional
from urllib.parse import urlparse

import pandas as pd
import requests

from app.config import settings


@dataclass
class BrightDataConfig:
    """Runtime configuration for the BrightData client."""

    api_key: str
    dataset_id: str
    poll_interval: int = 30
    base_url: str = "https://api.brightdata.com/datasets/v3"
    max_urls: int = 50


class BrightDataClient:
    """Lightweight wrapper around the BrightData dataset API."""

    BASE_URL = "https://api.brightdata.com/datasets/v3"

    def __init__(self, config: Optional[BrightDataConfig] = None, dataset_id_override: Optional[str] = None) -> None:
        if config is not None:
            self.config = config
        else:
            api_secret = settings.BRIGHTDATA_API_KEY or settings.BRIGHTDATA_API_TOKEN
            if api_secret is None:
                raise RuntimeError(
                    "BrightData configuration missing. Set BRIGHTDATA_API_KEY or BRIGHTDATA_API_TOKEN."
                )

            dataset_id = dataset_id_override or settings.BRIGHTDATA_INSTAGRAM_DATASET_ID or settings.BRIGHTDATA_TIKTOK_DATASET_ID
            if not dataset_id:
                raise RuntimeError(
                    "BrightData DATASET ID missing. Provide BRIGHTDATA_INSTAGRAM_DATASET_ID or BRIGHTDATA_TIKTOK_DATASET_ID."
                )

            self.config = BrightDataConfig(
                api_key=api_secret.get_secret_value(),
                dataset_id=dataset_id,
                poll_interval=settings.BRIGHTDATA_POLL_INTERVAL,
                base_url=str(settings.BRIGHTDATA_BASE_URL),
                max_urls=settings.BRIGHTDATA_MAX_URLS,
            )

        self.headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

    def trigger_snapshot(self, profile_urls: Iterable[str]) -> str:
        """Trigger a BrightData snapshot and return its ID."""
        url_objects = self._prepare_urls(profile_urls)
        if not url_objects:
            raise ValueError("No profile URLs provided to BrightData")

        response = requests.post(
            f"{self.config.base_url}/trigger",
            headers=self.headers,
            params={
                "dataset_id": self.config.dataset_id,
                "include_errors": "true",
            },
            json=url_objects,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        snapshot_id = data.get("snapshot_id")
        if not snapshot_id:
            raise RuntimeError("Failed to trigger BrightData snapshot")
        return snapshot_id

    def wait_for_snapshot(self, snapshot_id: str) -> None:
        """Poll the snapshot until it is ready or failed."""
        while True:
            status_payload = self.get_snapshot_status(snapshot_id)
            status = status_payload.get("status")
            if status == "ready":
                return
            if status == "failed":
                raise RuntimeError(f"BrightData snapshot {snapshot_id} failed")
            time.sleep(self.config.poll_interval)

    def download_snapshot(self, snapshot_id: str) -> pd.DataFrame:
        """Download the snapshot as a DataFrame."""
        response = requests.get(
            f"{self.config.base_url}/snapshot/{snapshot_id}",
            headers=self.headers,
            params={"format": "csv"},
            timeout=60,
        )
        response.raise_for_status()
        encoding = response.encoding or "utf-8"
        buffer = io.StringIO(response.content.decode(encoding))
        if buffer.getvalue().strip():
            return pd.read_csv(buffer)
        return pd.DataFrame()

    def refresh_profiles(self, profile_urls: Iterable[str]) -> tuple[str, pd.DataFrame]:
        """Trigger, wait for, and download a snapshot for the provided URLs."""
        snapshot_id = self.trigger_snapshot(profile_urls)
        self.wait_for_snapshot(snapshot_id)
        dataframe = self.download_snapshot(snapshot_id)
        return snapshot_id, dataframe

    def get_snapshot_status(self, snapshot_id: str) -> Dict[str, object]:
        """Fetch status details for an existing snapshot."""
        response = requests.get(
            f"{self.config.base_url}/progress/{snapshot_id}",
            headers=self.headers,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def _prepare_urls(self, profile_urls: Iterable[str]) -> List[Dict[str, str]]:
        cleaned: List[Dict[str, str]] = []
        seen: set[str] = set()

        for raw in profile_urls:
            if not raw:
                continue
            url = raw.strip()
            if not url:
                continue

            canonical = self._canonicalize_url(url)
            if not canonical:
                continue

            lowered = canonical.lower()
            if lowered in seen:
                continue

            seen.add(lowered)
            cleaned.append({"url": canonical})

            if len(cleaned) >= self.config.max_urls:
                break

        return cleaned

    @staticmethod
    def _canonicalize_url(url: str) -> Optional[str]:
        """Return a canonical social URL (Instagram or TikTok) or None if invalid."""
        try:
            parsed = urlparse(url.strip())
        except Exception:
            return None

        if not parsed.netloc:
            return None

        scheme = parsed.scheme or "https"
        host = parsed.netloc.lower()
        path = parsed.path.rstrip("/")

        social_hosts = ("instagram.com", "tiktok.com")
        if any(part in host for part in social_hosts) and path:
            if host.endswith("tiktok.com") and not path.startswith("/@"):
                path = f"/@{path.lstrip('/')}"
            return f"{scheme}://{host}{path}"

        return None

    @staticmethod
    def dataframe_to_profile_map(dataframe: pd.DataFrame) -> Dict[str, Dict[str, Optional[str]]]:
        """Convert BrightData dataframe into a mapping keyed by profile URL or account."""
        profile_map: Dict[str, Dict[str, Optional[str]]] = {}
        if dataframe.empty:
            return profile_map
        for _, row in dataframe.iterrows():
            profile_url = row.get("profile_url") or row.get("url")
            account = row.get("account") or row.get("username")
            key_candidates = []
            if isinstance(profile_url, str) and profile_url:
                key_candidates.append(profile_url.strip().lower())
            if isinstance(account, str) and account:
                handle = account.strip().lstrip("@").lower()
                if handle:
                    key_candidates.append(handle)
                    key_candidates.append(f"https://instagram.com/{handle}")
                    key_candidates.append(f"https://www.instagram.com/{handle}")
                    key_candidates.append(f"https://tiktok.com/@{handle}")
                    key_candidates.append(f"https://www.tiktok.com/@{handle}")

            for key in key_candidates:
                if key and key not in profile_map:
                    profile_map[key] = row.to_dict()
        return profile_map
