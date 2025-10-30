"""
Authentication test fixtures for BrightData service.
"""

import os
import pytest
import sys
from pathlib import Path

# Add packages to path
_repo_root = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(_repo_root))

from packages.config.py.firebase import get_firestore


@pytest.fixture(scope="session")
def firestore_client():
    """Get Firestore client for test data setup."""
    if not os.getenv("FIRESTORE_EMULATOR_HOST"):
        os.environ["FIRESTORE_EMULATOR_HOST"] = "localhost:9002"
    if not os.getenv("GOOGLE_CLOUD_PROJECT"):
        os.environ["GOOGLE_CLOUD_PROJECT"] = "penny-dev"
    
    return get_firestore()


@pytest.fixture
def test_user_id():
    return "test-user-bd-123"


@pytest.fixture
def test_org_id():
    return "test-org-bd-123"


@pytest.fixture
def test_user_with_subscription(firestore_client, test_user_id, test_org_id):
    """Create test user with active subscription."""
    # Create org
    org_ref = firestore_client.collection("organizations").document(test_org_id)
    org_ref.set({
        "name": "Test Org BD",
        "slug": "test-org-bd",
        "plan": "pro",
        "billingStatus": "active",
    })
    
    # Create member
    member_ref = org_ref.collection("members").document(test_user_id)
    member_ref.set({
        "role": "owner",
    })
    
    # Create subscription
    sub_ref = org_ref.collection("subscription").document("current")
    sub_ref.set({
        "provider": "stripe",
        "customerId": "cus_test123",
        "subscriptionId": "sub_test123",
        "plan": "pro",
        "status": "active",
    })
    
    # Create profile
    profile_ref = firestore_client.collection("profiles").document(test_user_id)
    profile_ref.set({
        "fullName": "Test User BD",
        "currentOrgId": test_org_id,
    })
    
    yield test_user_id, test_org_id
    
    # Cleanup
    profile_ref.delete()
    sub_ref.delete()
    member_ref.delete()
    org_ref.delete()

