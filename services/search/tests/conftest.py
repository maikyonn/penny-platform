"""Pytest configuration and shared fixtures for the DIME-AI search API test suite."""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
from typing import Any, Callable, Dict, Iterable, List, Optional

import pandas as pd
import pytest
from pydantic import SecretStr
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.config import settings


# ---------------------------------------------------------------------------
# Global fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _stable_env(monkeypatch):
    """Ensure tests run with deterministic environment defaults."""

    monkeypatch.setenv("RQ_PUBSUB_EVENTS", "0")  # disable Redis pub/sub during unit tests
    monkeypatch.setenv("BRIGHTDATA_SERVICE_URL", "http://brightdata.local")
    monkeypatch.setenv("RERANKER_SERVICE_URL", "http://rerank.local")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    settings.OPENAI_API_KEY = SecretStr("test-key")
    yield


# ---------------------------------------------------------------------------
# Fixture-backed stubs
# ---------------------------------------------------------------------------

FIXTURE_ROOT = os.path.join(os.path.dirname(__file__), "fixtures")


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


class FixtureBrightDataServiceClient:
    """BrightData client stub backed by JSON fixtures."""

    def __init__(self) -> None:
        self._root = os.path.join(FIXTURE_ROOT, "brightdata")

    def fetch_profiles(
        self,
        profile_urls: Iterable[str],
        *,
        progress_cb: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> pd.DataFrame:
        records: List[Dict[str, Any]] = []
        for url in profile_urls:
            key = self._fixture_key(url)
            path = os.path.join(self._root, f"{key}.json")
            if os.path.exists(path):
                payload = _load_json(path)
                records.extend(payload.get("records") or [])
            else:
                records.append(
                    {
                        "profile_url": url,
                        "warning": "missing_fixture",
                        "warning_code": "missing_fixture",
                    }
                )
        return pd.DataFrame.from_records(records) if records else pd.DataFrame()

    def fetch_profile_by_url(self, profile_url: str) -> Dict[str, Any]:
        key = self._fixture_key(profile_url)
        path = os.path.join(self._root, f"{key}.json")
        if os.path.exists(path):
            return {"result": _load_json(path)}
        return {
            "result": {
                "records": [
                    {
                        "profile_url": profile_url,
                        "warning": "missing_fixture",
                        "warning_code": "missing_fixture",
                    }
                ]
            }
        }

    @staticmethod
    def _fixture_key(url: str) -> str:
        lowered = (url or "").strip().lower()
        if "instagram.com" in lowered:
            handle = lowered.rstrip("/").split("/")[-1]
            return f"instagram_{handle.lstrip('@')}"
        if "tiktok.com" in lowered:
            handle = lowered.split("@")[-1]
            return f"tiktok_{handle}"
        return "unknown"


def _stub_openai_call(prompt: str) -> str:
    """Stubbed OpenAI call using recorded responses."""

    root = os.path.join(FIXTURE_ROOT, "openai")
    mapping = {
        "instagram.com/alice": "fit_instagram_alice.json",
        "instagram.com/carol": "fit_instagram_carol.json",
    }
    for needle, filename in mapping.items():
        if needle in prompt:
            path = os.path.join(root, filename)
            if os.path.exists(path):
                data = _load_json(path)
                return json.dumps(data)
    return json.dumps({"score": 5, "rationale": "default stub"})


class StubEmbedder:
    """Simple DeepInfra embedder stub returning normalized vectors from fixtures."""

    def __init__(self) -> None:
        self._root = os.path.join(FIXTURE_ROOT, "deepinfra")

    def embed(self, text: str) -> np.ndarray:
        key = "beauty"
        lowered = (text or "").lower()
        if "lifestyle" in lowered or "routine" in lowered:
            key = "lifestyle"
        path = os.path.join(self._root, f"embed_{key}.json")
        if os.path.exists(path):
            data = _load_json(path)
            vec = np.asarray(data["embedding"], dtype=np.float32)
        else:
            vec = np.ones(8, dtype=np.float32)
        norm = np.linalg.norm(vec) or 1.0
        return vec / norm


class StubRerankClient:
    """Deterministic rerank client stub."""

    def __init__(self) -> None:
        self._path = os.path.join(FIXTURE_ROOT, "rerank", "beauty_q_ranking.json")

    def rerank(self, query: str, documents: List[str], top_k: int):
        if os.path.exists(self._path):
            data = _load_json(self._path)
            ranking = [(int(item["index"]), float(item["score"])) for item in data]
            return ranking[:top_k]
        return [(idx, float(top_k - idx)) for idx in range(min(top_k, len(documents)))]


# ---------------------------------------------------------------------------
# LanceDB utilities
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def lancedb_tmpdir():
    """Temporary LanceDB directory that lives for the test session."""

    tmpdir = tempfile.mkdtemp(prefix="lancedb_")
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture(scope="session")
def seed_lancedb(lancedb_tmpdir):
    """Seed a small LanceDB table for lexical/vector search tests."""

    import lancedb

    db = lancedb.connect(lancedb_tmpdir)
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
    table = settings.TABLE_NAME or "influencer_facets"
    db.create_table(table, data=rows)
    return lancedb_tmpdir


# ---------------------------------------------------------------------------
# Engine fixture with stubs applied
# ---------------------------------------------------------------------------


@pytest.fixture()
def engine(seed_lancedb, monkeypatch):
    """Instantiate a FastAPISearchEngine pointed at the seeded LanceDB."""

    monkeypatch.setenv("DB_PATH", seed_lancedb)
    settings.DB_PATH = seed_lancedb

    from app.core.vector_search import VectorSearchEngine
    from app.core.search_engine import FastAPISearchEngine

    eng = FastAPISearchEngine(db_path=seed_lancedb)
    if isinstance(eng.engine, VectorSearchEngine):
        eng.engine.embedder = StubEmbedder()
    return eng


# ---------------------------------------------------------------------------
# Monkeypatch helpers for external services
# ---------------------------------------------------------------------------


@pytest.fixture()
def stub_brightdata(monkeypatch):
    """Replace BrightData client with fixture-backed stub."""

    monkeypatch.setattr(
        "app.core.post_filter.brightdata_client.BrightDataServiceClient",
        FixtureBrightDataServiceClient,
    )
    yield


@pytest.fixture()
def stub_openai_fit(monkeypatch):
    """Intercept OpenAI profile fit calls."""

    monkeypatch.setattr(
        "app.core.post_filter.profile_fit.ProfileFitAssessor._call_openai",
        staticmethod(_stub_openai_call),
    )
    yield


@pytest.fixture()
def stub_reranker(monkeypatch):
    """Use deterministic rerank stub."""

    monkeypatch.setattr(
        "app.services.pipeline._build_rerank_client",
        lambda: (StubRerankClient(), None),
    )
    yield


@pytest.fixture()
def stub_profile_fit(monkeypatch):
    """Stub OpenAI calls used by the profile fit assessor."""

    from app.core.post_filter.profile_fit import ProfileFitAssessor

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    settings.OPENAI_API_KEY = SecretStr("test-key")
    monkeypatch.setattr(
        "app.core.post_filter.profile_fit.ProfileFitAssessor._call_openai",
        staticmethod(_stub_openai_call),
    )
    yield
