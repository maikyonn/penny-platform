"""
Authentication and subscription test fixtures.
"""

import os
import pytest
from typing import Optional, Dict
from unittest.mock import Mock, patch

# Add packages to path
import sys
from pathlib import Path
_repo_root = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(_repo_root))

from packages.config.py.firebase import get_firestore


@pytest.fixture(scope="session")
def firestore_client():
    """Get Firestore client for test data setup."""
    # Set emulator host if not already set
    if not os.getenv("FIRESTORE_EMULATOR_HOST"):
        os.environ["FIRESTORE_EMULATOR_HOST"] = "localhost:9002"
    if not os.getenv("GOOGLE_CLOUD_PROJECT"):
        os.environ["GOOGLE_CLOUD_PROJECT"] = "penny-dev"
    
    return get_firestore()


@pytest.fixture
def test_user_id():
    """Test user ID."""
    return "test-user-auth-123"


@pytest.fixture
def test_org_id():
    """Test organization ID."""
    return "test-org-auth-123"


@pytest.fixture
def test_user_without_org(firestore_client, test_user_id):
    """Create a test user without an organization."""
    profile_ref = firestore_client.collection("profiles").document(test_user_id)
    profile_ref.set({
        "fullName": "Test User No Org",
        "avatarUrl": None,
        "locale": "en",
        "currentOrgId": None,
    })
    
    yield test_user_id
    
    # Cleanup
    profile_ref.delete()


@pytest.fixture
def test_user_with_org(firestore_client, test_user_id, test_org_id):
    """Create a test user with an organization."""
    # Create org
    org_ref = firestore_client.collection("organizations").document(test_org_id)
    org_ref.set({
        "name": "Test Org",
        "slug": "test-org",
        "plan": "free",
        "billingStatus": "active",
    })
    
    # Create member
    member_ref = org_ref.collection("members").document(test_user_id)
    member_ref.set({
        "role": "owner",
        "invitedBy": None,
    })
    
    # Create profile
    profile_ref = firestore_client.collection("profiles").document(test_user_id)
    profile_ref.set({
        "fullName": "Test User",
        "avatarUrl": None,
        "locale": "en",
        "currentOrgId": test_org_id,
    })
    
    yield test_user_id, test_org_id
    
    # Cleanup
    profile_ref.delete()
    member_ref.delete()
    org_ref.delete()


@pytest.fixture
def test_user_with_subscription(firestore_client, test_user_id, test_org_id):
    """Create a test user with an active subscription."""
    # Create org
    org_ref = firestore_client.collection("organizations").document(test_org_id)
    org_ref.set({
        "name": "Test Org Pro",
        "slug": "test-org-pro",
        "plan": "pro",
        "billingStatus": "active",
    })
    
    # Create member
    member_ref = org_ref.collection("members").document(test_user_id)
    member_ref.set({
        "role": "owner",
        "invitedBy": None,
    })
    
    # Create subscription
    sub_ref = org_ref.collection("subscription").document("current")
    sub_ref.set({
        "provider": "stripe",
        "customerId": "cus_test123",
        "subscriptionId": "sub_test123",
        "plan": "pro",
        "status": "active",
        "currentPeriodEnd": None,  # Will be set to future date
    })
    
    # Create profile
    profile_ref = firestore_client.collection("profiles").document(test_user_id)
    profile_ref.set({
        "fullName": "Test User Pro",
        "avatarUrl": None,
        "locale": "en",
        "currentOrgId": test_org_id,
    })
    
    yield test_user_id, test_org_id
    
    # Cleanup
    profile_ref.delete()
    sub_ref.delete()
    member_ref.delete()
    org_ref.delete()


@pytest.fixture
def test_user_no_subscription(firestore_client, test_user_id, test_org_id):
    """Create a test user without a subscription."""
    # Create org
    org_ref = firestore_client.collection("organizations").document(test_org_id)
    org_ref.set({
        "name": "Test Org Free",
        "slug": "test-org-free",
        "plan": "free",
        "billingStatus": "active",
    })
    
    # Create member
    member_ref = org_ref.collection("members").document(test_user_id)
    member_ref.set({
        "role": "owner",
        "invitedBy": None,
    })
    
    # Create profile (no subscription doc)
    profile_ref = firestore_client.collection("profiles").document(test_user_id)
    profile_ref.set({
        "fullName": "Test User Free",
        "avatarUrl": None,
        "locale": "en",
        "currentOrgId": test_org_id,
    })
    
    yield test_user_id, test_org_id
    
    # Cleanup
    profile_ref.delete()
    member_ref.delete()
    org_ref.delete()


@pytest.fixture
def mock_firebase_token():
    """Mock Firebase ID token for testing."""
    return {
        "uid": "test-user-auth-123",
        "email": "test@example.com",
        "email_verified": True,
    }


@pytest.fixture
def auth_headers(mock_firebase_token):
    """Create Authorization header with mock token."""
    return {"Authorization": f"Bearer mock_token_{mock_firebase_token['uid']}"}


@pytest.fixture
def no_auth_headers():
    """Headers without authorization."""
    return {}


def create_test_token(user_id: str, email: str = "test@example.com") -> str:
    """Create a test token string (for mocking)."""
    return f"test_token_{user_id}"

