"""Stage-level tests for the creator discovery pipeline using recorded fixtures."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.pipeline.orchestrator import CreatorDiscoveryPipeline
from app.core.pipeline.stages.brightdata_stage import BrightDataStage
from app.core.pipeline.stages.llm_fit_stage import LLMFitStage
from app.core.pipeline.stages.rerank_stage import RerankStage
from app.core.pipeline.stages.search_stage import SearchStage
from app.core.post_filter.profile_fit import ProfileFitAssessor
from app.models.search import SearchPipelineRequest, SearchRequest
from tests.conftest import FixtureBrightDataServiceClient, StubRerankClient


@pytest.fixture(scope="module")
def stage_samples() -> dict:
    """Load recorded stage samples generated from live pipeline data."""

    path = Path(__file__).resolve().parents[1] / "fixtures" / "pipeline" / "stage_samples.json"
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _search_profiles(engine, query: str, limit: int = 5):
    stage = SearchStage(engine)
    return stage.run([], query=query, method="hybrid", limit=limit).profiles


def test_search_stage_matches_recorded_accounts(engine, stage_samples):
    profiles = _search_profiles(engine, stage_samples["query"])
    assert [profile.account for profile in profiles] == stage_samples["search_accounts"]


def test_rerank_stage_reorders_results(engine, stage_samples):
    base_profiles = _search_profiles(engine, stage_samples["query"])
    stage = RerankStage(StubRerankClient())
    reranked = stage.run(
        base_profiles,
        query=stage_samples["query"],
        mode="bio+posts",
        top_k=2,
    )
    assert [profile.account for profile in reranked.profiles] == stage_samples["rerank_accounts"]


def test_brightdata_stage_enrichment(engine, stage_samples, stub_brightdata):
    base_profiles = _search_profiles(engine, stage_samples["query"])
    reranked = RerankStage(StubRerankClient()).run(
        base_profiles,
        query=stage_samples["query"],
        mode="bio+posts",
        top_k=2,
    )
    stage = BrightDataStage(client=FixtureBrightDataServiceClient())
    enriched = stage.run(reranked.profiles)

    assert enriched.debug.get("success_keys") == stage_samples["brightdata"]["success_keys"]
    follower_snapshot = {profile.account: profile.followers for profile in enriched.profiles}
    assert follower_snapshot == stage_samples["brightdata"]["follower_counts"]


def test_llm_stage_scores(engine, stage_samples, stub_brightdata, stub_profile_fit):
    base_profiles = _search_profiles(engine, stage_samples["query"])
    reranked = RerankStage(StubRerankClient()).run(
        base_profiles,
        query=stage_samples["query"],
        mode="bio+posts",
        top_k=2,
    )
    enriched = BrightDataStage(client=FixtureBrightDataServiceClient()).run(reranked.profiles)

    stage = LLMFitStage(ProfileFitAssessor)
    scored = stage.run(
        enriched.profiles,
        business_fit_query="Eco friendly beauty brand",
        max_posts=3,
        concurrency=2,
        model="stub-model",
        verbosity="medium",
    )

    actual_scores = {profile.account: profile.fit_score for profile in scored.profiles}
    assert actual_scores == stage_samples["llm_scores"]


def test_creator_discovery_pipeline_matches_fixture(engine, stage_samples, stub_profile_fit):
    pipeline = CreatorDiscoveryPipeline(
        search_engine=engine,
        rerank_client=StubRerankClient(),
        brightdata_client=FixtureBrightDataServiceClient(),
        assessor_factory=ProfileFitAssessor,
    )

    events: list[str] = []

    def progress(stage: str, _payload: dict) -> None:
        events.append(stage)

    results, debug = pipeline.run(
        request=SearchPipelineRequest(
            search=SearchRequest(query=stage_samples["query"], method="hybrid", limit=5),
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

    assert [profile.account for profile in results] == stage_samples["pipeline"]["final_accounts"]
    assert events == stage_samples["pipeline"]["events"]
    assert len(debug.get("brightdata_results") or []) == len(stage_samples["brightdata"]["follower_counts"])
