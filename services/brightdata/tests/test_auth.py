"""
Authentication tests for BrightData API.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
import sys
from pathlib import Path

_repo_root = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(_repo_root))

from app.main import app


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


class TestBrightDataAuth:
    """Test authentication for BrightData endpoints."""
    
    def test_unauthenticated_request(self, client):
        """Test request without authorization."""
        response = client.get("/health")
        # Health should be public
        assert response.status_code == 200
        
        # But image endpoints should require auth
        response = client.post("/api/v1/images/refresh")
        assert response.status_code == 401
    
    @patch("packages.config.py.firebase.verify_id_token")
    def test_authenticated_request(self, mock_verify, client, test_user_with_subscription):
        """Test authenticated request."""
        from tests.conftest_auth import test_user_with_subscription
        
        user_id, org_id = test_user_with_subscription
        mock_verify.return_value = {
            "uid": user_id,
            "email": "test@example.com",
        }
        
        # Mock the image refresh service
        with patch("app.services.image_refresh_service.ImageRefreshService") as mock_service:
            response = client.post(
                "/api/v1/images/refresh",
                headers={"Authorization": f"Bearer token_{user_id}"},
                json={"profile_urls": ["https://instagram.com/test"]}
            )
            # Should not be 401
            assert response.status_code != 401

