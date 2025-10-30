"""
Comprehensive authentication tests for Search API.
Tests signed in/out scenarios and subscription checks.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
import sys
from pathlib import Path

# Add packages to path
_repo_root = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(_repo_root))

from app.main import app
from tests.conftest_auth import (
    test_user_without_org,
    test_user_with_org,
    test_user_with_subscription,
    test_user_no_subscription,
    create_test_token,
)


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


class TestAuthentication:
    """Test authentication scenarios."""
    
    def test_unauthenticated_request(self, client):
        """Test request without authorization header."""
        response = client.get("/search/username/testuser")
        assert response.status_code == 401
        assert "Missing" in response.json()["detail"] or "Authorization" in response.json()["detail"]
    
    def test_invalid_token(self, client):
        """Test request with invalid token."""
        response = client.get(
            "/search/username/testuser",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401
    
    @patch("packages.config.py.firebase.verify_id_token")
    def test_authenticated_request(self, mock_verify, client, test_user_with_org):
        """Test request with valid token."""
        user_id, org_id = test_user_with_org
        mock_verify.return_value = {
            "uid": user_id,
            "email": "test@example.com",
        }
        
        # Mock search engine to avoid DB dependency
        with patch("app.dependencies.get_search_engine") as mock_engine:
            mock_engine.return_value = Mock(
                get_creator_by_username=Mock(return_value=None)
            )
            
            response = client.get(
                "/search/username/testuser",
                headers={"Authorization": f"Bearer valid_token_{user_id}"}
            )
            # Should get 404 (user not found) not 401 (unauthorized)
            assert response.status_code in [404, 503]  # 503 if engine not initialized
    
    @patch("packages.config.py.firebase.verify_id_token")
    def test_user_without_org(self, mock_verify, client, test_user_without_org):
        """Test user without organization."""
        mock_verify.return_value = {
            "uid": test_user_without_org,
            "email": "test@example.com",
        }
        
        # Try to access endpoint that requires org
        # This would need an endpoint that uses get_current_user_org
        # For now, just verify auth works
        with patch("app.dependencies.get_search_engine") as mock_engine:
            mock_engine.return_value = Mock(
                get_creator_by_username=Mock(return_value=None)
            )
            
            response = client.get(
                "/search/username/testuser",
                headers={"Authorization": f"Bearer token_{test_user_without_org}"}
            )
            # Auth should work, but org-dependent endpoints would fail
            assert response.status_code != 401


class TestSubscription:
    """Test subscription scenarios."""
    
    @patch("packages.config.py.firebase.verify_id_token")
    def test_endpoint_with_subscription(self, mock_verify, client, test_user_with_subscription):
        """Test endpoint that requires subscription."""
        user_id, org_id = test_user_with_subscription
        mock_verify.return_value = {
            "uid": user_id,
            "email": "test@example.com",
        }
        
        # Note: This test assumes we have an endpoint that requires subscription
        # For now, we'll test the subscription check function directly
        from packages.config.py.subscription import check_subscription_active
        
        assert check_subscription_active(org_id) == True
    
    @patch("packages.config.py.firebase.verify_id_token")
    def test_endpoint_without_subscription(self, mock_verify, client, test_user_no_subscription):
        """Test endpoint that requires subscription but user doesn't have one."""
        user_id, org_id = test_user_no_subscription
        mock_verify.return_value = {
            "uid": user_id,
            "email": "test@example.com",
        }
        
        from packages.config.py.subscription import check_subscription_active
        
        assert check_subscription_active(org_id) == False
    
    @patch("packages.config.py.firebase.verify_id_token")
    def test_feature_access(self, mock_verify, client, test_user_with_subscription, test_user_no_subscription):
        """Test feature access based on subscription plan."""
        from packages.config.py.subscription import check_feature_access
        
        # User with pro subscription
        _, pro_org_id = test_user_with_subscription
        assert check_feature_access(pro_org_id, "advanced_search") == True
        assert check_feature_access(pro_org_id, "ai_recommendations") == True
        
        # User without subscription
        _, free_org_id = test_user_no_subscription
        assert check_feature_access(free_org_id, "advanced_search") == False
        assert check_feature_access(free_org_id, "ai_recommendations") == False


class TestPublicEndpoints:
    """Test endpoints that don't require authentication."""
    
    def test_health_endpoint(self, client):
        """Test health check endpoint (should be public)."""
        response = client.get("/health")
        assert response.status_code == 200
    
    def test_root_endpoint(self, client):
        """Test root endpoint (should be public)."""
        response = client.get("/")
        assert response.status_code == 200

