"""Search service configuration using centralized config package."""

import json
import os
import sys
from pathlib import Path
from typing import List

# Add packages to path for centralized config
_repo_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_repo_root))

from packages.config.py.settings import SETTINGS

# Import centralized settings and extend with service-specific logic
settings = SETTINGS

# Service-specific app name override
settings.APP_NAME = "GenZ Creator Search API"
settings.VERSION = "1.0.0"


def _normalize_rq_worker_env_var() -> None:
    """Sanitize RQ_WORKER_QUEUES env var so pydantic can parse it."""
    raw = os.environ.get("RQ_WORKER_QUEUES")
    if raw is None:
        return
    cleaned = raw.strip()
    if not cleaned:
        os.environ.pop("RQ_WORKER_QUEUES", None)
        return
    # If already valid JSON, keep as-is
    try:
        json.loads(cleaned)
        return
    except json.JSONDecodeError:
        pass

    csv_values = [item.strip() for item in cleaned.split(",") if item.strip()]
    if csv_values:
        os.environ["RQ_WORKER_QUEUES"] = json.dumps(csv_values)
    else:
        os.environ.pop("RQ_WORKER_QUEUES", None)


_normalize_rq_worker_env_var()


def _candidate_db_roots() -> List[str]:
    """Return possible DIME-AI-DB locations (env override, sibling repo, nested copy)."""
    current_dir = Path(__file__).resolve().parent
    repo_root = current_dir.parents[3]  # services/search/app -> repo root
    workspace_root = repo_root.parent

    env_root = os.getenv("DIME_AI_DB_ROOT") or os.getenv("DIME_DB_ROOT")
    candidates: List[str] = []
    if env_root:
        candidates.append(env_root)
    candidates.extend(
        [
            str(repo_root / "DIME-AI-DB"),
            str(workspace_root / "DIME-AI-DB"),
        ]
    )

    # Deduplicate while preserving order
    seen = set()
    unique_candidates: List[str] = []
    for path in candidates:
        norm = os.path.abspath(path)
        if norm not in seen:
            seen.add(norm)
            unique_candidates.append(norm)
    return unique_candidates or [str(repo_root)]


def _resolve_default_db_path() -> str:
    """Prefer the new LanceDB directory, fall back to legacy vectordb."""
    for root in _candidate_db_roots():
        candidate = os.path.join(root, "data", "lancedb")
        if os.path.exists(candidate):
            return candidate

    for root in _candidate_db_roots():
        legacy = os.path.join(root, "influencers_vectordb")
        if os.path.exists(legacy):
            return legacy

    # Last resort: point to the expected modern layout even if missing
    first_root = _candidate_db_roots()[0]
    return os.path.join(first_root, "data", "lancedb")


def _resolve_default_text_db_path() -> str:
    """Prefer the consolidated LanceDB directory, fall back to historical text DB."""
    for root in _candidate_db_roots():
        candidate = os.path.join(root, "data", "lancedb")
        if os.path.exists(candidate):
            return candidate

    for root in _candidate_db_roots():
        legacy = os.path.join(root, "influencers_lancedb")
        if os.path.exists(legacy):
            return legacy

    first_root = _candidate_db_roots()[0]
    return os.path.join(first_root, "data", "lancedb")


# Set default DB path if not provided
if not settings.DB_PATH:
    settings.DB_PATH = _resolve_default_db_path()

if not settings.TEXT_DB_PATH:
    settings.TEXT_DB_PATH = _resolve_default_text_db_path()

# Ensure RQ_WORKER_QUEUES is parsed correctly
if isinstance(settings.RQ_WORKER_QUEUES, str):
    # Parse CSV string to list
    queues = [q.strip() for q in settings.RQ_WORKER_QUEUES.split(",") if q.strip()]
    settings.RQ_WORKER_QUEUES = queues if queues else ["default", "search", "pipeline"]
