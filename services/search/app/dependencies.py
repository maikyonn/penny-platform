"""Shared dependencies for FastAPI endpoints"""
import os
import shutil
import tarfile
import tempfile
from typing import Optional

from fastapi import Depends, HTTPException

from app.config import settings

# Global instances
_search_engine = None
_text_search_engine = None
_post_filter_ready = False
_dataset_ready = False


def _ensure_lancedb_dataset() -> bool:
    """Ensure the LanceDB dataset exists locally, downloading from Cloud Storage if needed."""
    global _dataset_ready

    if _dataset_ready:
        return True

    db_path = settings.DB_PATH
    if not db_path:
        print("❌ DB_PATH is not configured; cannot locate LanceDB dataset.")
        return False

    if os.path.exists(db_path):
        _dataset_ready = True
        return True

    bucket_name = getattr(settings, "LANCEDB_STORAGE_BUCKET", None)
    object_name = getattr(settings, "LANCEDB_STORAGE_OBJECT", "lancedb/lancedb-snapshot.tar.gz")

    if not bucket_name:
        print("❌ LanceDB dataset missing locally and LANCEDB_STORAGE_BUCKET is not set.")
        return False

    try:
        print(f"📦 Downloading LanceDB snapshot from gs://{bucket_name}/{object_name} ...")
        from google.cloud import storage

        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_name)

        if not blob.exists(client):
            print("❌ LanceDB snapshot blob not found in Storage.")
            return False

        tmp_dir = tempfile.mkdtemp(prefix="lancedb-")
        archive_path = os.path.join(tmp_dir, "lancedb.tar.gz")
        blob.download_to_filename(archive_path)

        extract_root = tempfile.mkdtemp(prefix="lancedb-extract-")
        with tarfile.open(archive_path, "r:gz") as tar:
            tar.extractall(path=extract_root)

        extracted_dir = os.path.join(extract_root, "lancedb")
        if not os.path.isdir(extracted_dir):
            print("❌ Extracted archive does not contain lancedb directory.")
            return False

        target_parent = os.path.dirname(db_path.rstrip("/")) or "."
        os.makedirs(target_parent, exist_ok=True)

        if os.path.exists(db_path):
            shutil.rmtree(db_path)

        shutil.move(extracted_dir, db_path)
        shutil.rmtree(extract_root, ignore_errors=True)
        shutil.rmtree(tmp_dir, ignore_errors=True)
        _dataset_ready = True
        print(f"✅ LanceDB dataset downloaded to {db_path}")
        return True
    except Exception as exc:  # pylint: disable=broad-except
        print(f"❌ Failed to download LanceDB dataset: {exc}")
        return False


def init_search_engine() -> bool:
    """Initialize the search engine"""
    global _search_engine, _post_filter_ready
    try:
        from app.core.search_engine import FastAPISearchEngine

        db_path = settings.DB_PATH
        if not db_path:
            print("❌ DB_PATH is not configured; set DB_PATH or ensure default resolution succeeds.")
            return False

        if not os.path.exists(db_path):
            if not _ensure_lancedb_dataset():
                print(f"❌ LanceDB database not found at: {db_path}")
                print("   Ensure dataset is available locally or configure LANCEDB_STORAGE_BUCKET/LANCEDB_STORAGE_OBJECT.")
                return False

        _search_engine = FastAPISearchEngine(db_path)
        print("✅ Search engine initialized")
        print(f"   • DB path: {db_path}")
        _post_filter_ready = True
        return True
    except Exception as e:
        print(f"Error initializing search engine: {e}")
        return False


def init_post_filter() -> None:
    from app.config import settings
    if settings.OPENAI_API_KEY and settings.BRIGHTDATA_SERVICE_URL:
        print("✅ Post-filter pipeline ready (LLM + BrightData service)")
    else:
        print("⚠️ Post-filter pipeline missing OPENAI_API_KEY or BRIGHTDATA_SERVICE_URL; stage two will be limited")

def get_search_engine():
    """Dependency to get search engine instance"""
    if _search_engine is None:
        raise HTTPException(
            status_code=503,
            detail="Search engine not initialized. Please ensure database is available."
        )
    return _search_engine

async def get_optional_search_engine():
    """Get search engine if available, None otherwise"""
    return _search_engine


def init_text_search_engine() -> bool:
    """Initialize the plaintext biography search engine."""
    global _text_search_engine
    try:
        from app.core.text_search import TextSearchEngine

        table_path = settings.TEXT_DB_PATH or settings.DB_PATH
        if not table_path:
            print("⚠️ TEXT_DB_PATH is not configured and DB_PATH is unavailable.")
            return False

        if not os.path.exists(table_path):
            if not _ensure_lancedb_dataset():
                print(f"⚠️ Biography dataset not found at: {table_path}")
                print("   Expected LanceDB directory inside DIME-AI-DB/data/lancedb or downloadable snapshot.")
                return False

        if _search_engine is None and not init_search_engine():
            print("⚠️ Unable to initialize primary search engine; text search unavailable")
            return False

        _text_search_engine = TextSearchEngine(
            table_path=table_path,
            table_name=settings.TABLE_NAME or "influencer_facets",
            vector_engine=_search_engine,
        )
        print("✅ Text search engine initialized")
        print(f"   • Text DB path: {table_path}")
        return True
    except Exception as exc:  # pylint: disable=broad-except
        print(f"Error initializing text search engine: {exc}")
        _text_search_engine = None
        return False


def get_text_search_engine():
    """Dependency to get text search engine instance"""
    if _text_search_engine is None:
        raise HTTPException(
            status_code=503,
            detail="Text search engine not initialized."
        )
    return _text_search_engine


async def get_optional_text_search_engine():
    """Get text search engine if available, None otherwise"""
    return _text_search_engine
