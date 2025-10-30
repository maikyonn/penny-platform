"""
Subscription checking utilities for Python services.
Validates user/organization subscription status from Firestore.
"""

from typing import Optional
from fastapi import HTTPException, status
from packages.config.py.firebase import get_firestore


def get_org_subscription(org_id: str) -> Optional[dict]:
    """
    Get organization subscription from Firestore.
    
    Args:
        org_id: Organization ID
        
    Returns:
        Subscription document or None if not found
    """
    db = get_firestore()
    sub_ref = db.collection("organizations").document(org_id).collection("subscription").document("current")
    sub_doc = sub_ref.get()
    
    if not sub_doc.exists:
        return None
    
    return sub_doc.to_dict()


def check_subscription_active(org_id: str) -> bool:
    """
    Check if organization has an active subscription.
    
    Args:
        org_id: Organization ID
        
    Returns:
        True if subscription is active, False otherwise
    """
    subscription = get_org_subscription(org_id)
    
    if not subscription:
        return False
    
    status_val = subscription.get("status", "").lower()
    active_statuses = ["active", "trialing"]
    
    return status_val in active_statuses


def require_subscription(org_id: str, plan: Optional[str] = None) -> dict:
    """
    Require an active subscription, optionally with a specific plan.
    Raises HTTPException if subscription is missing or inactive.
    
    Args:
        org_id: Organization ID
        plan: Optional plan name to require (e.g., "pro", "enterprise")
        
    Returns:
        Subscription document
        
    Raises:
        HTTPException: If subscription is missing or inactive
    """
    subscription = get_org_subscription(org_id)
    
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Subscription required. Please upgrade your plan.",
        )
    
    status_val = subscription.get("status", "").lower()
    if status_val not in ["active", "trialing"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Subscription is not active. Current status: {status_val}",
        )
    
    if plan:
        current_plan = subscription.get("plan", "").lower()
        if current_plan != plan.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires {plan} plan. Current plan: {current_plan}",
            )
    
    return subscription


def get_user_org_id(user_id: str) -> Optional[str]:
    """
    Get user's current organization ID from their profile.
    
    Args:
        user_id: User ID
        
    Returns:
        Organization ID or None
    """
    db = get_firestore()
    profile_ref = db.collection("profiles").document(user_id)
    profile_doc = profile_ref.get()
    
    if not profile_doc.exists:
        return None
    
    profile_data = profile_doc.to_dict()
    return profile_data.get("currentOrgId")


def check_feature_access(org_id: str, feature: str) -> bool:
    """
    Check if organization has access to a specific feature based on subscription plan.
    
    Args:
        org_id: Organization ID
        feature: Feature name (e.g., "advanced_search", "ai_recommendations")
        
    Returns:
        True if feature is accessible, False otherwise
    """
    subscription = get_org_subscription(org_id)
    
    if not subscription:
        return False
    
    plan = subscription.get("plan", "free").lower()
    status_val = subscription.get("status", "").lower()
    
    if status_val not in ["active", "trialing"]:
        return False
    
    # Feature access matrix
    feature_plans = {
        "advanced_search": ["starter", "pro", "enterprise"],
        "ai_recommendations": ["pro", "enterprise"],
        "custom_workflows": ["enterprise"],
        "api_access": ["pro", "enterprise"],
        "unlimited_searches": ["pro", "enterprise"],
        "priority_support": ["enterprise"],
    }
    
    required_plans = feature_plans.get(feature, [])
    return plan in required_plans

