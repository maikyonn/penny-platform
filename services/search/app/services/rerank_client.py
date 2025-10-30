"""HTTP client for the penny-bd rerank endpoint."""
from __future__ import annotations

from typing import List, Tuple

import requests

from app.config import settings


class RerankError(RuntimeError):
    """Raised when the rerank service call fails."""


class RerankClient:
    """Lightweight wrapper around the shared rerank REST endpoint."""

    def __init__(self) -> None:
        base_url = str(settings.RERANKER_SERVICE_URL or "").rstrip("/")
        if not base_url:
            raise RerankError("RERANKER_SERVICE_URL is not configured")
        self.url = base_url
        self._session = requests.Session()

    def rerank(self, query: str, documents: List[str], top_k: int) -> List[Tuple[int, float]]:
        payload = {
            "query": query,
            "documents": documents,
            "top_k": top_k,
        }
        response = self._session.post(self.url, json=payload, timeout=60)
        if not response.ok:
            raise RerankError(f"Rerank request failed ({response.status_code}): {response.text}")
        data = response.json()
        entries = data.get("ranking") or []
        return [(int(item["index"]), float(item["score"])) for item in entries]
