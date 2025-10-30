"""Async job endpoints backed by Redis/RQ."""
from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from redis.asyncio import from_url as redis_from_url
from rq import Queue
from rq.job import Job

from app.config import settings
from app.models.search import SearchPipelineRequest, SearchRequest
from app.queues import get_queue, redis_conn

HEARTBEAT_INTERVAL = 15

router = APIRouter()


def _fetch_job(job_id: str) -> Job:
    try:
        return Job.fetch(job_id, connection=redis_conn)
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=404, detail="Job not found") from exc


@router.post("/search/async")
async def search_async(request: SearchRequest) -> Dict[str, Any]:
    queue: Queue = get_queue("search")
    job = queue.enqueue("app.workers.rq_jobs.run_search_job", request.model_dump())
    return {"job_id": job.id, "queue": queue.name}


@router.post("/pipeline/async")
async def pipeline_async(request: SearchPipelineRequest) -> Dict[str, Any]:
    queue: Queue = get_queue("pipeline")
    job = queue.enqueue("app.workers.rq_jobs.run_pipeline_job", request.model_dump())
    return {"job_id": job.id, "queue": queue.name}


@router.get("/job/{job_id}")
async def job_status(job_id: str) -> Dict[str, Any]:
    job = _fetch_job(job_id)
    meta = job.meta or {}
    payload: Dict[str, Any] = {
        "job_id": job.id,
        "status": job.get_status(),
        "enqueued_at": getattr(job, "enqueued_at", None),
        "started_at": getattr(job, "started_at", None),
        "ended_at": getattr(job, "ended_at", None),
        "events": meta.get("events") or [],
    }
    if job.is_finished:
        payload["result"] = job.result
    if job.is_failed:
        payload["error"] = str(job.exc_info or "Job failed")
    return payload


async def _event_stream(job_id: str) -> AsyncIterator[str]:
    channel = f"{settings.RQ_EVENTS_CHANNEL_PREFIX}:{job_id}:events"
    if settings.RQ_PUBSUB_EVENTS:
        client = redis_from_url(settings.REDIS_URL)
        pubsub = client.pubsub()
        await pubsub.subscribe(channel)
        try:
            snapshot = await job_status(job_id)
            yield f"data: {json.dumps({'stage': 'snapshot', 'data': {'events': snapshot.get('events', [])}})}\n\n"

            async for message in pubsub.listen():
                if message is None or message.get("type") != "message":
                    continue
                data = message.get("data")
                if isinstance(data, (bytes, bytearray)):
                    data = data.decode("utf-8")
                try:
                    event = json.loads(data)
                except Exception:
                    continue
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("stage") == "completed":
                    break
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            await client.close()
    else:
        seen = 0
        while True:
            snapshot = await job_status(job_id)
            events = snapshot.get("events", [])
            while seen < len(events):
                yield f"data: {json.dumps(events[seen])}\n\n"
                seen += 1
            if snapshot.get("status") in {"finished", "failed"}:
                break
            await asyncio.sleep(1.0)


@router.get("/job/{job_id}/stream")
async def stream_job(job_id: str):
    _fetch_job(job_id)  # Raises HTTPException if not found
    base_stream = _event_stream(job_id)
    iterator = base_stream.__aiter__()

    async def heartbeat_stream():
        while True:
            try:
                event = await asyncio.wait_for(iterator.__anext__(), timeout=HEARTBEAT_INTERVAL)
            except StopAsyncIteration:
                break
            except asyncio.TimeoutError:
                yield ": heartbeat\n\n"
                continue
            yield event

    return StreamingResponse(
        heartbeat_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
