"""Integration smoke-tests hitting BrightData live."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Dict, List

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.v1.images import _extract_profile_handles
from app.config import settings
from app.models import ProfileHandle
from app.services import ImageRefreshService
from app.workers import ImageRefreshWorker
from app.workers import image_refresh_worker as worker_module


BRIGHTDATA_CONFIGURED = bool(
    (settings.BRIGHTDATA_API_KEY or settings.BRIGHTDATA_API_TOKEN)
    and (settings.BRIGHTDATA_INSTAGRAM_DATASET_ID or settings.BRIGHTDATA_TIKTOK_DATASET_ID)
)


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.skipif(not BRIGHTDATA_CONFIGURED, reason="BrightData credentials not configured")
async def test_single_profile_fetch_maple_bgs():
    service = ImageRefreshService()
    payload = await service.fetch_single_profile(username="maple_bgs", platform="instagram")

    assert payload["snapshot_id"]
    results = payload["results"]
    assert results and results[0]["username"].lower() == "maple_bgs"

    records = payload.get("records") or []
    assert records and records[0]["account"].lower() == "maple_bgs"

    posts_value = records[0].get("posts")
    if isinstance(posts_value, str):
        try:
            posts = json.loads(posts_value)
        except Exception:
            posts = []
    else:
        posts = posts_value or []
    if posts:
        assert isinstance(posts[0], dict)


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.skipif(not BRIGHTDATA_CONFIGURED, reason="BrightData credentials not configured")
async def test_queue_job_lifecycle():
    service = ImageRefreshService()
    job_id = await service.enqueue_refresh_job([ProfileHandle(username="maple_bgs")])
    status = await service.wait_for_job(job_id, timeout=300)

    assert status is not None
    assert status["status"] == "finished"
    summary = status["result"].get("summary", {})
    assert summary.get("total", 0) >= 0


TIKTOK_URLS = [
    "https://www.tiktok.com/@makeupshan",
    "https://www.tiktok.com/@mimirane",
    "https://www.tiktok.com/@chicorato64",
    "https://www.tiktok.com/@7qiix_",
    "https://www.tiktok.com/@menaminuki",
    "https://www.tiktok.com/@dizzybabakan",
    "https://www.tiktok.com/@shield.nt",
    "https://www.tiktok.com/@tsania_yoongi19",
    "https://www.tiktok.com/@_fazer_vc_flz",
    "https://www.tiktok.com/@gueuphnalyte",
    "https://www.tiktok.com/@bbellababy",
    "https://www.tiktok.com/@ittellir",
    "https://www.tiktok.com/@sonqmao",
    "https://www.tiktok.com/@beaplaysroblox",
    "https://www.tiktok.com/@michellevaleriee",
    "https://www.tiktok.com/@khim_myy07",
    "https://www.tiktok.com/@aurelliaemily",
    "https://www.tiktok.com/@salemsalem74",
    "https://www.tiktok.com/@katelynsonnier",
    "https://www.tiktok.com/@mln",
]


def test_extract_profile_handles_with_tiktok_urls():
    search_results = [{"profile_url": url} for url in TIKTOK_URLS]
    handles = _extract_profile_handles(search_results)

    assert len(handles) == len(TIKTOK_URLS)
    for handle, url in zip(handles, TIKTOK_URLS):
        assert handle.platform == "tiktok"
        assert handle.username.lower() == url.rsplit("@", 1)[-1].lower()


@pytest.mark.asyncio
async def test_stream_job_events_replay(monkeypatch):
    class DummyClient:
        def __init__(self, *args, **kwargs):
            pass

    class DummyWorker:
        def refresh_profiles(self, profiles, *, progress_cb=None):
            usernames = [profile["username"] for profile in profiles]
            if progress_cb:
                progress_cb(
                    "platform_started",
                    {"platform": "instagram", "chunks": 1, "total_profiles": len(usernames)},
                )
                progress_cb(
                    "chunk_started",
                    {
                        "platform": "instagram",
                        "chunk_index": 1,
                        "chunk_size": len(usernames),
                        "total_chunks": 1,
                        "total_profiles": len(usernames),
                    },
                )
            if progress_cb:
                progress_cb(
                    "chunk_finished",
                    {
                        "platform": "instagram",
                        "chunk_index": 1,
                        "completed_chunks": 1,
                        "total_chunks": 1,
                        "chunk_size": len(usernames),
                        "snapshot_id": "demo",
                        "total_profiles": len(usernames),
                    },
                )
                progress_cb(
                    "platform_finished",
                    {"platform": "instagram", "chunks": 1, "snapshots": ["demo"], "total_profiles": len(usernames)},
                )
            return {
                "snapshot_id": "demo",
                "results": [
                    {"username": username, "success": True, "profile_image_url": None, "error": None}
                    for username in usernames
                ],
                "summary": {"total": len(usernames), "successful": len(usernames), "failed": 0},
                "records": [],
                "raw_records": [],
            }

        def fetch_single_profile(self, username: str, platform: str):
            return {
                "snapshot_id": "demo",
                "results": [{"username": username, "success": True, "profile_image_url": None, "error": None}],
                "summary": {"total": 1, "successful": 1, "failed": 0},
                "records": [],
                "raw_records": [],
            }

    monkeypatch.setattr("app.services.image_refresh_service.BrightDataClient", DummyClient)

    service = ImageRefreshService()
    service._worker = DummyWorker()
    service._immediate = True

    job_id = await service.enqueue_refresh_job([ProfileHandle(username="demo_handle")])
    stream = await service.stream_job_events(job_id)
    assert stream is not None

    events = []
    async for event in stream:
        events.append(event)

    event_types = [event["event"] for event in events]
    assert event_types[0] == "queued"
    assert "chunk_started" in event_types
    assert "chunk_finished" in event_types
    assert event_types[-1] == "finished"


def test_worker_chunks_profiles(monkeypatch):
    captured_calls: Dict[str, List[List[str]]] = {"instagram": []}

    class DummyClient:
        counter = 0

        def __init__(self, *args, **kwargs) -> None:
            self.config = SimpleNamespace(max_urls=3)

        def refresh_profiles(self, profile_urls):
            DummyClient.counter += 1
            snapshot_id = f"snap-{DummyClient.counter}"
            rows = []
            for url in profile_urls:
                handle = url.rstrip("/").split("/")[-1].lstrip("@")
                rows.append(
                    {
                        "profile_url": url,
                        "url": url,
                        "account": handle,
                        "username": handle,
                        "profile_image_url": f"https://img/{handle}.jpg",
                        "followers": 100,
                    }
                )
            platform = "tiktok" if "tiktok.com" in profile_urls[0] else "instagram"
            captured_calls.setdefault(platform, []).append([row["username"] for row in rows])
            df = pd.DataFrame(rows)
            return snapshot_id, df

    original_map = worker_module.BrightDataClient.dataframe_to_profile_map
    DummyClient.dataframe_to_profile_map = staticmethod(original_map)
    monkeypatch.setattr("app.workers.image_refresh_worker.BrightDataClient", DummyClient)

    worker = ImageRefreshWorker()
    profiles = [ProfileHandle(username=f"user{i}") for i in range(1, 8)]

    progress_events: List[str] = []

    def progress_cb(stage, data):
        progress_events.append(stage)

    result = worker.refresh_profiles(profiles, progress_cb=progress_cb)

    assert captured_calls["instagram"] == [["user1", "user2", "user3"], ["user4", "user5", "user6"], ["user7"]]
    assert isinstance(result["summary"], dict)
    assert result["summary"]["total"] == 7
    assert all(item["success"] for item in result["results"])
    assert "chunk_started" in progress_events
    assert "chunk_finished" in progress_events
