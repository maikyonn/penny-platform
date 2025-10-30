"""
Firebase authentication dependencies for FastAPI endpoints.
Add this to your existing dependencies.py or import from here.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from packages.config.py.firebase import require_auth_header, verify_id_token


async def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization")
) -> dict:
    """
    FastAPI dependency to get current authenticated user from Firebase ID token.
    
    Usage:
        @app.get("/protected")
        async def protected_route(user: dict = Depends(get_current_user)):
            return {"uid": user["uid"]}
    """
    try:
        return require_auth_header(authorization)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(
    authorization: Optional[str] = Header(None, alias="Authorization")
) -> Optional[dict]:
    """
    FastAPI dependency to get current user if authenticated, None otherwise.
    Useful for endpoints that work both authenticated and unauthenticated.
    """
    if not authorization:
        return None
    
    try:
        return require_auth_header(authorization)
    except ValueError:
        return None

