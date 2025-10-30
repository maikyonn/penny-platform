#!/usr/bin/env python3
"""Generate stage fixture data by running the pipeline against fixture-backed stubs.

The script exercises the search → rerank → BrightData → LLM stages using the
same stub clients that power the unit tests. The resulting JSON snapshot is
written to ``tests/fixtures/pipeline/stage_samples.json`` by default.

Usage:
    python tests/scripts/generate_stage_fixtures.py [--output path]
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

import lancedb
import numpy as np
import pandas as pd
from pydantic import SecretStr

# Ensure the repository root is importable
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import settings  # noqa: E402
from app.core.pipeline.orchestrator import CreatorDiscoveryPipeline  # noqa: E402
from app.core.pipeline.stages.brightdata_stage import BrightDataStage  # noqa: E402
from app.core.pipeline.stages.llm_fit_stage import LLMFitStage  # noqa: E402
from app.core.pipeline.stages.rerank_stage import RerankStage  # noqa: E402
from app.core.pipeline.stages.search_stage import SearchStage  # noqa: E402
from app.core.post_filter.profile_fit import ProfileFitAssessor  # noqa: E402
from app.models.search import SearchPipelineRequest, SearchRequest  # noqa: E402
from tests.conftest import (  # noqa: E402
    FixtureBrightDataServiceClient,
    StubEmbedder,
    StubRerankClient,
    _stub_openai_call,
)


def _seed_lancedb(tmpdir: str) -> None:
    """Seed a temporary LanceDB table with deterministic rows."""

    db = lancedb.connect(tmpdir)
    table = settings.TABLE_NAME or "influencer_facets"
    rng = np.random.default_rng(42)
    rows = pd.DataFrame(
        [
            {
                "content_type": "profile",
                "lance_db_id": "alice_id",
                "username": "alice",
                "display_name": "Alice",
                "profile_url": "https://instagram.com/alice",
                "followers": 10400,
                "engagement_rate": 0.052,
                "biography": "Skincare nerd. Ingredient-focused reviews.",
                "embedding": rng.random(8).tolist(),
                "text": "skincare ingredients beauty reviews",
            },
            {
                "content_type": "profile",
                "lance_db_id": "bob_id",
                "username": "bob_warning",
                "display_name": "Bob",
                "profile_url": "https://instagram.com/bob_warning",
                "followers": 8200,
                "engagement_rate": 0.018,
                "biography": "Comedy skits.",
                "embedding": rng.random(8).tolist(),
                "text": "comedy jokes",
            },
            {
                "content_type": "profile",
                "lance_db_id": "carol_id",
                "username": "carol",
                "display_name": "Carol",
                "profile_url": "https://instagram.com/carol",
                "followers": 25000,
                "engagement_rate": 0.031,
                "biography": "Daily routines, gym, and recovery.",
                "embedding": rng.random(8).tolist(),
                "text": "lifestyle gym routines",
            },
        ]
    )
    if table in db.table_names():
        db.drop_table(table)
    db.create_table(table, data=rows)


def main(output: Path) -> None:
    os.environ.setdefault("BRIGHTDATA_SERVICE_URL", "http://brightdata.local")
    os.environ.setdefault("RERANKER_SERVICE_URL", "http://rerank.local")
    os.environ.setdefault("OPENAI_API_KEY", "test-key")
    settings.OPENAI_API_KEY = SecretStr(os.environ["OPENAI_API_KEY"])

    tmpdir = tempfile.mkdtemp(prefix="lancedb_")
    settings.DB_PATH = tmpdir
    _seed_lancedb(tmpdir)

    from app.core.search_engine import CreatorSearchEngine

    engine = CreatorSearchEngine(tmpdir)
    engine.engine.embedder = StubEmbedder()

    query = "skincare routine"

    search_stage = SearchStage(engine)
    search_result = search_stage.run([], query=query, method="hybrid", limit=5)

    rerank_stage = RerankStage(StubRerankClient())
    rerank_result = rerank_stage.run(search_result.profiles, query=query, mode="bio+posts", top_k=2)

    bright_stage = BrightDataStage(client=FixtureBrightDataServiceClient())
    bright_result = bright_stage.run(rerank_result.profiles)

    ProfileFitAssessor._call_openai = staticmethod(_stub_openai_call)
    llm_stage = LLMFitStage(ProfileFitAssessor)
    llm_result = llm_stage.run(
        bright_result.profiles,
        business_fit_query="Eco friendly beauty brand",
        max_posts=3,
        concurrency=2,
        model="stub-model",
        verbosity="medium",
    )

    pipeline = CreatorDiscoveryPipeline(
        search_engine=engine,
        rerank_client=StubRerankClient(),
        brightdata_client=FixtureBrightDataServiceClient(),
        assessor_factory=ProfileFitAssessor,
    )

    events: list[str] = []

    def progress(stage: str, _payload: dict) -> None:
        events.append(stage)

    ProfileFitAssessor._call_openai = staticmethod(_stub_openai_call)
    pipeline_profiles, pipeline_debug = pipeline.run(
        SearchPipelineRequest(
            search=SearchRequest(query=query, method="hybrid", limit=5),
            run_rerank=True,
            run_brightdata=True,
            run_llm=True,
            business_fit_query="Eco friendly beauty brand",
            max_posts=3,
            concurrency=2,
            model="stub-model",
            verbosity="medium",
        ),
        progress_cb=progress,
    )

    payload = {
        "query": query,
        "search_accounts": [profile.account for profile in search_result.profiles],
        "rerank_accounts": [profile.account for profile in rerank_result.profiles],
        "brightdata": {
            "success_keys": bright_result.debug.get("success_keys"),
            "follower_counts": {profile.account: profile.followers for profile in bright_result.profiles},
        },
        "llm_scores": {profile.account: profile.fit_score for profile in llm_result.profiles},
        "pipeline": {
            "final_accounts": [profile.account for profile in pipeline_profiles],
            "events": events,
        },
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")

    shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "tests" / "fixtures" / "pipeline" / "stage_samples.json",
        help="Path to write the stage samples JSON file.",
    )
    args = parser.parse_args()
    main(args.output)
