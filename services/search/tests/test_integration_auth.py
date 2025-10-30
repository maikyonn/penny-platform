"""
Integration tests for authentication and subscription across Search API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
import sys
from pathlib import Path

_repo_root = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(_repo_root))

from app.main import app
from tests.conftest_auth import (
    test_user_without_org,
    test_user_with_org,
    test_user_with_subscription,
    test_user_no_subscription,
)


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


class TestSearchEndpointsAuth:
    """Test authentication on all search endpoints."""
    
    @pytest.mark.parametrize("endpoint,method,payload", [
        ("/search/username/testuser", "GET", None),
        ("/search/", "POST", {"query": "beauty", "limit": 10, "method": "vector"}),
        ("/search/similar", "POST", {"account": "test", "limit": 10}),
        ("/search/category", "POST", {"category": "beauty", "limit": 10}),
        ("/search/pipeline", "POST", {"search": {"query": "test", "limit": 10}}),
    ])
    def test_endpoints_require_auth(self, client, endpoint, method, payload):
        """Test that all search endpoints require authentication."""
        if method == "GET":
            response = client.get(endpoint)
        else:
            response = client.post(endpoint, json=payload)
        
        # Should return 401 or 503 (if engine not initialized)
        assert response.status_code in [401, 503]
    
    @patch("packages.config.py.firebase.verify_id_token")
    @patch("app.dependencies.get_search_engine")
    def test_authenticated_search(self, mock_engine, mock_verify, client, test_user_with_org):
        """Test authenticated search request."""
        user_id, org_id = test_user_with_org
        mock_verify.return_value = {"uid": user_id, "email": "test@example.com"}
        mock_engine.return_value = Mock(
            get_creator_by_username=Mock(return_value=None)
        )
        
        response = client.get(
            "/search/username/testuser",
            headers={"Authorization": f"Bearer token_{user_id}"}
        )
        
        # Should not be 401 (unauthorized)
        assert response.status_code != 401


class TestSubscriptionGatedEndpoints:
    """Test endpoints that require subscription."""
    
    @patch("packages.config.py.firebase.verify_id_token")
    @patch("app.dependencies.get_search_engine")
    def test_free_user_can_access_basic_search(self, mock_engine, mock_verify, client, test_user_no_subscription):
        """Test that free users can access basic search."""
        user_id, org_id = test_user_no_subscription
        mock_verify.return_value = {"uid": user_id, "email": "test@example.com"}
        mock_engine.return_value = Mock(
            get_creator_by_username=Mock(return_value=None)
        )
        
        # Basic username search should work
        response = client.get(
            "/search/username/testuser",
            headers={"Authorization": f"Bearer token_{user_id}"}
        )
        
        # Should not be 402 (payment required) for basic search
        assert response.status_code != 402
    
    @patch("packages.config.py.firebase.verify_id_token")
    def test_subscription_check(self, mock_verify, client, test_user_with_subscription, test_user_no_subscription):
        """Test subscription checking logic."""
        from packages.config.py.subscription import check_subscription_active, require_subscription
        
        # User with subscription
        _, pro_org_id = test_user_with_subscription
        assert check_subscription_active(pro_org_id) == True
        
        # User without subscription
        _, free_org_id = test_user_no_subscription
        assert check_subscription_active(free_org_id) == False
        
        # Require subscription should work for pro user
        sub = require_subscription(pro_org_id)
        assert sub is not None
        assert sub.get("status") == "active"
        
        # Require subscription should fail for free user
        with pytest.raises(Exception):  # Should raise HTTPException
            require_subscription(free_org_id)


class TestFeatureAccess:
    """Test feature-based access control."""
    
    @patch("packages.config.py.firebase.verify_id_token")
    def test_feature_access_matrix(self, mock_verify, client, test_user_with_subscription, test_user_no_subscription):
        """Test feature access for different subscription levels."""
        from packages.config.py.subscription import check_feature_access
        
        _, pro_org_id = test_user_with_subscription
        _, free_org_id = test_user_no_subscription
        
        # Pro user should have access to advanced features
        assert check_feature_access(pro_org_id, "advanced_search") == True
        assert check_feature_access(pro_org_id, "ai_recommendations") == True
        
        # Free user should not have access
        assert check_feature_access(free_org_id, "advanced_search") == False
        assert check_feature_access(free_org_id, "ai_recommendations") == False


class TestPublicEndpoints:
    """Test endpoints that don't require authentication."""
    
    def test_health_endpoint_public(self, client):
        """Health endpoint should be public."""
        response = client.get("/health")
        assert response.status_code == 200
    
    def test_root_endpoint_public(self, client):
        """Root endpoint should be public."""
        response = client.get("/")
        assert response.status_code == 200

