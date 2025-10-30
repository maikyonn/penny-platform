"""Async job orchestration for BrightData refresh operations."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional
from uuid import uuid4

from app.config import settings
from app.core import BrightDataClient
from app.models import ProfileHandle
from app.workers import ImageRefreshWorker


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


@dataclass
class JobEntry:
    job_id: str
    payload: Dict[str, Any]
    status: str = "queued"
    queued_at: str = field(default_factory=_ts)
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    event: asyncio.Event = field(default_factory=asyncio.Event)
    events: List[Dict[str, Any]] = field(default_factory=list)
    subscribers: List[asyncio.Queue] = field(default_factory=list)

    def snapshot(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "task": self.payload.get("task"),
            "payload": {k: v for k, v in self.payload.items() if k != "task"},
            "queued_at": self.queued_at,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "result": self.result,
            "error": self.error,
            "status": self.status,
        }


class ImageRefreshService:
    """Coordinates BrightData refresh operations inside the FastAPI process."""

    def __init__(self) -> None:
        self._jobs: Dict[str, JobEntry] = {}
        self._lock = asyncio.Lock()
        max_concurrency = settings.BRIGHTDATA_MAX_CONCURRENCY or 0
        self._semaphore: Optional[asyncio.Semaphore]
        if max_concurrency <= 0:
            self._semaphore = None
        else:
            self._semaphore = asyncio.Semaphore(max(1, max_concurrency))
        self._immediate = settings.BRIGHTDATA_JOBS_IMMEDIATE
        self._init_error: Optional[str] = None
        self._jobs_ttl_seconds = max(settings.BRIGHTDATA_JOB_TIMEOUT or 600, 3600)
        self._jobs_max = 1000
        self._event_history_limit = 100
        self._worker: Optional[ImageRefreshWorker] = None
        try:
            self._worker = ImageRefreshWorker()
            BrightDataClient()
        except Exception as exc:  # pylint: disable=broad-except
            self._init_error = str(exc)
            self._worker = None

    @property
    def is_available(self) -> bool:
        return self._init_error is None

    async def enqueue_refresh_job(self, profiles: List[ProfileHandle]) -> str:
        self._ensure_available()
        serialized = [profile.model_dump() for profile in profiles]
        job_id = str(uuid4())
        entry = JobEntry(job_id=job_id, payload={"task": "refresh_profiles", "profiles": serialized})
        async with self._lock:
            self._jobs[job_id] = entry

        await self._emit_event(entry, "queued")

        if self._immediate:
            await self._run_job(job_id, serialized)
        else:
            asyncio.create_task(self._run_job(job_id, serialized))
        return job_id

    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        async with self._lock:
            entry = self._jobs.get(job_id)
            return entry.snapshot() if entry else None

    async def get_active_jobs_count(self) -> int:
        async with self._lock:
            return sum(1 for entry in self._jobs.values() if entry.status in {"queued", "running"})

    async def wait_for_job(self, job_id: str, timeout: float = 120.0) -> Optional[Dict[str, Any]]:
        async with self._lock:
            entry = self._jobs.get(job_id)
        if entry is None:
            return None
        try:
            await asyncio.wait_for(entry.event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            return entry.snapshot()
        return entry.snapshot()

    async def fetch_single_profile(self, username: str, platform: str) -> Dict[str, Any]:
        self._ensure_available()
        if self._worker is None:
            raise RuntimeError("Worker not initialized")
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._worker.fetch_single_profile(username=username, platform=platform))

    async def stream_job_events(self, job_id: str) -> Optional[AsyncIterator[Dict[str, Any]]]:
        async with self._lock:
            entry = self._jobs.get(job_id)
            if entry is None:
                return None
            history = list(entry.events)
            terminal = entry.status in {"finished", "failed"}
            queue: Optional[asyncio.Queue] = None
            if not terminal:
                queue = asyncio.Queue()
                entry.subscribers.append(queue)

        async def iterator():
            try:
                for event in history:
                    yield event
                if terminal:
                    return
                assert queue is not None
                while True:
                    event = await queue.get()
                    if event is None:
                        break
                    yield event
            finally:
                if queue is not None:
                    async with self._lock:
                        if queue in entry.subscribers:
                            entry.subscribers.remove(queue)

        return iterator()

    def _ensure_available(self) -> None:
        if not self.is_available:
            raise RuntimeError(self._init_error or "BrightData client not configured")

    async def _run_job(self, job_id: str, profiles: List[Dict[str, Any]]) -> None:
        async with self._lock:
            entry = self._jobs.get(job_id)
        if entry is None:
            return

        loop = asyncio.get_running_loop()

        def progress(stage: str, data: Dict[str, Any]) -> None:
            try:
                asyncio.run_coroutine_threadsafe(self._emit_event(entry, stage, data), loop)
            except RuntimeError:
                # Event loop closed; ignore late progress events.
                pass

        async def execute() -> None:
            await self._mark_started(entry)
            try:
                if self._worker is None:
                    raise RuntimeError("Worker not initialized")
                result = await loop.run_in_executor(
                    None,
                    lambda: self._worker.refresh_profiles(profiles, progress_cb=progress),
                )
            except Exception as exc:  # pylint: disable=broad-except
                await self._mark_failed(entry, str(exc))
            else:
                await self._mark_finished(entry, result)

        if self._semaphore is None:
            await execute()
        else:
            async with self._semaphore:
                await execute()

    async def _mark_started(self, entry: JobEntry) -> None:
        async with self._lock:
            entry.status = "running"
            entry.started_at = _ts()
        await self._emit_event(entry, "started")

    async def _mark_finished(self, entry: JobEntry, result: Dict[str, Any]) -> None:
        async with self._lock:
            entry.status = "finished"
            entry.result = result
            entry.ended_at = _ts()
            entry.error = None
            entry.event.set()
        await self._emit_event(entry, "finished")
        await self._close_subscribers(entry)

    async def _mark_failed(self, entry: JobEntry, error: str) -> None:
        async with self._lock:
            entry.status = "failed"
            entry.error = error
            entry.ended_at = _ts()
            entry.event.set()
        await self._emit_event(entry, "failed", {"error": error})
        await self._close_subscribers(entry)

    async def _emit_event(self, entry: JobEntry, event_type: str, data: Optional[Dict[str, Any]] = None) -> None:
        event_payload = {
            "event": event_type,
            "timestamp": _ts(),
            "job": entry.snapshot(),
        }
        if data:
            event_payload["data"] = data

        async with self._lock:
            entry.events.append(event_payload)
            if len(entry.events) > self._event_history_limit:
                entry.events = entry.events[-self._event_history_limit :]
            subscribers = list(entry.subscribers)

        for queue in subscribers:
            await queue.put(event_payload)
        await self._cleanup_jobs()

    async def _close_subscribers(self, entry: JobEntry) -> None:
        async with self._lock:
            subscribers = list(entry.subscribers)
            entry.subscribers.clear()
        for queue in subscribers:
            await queue.put(None)

    async def _cleanup_jobs(self) -> None:
        now = datetime.now(timezone.utc)
        async with self._lock:
            expired: List[str] = []
            for job_id, entry in self._jobs.items():
                if not entry.ended_at:
                    continue
                ended = _parse_ts(entry.ended_at)
                if ended and (now - ended).total_seconds() > self._jobs_ttl_seconds:
                    expired.append(job_id)

            for job_id in expired:
                self._jobs.pop(job_id, None)

            overflow = max(0, len(self._jobs) - self._jobs_max)
            if overflow <= 0:
                return

            removable = sorted(
                (entry for entry in self._jobs.values() if entry.status in {"finished", "failed"}),
                key=lambda item: (item.ended_at or item.queued_at),
            )
            for entry in removable:
                if overflow <= 0:
                    break
                if entry.job_id in self._jobs:
                    self._jobs.pop(entry.job_id, None)
                    overflow -= 1


__all__ = ["ImageRefreshService"]
