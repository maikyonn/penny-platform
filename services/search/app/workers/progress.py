"""Helpers for emitting progress updates from RQ jobs."""
from __future__ import annotations

import json
import time
from typing import Any, Callable, Dict

from redis import Redis
from rq import get_current_job


def _now_ms() -> int:
    """Return unix epoch milliseconds."""
    return int(time.time() * 1000)


class ProgressEmitter:
    """Publish progress events to job.meta and optional Redis pub/sub."""

    def __init__(self, redis_conn: Redis, channel_prefix: str = "jobs") -> None:
        job = get_current_job()
        if job is None:
            raise RuntimeError("ProgressEmitter must be constructed within an RQ job")

        self.job = job
        self.redis = redis_conn
        self.channel = f"{channel_prefix}:{job.id}:events"
        self._events = self.job.meta.get("events", [])

    def emit(self, stage: str, data: Dict[str, Any]) -> None:
        """Append an event and best-effort publish via Redis."""
        event = {"ts": _now_ms(), "stage": stage, "data": data}
        self._events.append(event)
        self.job.meta["events"] = self._events
        self.job.save_meta()

        try:
            self.redis.publish(self.channel, json.dumps(event))
        except Exception:
            # Pub/sub failures should not break the job; polling endpoint will still work.
            pass

    def callback(self) -> Callable[[str, Dict[str, Any]], None]:
        """Return a progress callback compatible with pipeline progress_cb signature."""
        return lambda stage, payload: self.emit(stage, payload)
