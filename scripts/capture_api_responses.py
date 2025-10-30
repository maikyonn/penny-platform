#!/usr/bin/env python3
"""
Script to capture real API responses from backend services for use as MSW fixtures.

This script:
1. Creates a test user in Firebase Auth (emulator)
2. Gets an ID token for authentication
3. Makes a search request for 20 influencers
4. Polls for search results
5. Makes rerank request with search results
6. Makes image refresh request with usernames
7. Saves all responses as JSON fixtures
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, Any, Optional

import firebase_admin
from firebase_admin import auth, credentials
import httpx
import requests

# Add packages to path
_repo_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_repo_root))

# Service URLs
SEARCH_URL = "http://localhost:9100"
BRIGHTDATA_URL = "http://localhost:9101/api/v1"
FIREBASE_AUTH_EMULATOR = "http://localhost:9001"

# Output directory
OUTPUT_DIR = _repo_root / "apps" / "web" / "tests" / "fixtures" / "services"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / "search").mkdir(exist_ok=True)
(OUTPUT_DIR / "brightdata").mkdir(exist_ok=True)


def setup_firebase():
    """Initialize Firebase Admin SDK for emulator."""
    # Set emulator environment variables
    os.environ.setdefault("FIREBASE_AUTH_EMULATOR_HOST", "localhost:9001")
    os.environ.setdefault("FIRESTORE_EMULATOR_HOST", "localhost:9002")
    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "penny-dev")
    
    # Initialize Firebase Admin
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(options={"projectId": "penny-dev"})


def create_test_user_and_get_token() -> str:
    """
    Create a test user in Firebase Auth emulator and get an ID token.
    Returns the ID token string.
    """
    email = "test-fixture-capture@example.com"
    password = "test-password-123"
    uid = "test-fixture-user"
    
    # Use Firebase Auth REST API to create user and sign in
    # The emulator REST API endpoint format
    api_key = "fake-api-key"  # Emulator doesn't require real API key
    
    # Step 1: Create user via REST API (or sign in if exists)
    sign_up_url = f"{FIREBASE_AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp"
    
    try:
        # Try to sign up (will fail if user exists, that's okay)
        sign_up_response = requests.post(
            sign_up_url,
            json={
                "email": email,
                "password": password,
                "returnSecureToken": True,
            },
            headers={"Content-Type": "application/json"},
            params={"key": api_key},
        )
        
        if sign_up_response.status_code == 200:
            id_token = sign_up_response.json().get("idToken")
            if id_token:
                print(f"✅ Created user and got ID token: {email}")
                return id_token
        
        # If sign up failed, try sign in
        sign_in_url = f"{FIREBASE_AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
        sign_in_response = requests.post(
            sign_in_url,
            json={
                "email": email,
                "password": password,
                "returnSecureToken": True,
            },
            headers={"Content-Type": "application/json"},
            params={"key": api_key},
        )
        
        if sign_in_response.status_code == 200:
            id_token = sign_in_response.json().get("idToken")
            if id_token:
                print(f"✅ Signed in and got ID token: {email}")
                return id_token
        
        raise RuntimeError("Could not create user or sign in")
        
    except Exception as e:
        print(f"⚠️ Could not get ID token via REST API: {e}")
        print("   Trying Admin SDK approach...")
        
        # Fallback: Use Admin SDK to create user and custom token
        try:
            # Create or get user via Admin SDK
            try:
                user = auth.get_user(uid)
            except Exception:
                user = auth.create_user(
                    uid=uid,
                    email=email,
                    password=password,
                    email_verified=True,
                )
            
            # Create custom token
            custom_token = auth.create_custom_token(uid)
            
            # Try to exchange for ID token
            exchange_url = f"{FIREBASE_AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken"
            exchange_response = requests.post(
                exchange_url,
                json={"token": custom_token.decode("utf-8"), "returnSecureToken": True},
                headers={"Content-Type": "application/json"},
                params={"key": api_key},
            )
            
            if exchange_response.status_code == 200:
                id_token = exchange_response.json().get("idToken")
                if id_token:
                    print(f"✅ Exchanged custom token for ID token")
                    return id_token
            
            # Last resort: return custom token (might work if middleware is lenient)
            print(f"⚠️ Using custom token as fallback")
            return custom_token.decode("utf-8")
            
        except Exception as e2:
            print(f"⚠️ Admin SDK approach also failed: {e2}")
            # Return a mock token that might work if auth is disabled in dev
            return "test-token-mock-fixture-capture"


def get_auth_headers(token: str) -> Dict[str, str]:
    """Get HTTP headers with authorization token."""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def search_influencers(token: str, limit: int = 20) -> Dict[str, Any]:
    """
    Search for influencers and return the job_id.
    """
    print(f"\n🔍 Step 1: Searching for {limit} influencers...")
    
    url = f"{SEARCH_URL}/search/"
    payload = {
        "query": "beauty influencers",
        "method": "hybrid",
        "limit": limit,
    }
    
    headers = get_auth_headers(token)
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        result = response.json()
        print(f"✅ Search job enqueued: {result.get('job_id')}")
        return result
    except requests.exceptions.RequestException as e:
        print(f"❌ Search request failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Response: {e.response.text}")
        raise


def poll_job_status(token: str, job_id: str, max_wait: int = 300) -> Dict[str, Any]:
    """
    Poll job status until complete or timeout.
    Returns the final job status with results.
    """
    print(f"\n📊 Step 2: Polling job status for {job_id}...")
    
    url = f"{SEARCH_URL}/job/{job_id}"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    poll_interval = 2  # seconds
    
    while time.time() - start_time < max_wait:
        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            status = response.json()
            
            job_status = status.get("status", "unknown")
            print(f"   Job status: {job_status}")
            
            if job_status == "finished":
                print(f"✅ Job completed!")
                return status
            elif job_status == "failed":
                error = status.get("error", "Unknown error")
                raise RuntimeError(f"Job failed: {error}")
            
            time.sleep(poll_interval)
            
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Error polling job: {e}")
            time.sleep(poll_interval)
    
    raise TimeoutError(f"Job {job_id} did not complete within {max_wait} seconds")


def extract_search_results(job_status: Dict[str, Any]) -> list:
    """Extract search results from job status."""
    result = job_status.get("result")
    if not result:
        raise ValueError("No results in job status")
    
    # Result format might vary - handle different structures
    if isinstance(result, dict):
        if "results" in result:
            return result["results"]
        elif "data" in result:
            return result["data"]
        else:
            # Assume result itself is a list or contains list
            return result if isinstance(result, list) else [result]
    elif isinstance(result, list):
        return result
    else:
        raise ValueError(f"Unexpected result format: {type(result)}")


def rerank_influencers(token: str, query: str, documents: list, top_k: Optional[int] = None) -> Dict[str, Any]:
    """
    Rerank influencers using the BrightData service.
    """
    print(f"\n🔄 Step 3: Reranking {len(documents)} influencers...")
    
    url = f"{BRIGHTDATA_URL}/rerank"
    payload = {
        "query": query,
        "documents": documents,
    }
    if top_k:
        payload["top_k"] = top_k
    
    headers = get_auth_headers(token)
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        result = response.json()
        print(f"✅ Rerank completed: {len(result.get('ranking', []))} results")
        return result
    except requests.exceptions.RequestException as e:
        print(f"❌ Rerank request failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Response: {e.response.text}")
        raise


def refresh_images(token: str, usernames: list) -> Dict[str, Any]:
    """
    Refresh images for usernames using the BrightData service.
    """
    print(f"\n💡 Step 4: Refreshing images for {len(usernames)} influencers...")
    
    url = f"{BRIGHTDATA_URL}/images/refresh"
    payload = {
        "usernames": usernames[:50],  # Limit to 50
        "update_database": False,
    }
    
    headers = get_auth_headers(token)
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        result = response.json()
        print(f"✅ Image refresh enqueued: {result.get('job_id')}")
        return result
    except requests.exceptions.RequestException as e:
        print(f"❌ Image refresh request failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Response: {e.response.text}")
        raise


def extract_documents_from_results(results: list) -> list:
    """Extract document strings from search results for reranking."""
    documents = []
    for result in results:
        if isinstance(result, dict):
            # Try to create a meaningful document string
            account = result.get("account") or result.get("username", "")
            bio = result.get("bio") or result.get("description", "")
            text = f"{account}: {bio}".strip()
            if text:
                documents.append(text)
        elif isinstance(result, str):
            documents.append(result)
    
    return documents


def extract_usernames_from_results(results: list) -> list:
    """Extract usernames from search results."""
    usernames = []
    for result in results:
        if isinstance(result, dict):
            username = result.get("account") or result.get("username")
            if username:
                # Remove @ if present
                username = str(username).lstrip("@").strip()
                if username:
                    usernames.append(username)
        elif isinstance(result, str):
            # Assume it's a username
            username = result.lstrip("@").strip()
            if username:
                usernames.append(username)
    
    return usernames


def save_response(data: Dict[str, Any], filename: str, subdir: str = ""):
    """Save response data as JSON fixture."""
    if subdir:
        output_path = OUTPUT_DIR / subdir / filename
    else:
        output_path = OUTPUT_DIR / filename
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"💾 Saved: {output_path.relative_to(_repo_root)}")


def main():
    """Main execution flow."""
    print("=" * 60)
    print("🎯 Capturing Real API Responses for MSW Fixtures")
    print("=" * 60)
    
    # Check if services are running
    print("\n🔍 Checking if services are running...")
    try:
        search_check = requests.get(f"{SEARCH_URL}/docs", timeout=5)
        if search_check.status_code in [200, 404]:  # 404 is fine, means service is up
            print(f"✅ Search service is running")
        else:
            print(f"⚠️ Search service returned status {search_check.status_code}")
    except Exception as e:
        print(f"⚠️ Search service check failed: {e} (continuing anyway)")
    
    try:
        brightdata_check = requests.get(f"{BRIGHTDATA_URL.replace('/api/v1', '')}/docs", timeout=5)
        if brightdata_check.status_code in [200, 404]:
            print(f"✅ BrightData service is running")
        else:
            print(f"⚠️ BrightData service returned status {brightdata_check.status_code}")
    except Exception as e:
        print(f"⚠️ BrightData service check failed: {e} (continuing anyway)")
    
    # Setup Firebase
    print("\n🔧 Setting up Firebase...")
    setup_firebase()
    
    # Get auth token
    print("\n🔐 Getting authentication token...")
    try:
        token = create_test_user_and_get_token()
    except Exception as e:
        print(f"❌ Failed to get auth token: {e}")
        print("   Trying to use mock token...")
        token = "test-token-mock"
    
    # Step 1: Search for influencers
    try:
        search_response = search_influencers(token, limit=20)
        save_response(search_response, "search-enqueue-response.json", "search")
        job_id = search_response.get("job_id")
        
        if not job_id:
            raise ValueError("No job_id in search response")
        
        # Step 2: Poll for results
        job_status = poll_job_status(token, job_id)
        save_response(job_status, "search-job-status.json", "search")
        
        # Extract results
        search_results = extract_search_results(job_status)
        print(f"✅ Extracted {len(search_results)} search results")
        
        # Save search results separately
        search_results_data = {
            "success": True,
            "results": search_results,
            "count": len(search_results),
            "query": "beauty influencers",
            "method": "hybrid",
        }
        save_response(search_results_data, "search-results-20.json", "search")
        
        # Step 3: Rerank
        documents = extract_documents_from_results(search_results)
        if documents:
            print(f"   Extracted {len(documents)} documents for reranking")
            rerank_response = rerank_influencers(
                token,
                query="beauty influencers",
                documents=documents,
                top_k=10,
            )
            save_response(rerank_response, "rerank-20-response.json", "brightdata")
        else:
            print("⚠️ No documents extracted for reranking")
        
        # Step 4: Refresh images
        usernames = extract_usernames_from_results(search_results)
        if usernames:
            print(f"   Extracted {len(usernames)} usernames for image refresh")
            refresh_response = refresh_images(token, usernames)
            save_response(refresh_response, "images-refresh-20-response.json", "brightdata")
        else:
            print("⚠️ No usernames extracted for image refresh")
        
        print("\n" + "=" * 60)
        print("✅ All responses captured successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error during execution: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

