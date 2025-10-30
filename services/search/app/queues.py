"""RQ queue helpers shared across the API process."""
from __future__ import annotations

from typing import Dict

from redis import Redis
from rq import Queue

from app.config import settings

# Shared Redis connection created once per process
redis_conn = Redis.from_url(settings.REDIS_URL)

DEFAULT_TIMEOUT = int(settings.RQ_JOB_TIMEOUT or 900)
RESULT_TTL = int(settings.RQ_RESULT_TTL or 3600)

_queues: Dict[str, Queue] = {}

for name in (settings.RQ_WORKER_QUEUES or ["default"]):
    _queues[name] = Queue(
        name,
        connection=redis_conn,
        default_timeout=DEFAULT_TIMEOUT,
        result_ttl=RESULT_TTL,
    )


def get_queue(name: str = "default") -> Queue:
    """Return configured queue; fall back to default."""
    return _queues.get(name, _queues["default"])
