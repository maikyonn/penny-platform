"""Thin DeepInfra reranker client shared across services."""
from __future__ import annotations

from typing import Any, List, Optional, Tuple

import httpx

from app.config import settings


class DeepInfraReranker:
    """Call DeepInfra's Qwen3-Reranker (or compatible) endpoint."""

    def __init__(
        self,
        *,
        endpoint: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: int = 30,
    ) -> None:
        resolved_endpoint = (str(endpoint or settings.RERANKER_ENDPOINT or "")).rstrip("/")
        secrets_api_key = settings.DEEPINFRA_API_KEY.get_secret_value() if settings.DEEPINFRA_API_KEY else None
        resolved_api_key = api_key or secrets_api_key

        if not resolved_endpoint:
            raise RuntimeError("Reranker endpoint is not configured")
        if not resolved_api_key:
            raise RuntimeError("DEEPINFRA_API_KEY must be set for reranking")

        self.endpoint = resolved_endpoint
        self.api_key = resolved_api_key
        self.timeout = timeout

    def rerank(self, query: str, documents: List[str]) -> List[Tuple[int, float]]:
        """Return (index, score) pairs sorted high-to-low (synchronous wrapper)."""
        if not query or not documents:
            return []

        payload = {"queries": [query], "documents": documents}
        headers = self._headers()
        with httpx.Client(timeout=self.timeout, follow_redirects=False) as client:
            response = client.post(self.endpoint, json=payload, headers=headers)
            response.raise_for_status()
        return self._parse_response(response.json())

    async def rerank_async(self, query: str, documents: List[str]) -> List[Tuple[int, float]]:
        """Async variant for use inside FastAPI handlers."""
        if not query or not documents:
            return []

        payload = {"queries": [query], "documents": documents}
        headers = self._headers()
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=False) as client:
            response = await client.post(self.endpoint, json=payload, headers=headers)
        response.raise_for_status()
        return self._parse_response(response.json())

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _parse_response(data: Any) -> List[Tuple[int, float]]:
        candidates = None
        if isinstance(data, dict):
            for key in ("results", "data", "scores", "output"):
                if key in data:
                    candidates = data[key]
                    break
        else:
            candidates = data

        ranking: List[Tuple[int, float]] = []
        if isinstance(candidates, list):
            if candidates and isinstance(candidates[0], dict) and "score" in candidates[0]:
                for idx, item in enumerate(candidates):
                    ranking.append((int(item.get("index", idx)), float(item.get("score", 0.0))))
            elif candidates and isinstance(candidates[0], list) and len(candidates[0]) == 2:
                ranking = [(int(idx), float(score)) for idx, score in candidates]
            elif all(isinstance(x, (int, float)) for x in candidates):
                ranking = [(idx, float(score)) for idx, score in enumerate(candidates)]

        ranking.sort(key=lambda item: item[1], reverse=True)
        return ranking


__all__ = ["DeepInfraReranker"]
