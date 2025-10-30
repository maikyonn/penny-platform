"""
Authentication and authorization middleware for BrightData FastAPI service.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from packages.config.py.firebase import require_auth_header
from packages.config.py.subscription import get_user_org_id, require_subscription


async def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization")
) -> dict:
    """
    FastAPI dependency to get current authenticated user.
    Raises 401 if not authenticated.
    """
    try:
        return require_auth_header(authorization)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_org(
    user: dict = Depends(get_current_user)
) -> str:
    """
    FastAPI dependency to get user's current organization ID.
    Raises 404 if user has no organization.
    """
    org_id = get_user_org_id(user["uid"])
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of any organization",
        )
    return org_id


async def require_active_subscription(
    org_id: str = Depends(get_current_user_org)
) -> dict:
    """
    FastAPI dependency to require an active subscription.
    Raises 402 if subscription is missing or inactive.
    """
    from packages.config.py.subscription import require_subscription
    return require_subscription(org_id)

