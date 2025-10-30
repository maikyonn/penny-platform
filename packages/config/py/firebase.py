"""
Firebase configuration and helpers for Python services.
Automatically connects to Firebase Emulator Suite when emulator hosts are set.
"""

import os
from typing import Optional

import firebase_admin
from firebase_admin import auth, credentials, firestore, storage


# Global Firebase app instance
_firebase_app: Optional[firebase_admin.App] = None


def get_firebase_app() -> firebase_admin.App:
    """Get or initialize Firebase Admin app."""
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    # Check if we're using emulators
    firestore_emulator = os.getenv("FIRESTORE_EMULATOR_HOST")
    auth_emulator = os.getenv("FIREBASE_AUTH_EMULATOR_HOST")
    storage_emulator = os.getenv("STORAGE_EMULATOR_HOST")
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "penny-dev")

    # If emulators are configured, use them
    if firestore_emulator or auth_emulator:
        # For emulator, we don't need credentials
        _firebase_app = firebase_admin.initialize_app(
            options={"projectId": project_id}
        )
        print(f"✅ Firebase Admin initialized (emulator mode)")
        print(f"   • Project: {project_id}")
        if firestore_emulator:
            print(f"   • Firestore emulator: {firestore_emulator}")
        if auth_emulator:
            print(f"   • Auth emulator: {auth_emulator}")
        if storage_emulator:
            print(f"   • Storage emulator: {storage_emulator}")
    else:
        # Production: try to use default credentials (service account)
        try:
            _firebase_app = firebase_admin.initialize_app()
            print("✅ Firebase Admin initialized (production mode)")
        except Exception as e:
            print(f"⚠️ Firebase Admin initialization failed: {e}")
            print("   Using emulator configuration...")
            _firebase_app = firebase_admin.initialize_app(
                options={"projectId": project_id}
            )

    return _firebase_app


def get_firestore() -> firestore.Client:
    """Get Firestore client (connects to emulator if configured)."""
    app = get_firebase_app()
    return firestore.client(app)


def get_auth() -> auth.Client:
    """Get Auth client (connects to emulator if configured)."""
    app = get_firebase_app()
    return auth.Client(app)


def get_storage():
    """Get Storage client (connects to emulator if configured)."""
    # Storage requires google-cloud-storage, not firebase-admin.storage
    try:
        from google.cloud import storage as gcs_storage
        return gcs_storage.Client(project=os.getenv("GOOGLE_CLOUD_PROJECT", "penny-dev"))
    except ImportError:
        raise ImportError("google-cloud-storage is required for Storage operations. Install with: pip install google-cloud-storage")


def verify_id_token(token: str) -> dict:
    """
    Verify Firebase ID token.
    Works with both emulator and production tokens.
    """
    auth_client = get_auth()
    try:
        decoded_token = auth_client.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise ValueError(f"Invalid token: {e}")


def require_auth_header(auth_header: Optional[str]) -> dict:
    """
    Extract and verify Firebase ID token from Authorization header.
    Raises ValueError if token is missing or invalid.
    """
    if not auth_header:
        raise ValueError("Missing Authorization header")

    if not auth_header.startswith("Bearer "):
        raise ValueError("Authorization header must start with 'Bearer '")

    token = auth_header.split(" ")[1]
    return verify_id_token(token)

