"""API routing for versioned endpoints."""

from fastapi import APIRouter

from app.config import settings
from app.api.v1.router import router as v1_router

api_router = APIRouter()
api_router.include_router(v1_router, prefix=settings.API_V1_PREFIX)

__all__ = ["api_router"]

