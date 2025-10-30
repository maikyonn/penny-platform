"""Integration-style sanity check for the DeepInfra reranker."""
from __future__ import annotations

from typing import List

import pytest

from app.config import settings
from app.core.rerank import DeepInfraReranker


SAMPLE_QUERY = "eco-friendly skincare brand looking for Gen Z creators"
SAMPLE_DOCS: List[str] = [
    "Daily routines and tips for sustainable beauty, showcasing cruelty-free skincare.",
    "High-intensity workout plans and protein shake reviews for athletes.",
    "Sneaker drops, streetwear hauls, and urban fashion inspiration.",
    "Zero-waste lifestyle ideas, composting, and eco home transformations.",
]


@pytest.mark.integration
def test_sample_rerank_returns_scores():
    """Ensure the reranker returns at least one scored document for a real query."""
    if not settings.DEEPINFRA_API_KEY:
        pytest.skip("DEEPINFRA_API_KEY not configured; skipping live reranker call")

    reranker = DeepInfraReranker()
    ranking = reranker.rerank(SAMPLE_QUERY, SAMPLE_DOCS)

    assert ranking, "Expected reranker to return at least one result"
    indices = [idx for idx, _ in ranking]
    assert all(0 <= idx < len(SAMPLE_DOCS) for idx in indices)
