#!/usr/bin/env python3
"""
Record a full search → rerank → BrightData → LLM pipeline run and save fixture JSON files.

Usage:
    python tests/scripts/record_pipeline_samples.py

Environment variables:
    PIPELINE_SAMPLE_QUERY   Query string (default: "sustainable beauty creators")
    PIPELINE_SAMPLE_LIMIT   Max profiles to retrieve (default: 100)
    PIPELINE_SAMPLE_BUSINESS_FIT  Business fit brief for LLM (default provided below)

Requires that the search engine is configured with access to LanceDB, BrightData,
the reranker service, and OpenAI/DeepInfra credentials.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Dict, Any

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.api.serializers import serialize_creator_profile
from app.core.search_engine import FastAPISearchEngine
from app.models.search import SearchPipelineRequest, SearchRequest
from app.services.pipeline import SearchPipelineService
from app.config import settings

DEFAULT_QUERY = "sustainable beauty creators"
DEFAULT_BUSINESS_FIT = (
    "Eco-friendly skincare brand seeking authentic Gen Z creators who focus on ingredient education."
)
DEFAULT_LIMIT = 100

FIXTURE_ROOT = os.path.join(os.path.dirname(__file__), "..", "fixtures")


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def save_json(path: str, payload: Dict[str, Any]) -> None:
    ensure_dir(os.path.dirname(path))
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


def record_pipeline() -> None:
    query = os.getenv("PIPELINE_SAMPLE_QUERY", DEFAULT_QUERY)
    limit = int(os.getenv("PIPELINE_SAMPLE_LIMIT", DEFAULT_LIMIT))
    business_fit = os.getenv("PIPELINE_SAMPLE_BUSINESS_FIT", DEFAULT_BUSINESS_FIT)

    db_path = settings.DB_PATH
    if not db_path:
        raise RuntimeError("settings.DB_PATH is not configured. Set DB_PATH before running the recorder.")
    engine = FastAPISearchEngine(db_path=db_path)
    service = SearchPipelineService(engine)

    events = []

    def progress_cb(stage: str, data: Dict[str, Any]) -> None:
        events.append({"stage": stage, "data": data})

    request = SearchPipelineRequest(
        search=SearchRequest(query=query, method="hybrid", limit=limit),
        run_rerank=True,
        run_brightdata=True,
        run_llm=True,
        business_fit_query=business_fit,
        max_profiles=limit,
    )

    results, debug = service.run_pipeline(request, progress_cb=progress_cb)

    fixture_data = {
        "query": query,
        "limit": limit,
        "results": [serialize_creator_profile(result) for result in results],
        "brightdata_results": debug.get("brightdata_results") or [],
        "profile_fit": debug.get("profile_fit") or [],
        "events": events,
    }

    save_json(os.path.join(FIXTURE_ROOT, "pipeline", "pipeline_run.json"), fixture_data)
    print("Saved pipeline fixtures to tests/fixtures/pipeline/pipeline_run.json")

    # Save per-profile BrightData and profile fit results for stubs.
    for record in fixture_data["brightdata_results"]:
        account = record.get("account") or record.get("username") or "unknown"
        fname = f"{account}.json"
        save_json(os.path.join(FIXTURE_ROOT, "brightdata", fname), {"records": [record]})

    for entry in fixture_data["profile_fit"]:
        account = entry.get("account") or "unknown"
        fname = f"fit_{account}.json"
        save_json(os.path.join(FIXTURE_ROOT, "openai", fname), entry)

    print("Wrote BrightData and profile-fit fixtures.")


if __name__ == "__main__":
    record_pipeline()
