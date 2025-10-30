"""Pydantic models for reranking requests."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class RerankRequest(BaseModel):
    query: str = Field(..., min_length=1)
    documents: List[str] = Field(..., min_length=1)
    top_k: Optional[int] = Field(default=None, ge=1)


class RerankEntry(BaseModel):
    index: int
    score: float


class RerankResponse(BaseModel):
    success: bool
    ranking: List[RerankEntry]
    top_k: int
    count: int
