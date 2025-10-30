"""Reranker proxy endpoints."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException

from app.config import settings
from app.core import DeepInfraReranker
from app.models import RerankEntry, RerankRequest, RerankResponse

router = APIRouter()


@router.post("/rerank", response_model=RerankResponse)
async def rerank_documents(request: RerankRequest) -> RerankResponse:
    if not settings.RERANKER_ENABLED:
        raise HTTPException(status_code=503, detail="Reranker disabled in configuration")

    reranker = DeepInfraReranker()
    docs = request.documents
    if request.top_k:
        docs = docs[: request.top_k]

    try:
        ranking = await reranker.rerank_async(request.query, docs)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Rerank call failed: {exc}") from exc
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=f"Unexpected rerank error: {exc}") from exc

    entries = [RerankEntry(index=idx, score=score) for idx, score in ranking]
    return RerankResponse(
        success=True,
        ranking=entries,
        top_k=request.top_k or len(docs),
        count=len(entries),
    )
