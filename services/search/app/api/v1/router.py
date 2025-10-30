"""Main API router for v1 endpoints"""
from fastapi import APIRouter

from app.api.v1 import jobs, search

# Create main API router
api_router = APIRouter()

# Include sub-routers
api_router.include_router(search.router, prefix="", tags=["Search"])
api_router.include_router(jobs.router, prefix="", tags=["Jobs"])
