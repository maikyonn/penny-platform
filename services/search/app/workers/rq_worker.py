"""Entrypoint for launching background workers."""
from __future__ import annotations

from redis import Redis
from rq import SimpleWorker

from app.config import settings
from app.dependencies import init_search_engine

listen = settings.RQ_WORKER_QUEUES or ["default"]
redis_conn = Redis.from_url(settings.REDIS_URL)


def _prewarm_search_engine() -> None:
    """Load the LanceDB handle before the first job runs (outside job timeout)."""
    try:
        ok = init_search_engine()
        print(f"[RQ Worker] Pre-init search engine: {ok}")
    except Exception as exc:  # pragma: no cover - defensive logging
        print(f"[RQ Worker] Pre-init failed: {exc}")


def main() -> None:
    # Import job module so its callables register with RQ
    import app.workers.rq_jobs  # noqa: F401

    _prewarm_search_engine()
    # SimpleWorker runs jobs in-process to avoid fork/exec overhead and Arrow instability.
    worker = SimpleWorker(listen, connection=redis_conn)
    worker.work()


if __name__ == "__main__":
    main()
