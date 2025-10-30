"""Centralized environment configuration using Pydantic."""

from pathlib import Path
import os
from typing import List, Optional, Union

from pydantic import AnyHttpUrl, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from layered .env files."""

    # Profile & logging
    PROFILE: str = "dev"
    APP_ENV: str = "local"
    LOG_LEVEL: str = "debug"

    # Firebase
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIRESTORE_EMULATOR_HOST: Optional[str] = None
    FIREBASE_AUTH_EMULATOR_HOST: Optional[str] = None
    STORAGE_EMULATOR_HOST: Optional[str] = None
    PUBSUB_EMULATOR_HOST: Optional[str] = None

    # Internal services
    SEARCH_API_URL: AnyHttpUrl = "http://localhost:9100"
    BRIGHTDATA_API_URL: AnyHttpUrl = "http://localhost:9101"
    VIEWER_PORT: int = 9102
    VIEWER_ROOT_PATH: str = "/db-viewer"

    # Database settings
    DB_PATH: Optional[str] = None
    TEXT_DB_PATH: Optional[str] = None
    TABLE_NAME: str = "influencer_facets"

    # Search API settings
    PORT: int = 9100
    API_V1_PREFIX: str = "/search"
    APP_NAME: str = "GenZ Creator Search API"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # BrightData settings
    BRIGHTDATA_API_KEY: Optional[SecretStr] = None
    BRIGHTDATA_API_TOKEN: Optional[SecretStr] = None
    BRIGHTDATA_INSTAGRAM_DATASET_ID: Optional[str] = None
    BRIGHTDATA_TIKTOK_DATASET_ID: Optional[str] = None
    BRIGHTDATA_BASE_URL: AnyHttpUrl = "https://api.brightdata.com/datasets/v3"
    BRIGHTDATA_MAX_URLS: int = 50
    BRIGHTDATA_JOB_TIMEOUT: int = 600
    BRIGHTDATA_JOB_POLL_INTERVAL: int = 5
    BRIGHTDATA_FETCH_TIMEOUT: int = 300
    BRIGHTDATA_MAX_CONCURRENCY: int = 5
    BRIGHTDATA_JOBS_IMMEDIATE: bool = False
    BRIGHTDATA_POLL_INTERVAL: int = 30  # For BrightData API polling
    BRIGHTDATA_SERVICE_URL: AnyHttpUrl = "http://localhost:9101/brightdata/images"

    # OpenAI / LLM settings
    OPENAI_API_KEY: Optional[SecretStr] = None

    # DeepInfra embeddings
    DEEPINFRA_API_KEY: Optional[SecretStr] = None
    DEEPINFRA_ENDPOINT: AnyHttpUrl = "https://api.deepinfra.com/v1/openai"
    EMBED_MODEL: str = "google/embeddinggemma-300m"

    # Reranker settings
    RERANKER_ENABLED: bool = True
    RERANKER_ENDPOINT: AnyHttpUrl = "https://api.deepinfra.com/v1/inference/Qwen/Qwen3-Reranker-8B"
    RERANKER_SERVICE_URL: AnyHttpUrl = "http://localhost:9101/brightdata/rerank"
    RERANKER_TOP_K: int = 200

    # Redis / RQ settings
    REDIS_URL: str = "redis://127.0.0.1:6379/0"
    RQ_JOB_TIMEOUT: int = 900
    RQ_RESULT_TTL: int = 3600
    RQ_WORKER_QUEUES: Union[str, List[str]] = "default,search,pipeline"
    RQ_PUBSUB_EVENTS: bool = True
    RQ_EVENTS_CHANNEL_PREFIX: str = "jobs"

    # Integrations
    STRIPE_SECRET_KEY: Optional[SecretStr] = None
    STRIPE_WEBHOOK_SECRET: Optional[SecretStr] = None
    GMAIL_CLIENT_ID: Optional[str] = None
    GMAIL_CLIENT_SECRET: Optional[SecretStr] = None

    # Feature flags
    FEATURE_AI: bool = True
    FEATURE_BRIGHTDATA: bool = False

    # CORS settings
    ALLOWED_ORIGINS: Union[str, List[str]] = "*"

    # Common
    PENNY_DEFAULT_REGION: str = "us-central1"

    model_config = SettingsConfigDict(
        env_file=[
            # Layered load from repo root /env directory
            str(Path(__file__).resolve().parents[3] / "env" / ".env"),
            str(Path(__file__).resolve().parents[3] / "env" / f".env.{os.getenv('PROFILE', 'dev')}"),
        ],
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    @field_validator("PROFILE")
    @classmethod
    def profile_allowed(cls, v: str) -> str:
        """Validate profile is one of allowed values."""
        assert v in {"dev", "test", "ci", "staging", "prod"}, f"Invalid PROFILE: {v}"
        return v

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, value: Union[str, List[str]]) -> List[str]:
        """Parse ALLOWED_ORIGINS from string or list."""
        if isinstance(value, str):
            stripped = value.strip()
            if stripped == "*":
                return ["*"]
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return value

    @field_validator("RQ_WORKER_QUEUES", mode="before")
    @classmethod
    def parse_worker_queues(cls, value):
        """Support JSON array, CSV, or blank env input for worker queues."""
        import json

        default_queues = ["default", "search", "pipeline"]
        if value in (None, Ellipsis):
            return default_queues
        if isinstance(value, list):
            return value or default_queues
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return default_queues
            try:
                parsed = json.loads(stripped)
                if isinstance(parsed, list):
                    return parsed or default_queues
            except json.JSONDecodeError:
                pass
            csv_values = [item.strip() for item in stripped.split(",") if item.strip()]
            return csv_values or default_queues
        return value or default_queues


# Initialize settings with profile from environment
_profile = os.getenv("PROFILE", "dev")
os.environ.setdefault("PROFILE", _profile)

SETTINGS = Settings()

# Set emulator environment variables if configured
if SETTINGS.FIRESTORE_EMULATOR_HOST:
    os.environ["FIRESTORE_EMULATOR_HOST"] = SETTINGS.FIRESTORE_EMULATOR_HOST
if SETTINGS.FIREBASE_AUTH_EMULATOR_HOST:
    os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = SETTINGS.FIREBASE_AUTH_EMULATOR_HOST
if SETTINGS.STORAGE_EMULATOR_HOST:
    os.environ["STORAGE_EMULATOR_HOST"] = SETTINGS.STORAGE_EMULATOR_HOST
if SETTINGS.PUBSUB_EMULATOR_HOST:
    os.environ["PUBSUB_EMULATOR_HOST"] = SETTINGS.PUBSUB_EMULATOR_HOST

