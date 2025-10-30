"""V1 router."""

from fastapi import APIRouter

from app.api.v1 import images, rerank

router = APIRouter()
router.include_router(images.router, prefix="/images", tags=["Images"])
router.include_router(rerank.router, prefix="", tags=["Rerank"])

__all__ = ["router"]
