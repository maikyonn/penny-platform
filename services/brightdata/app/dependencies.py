"""Dependency wiring for the BrightData service."""

from typing import Optional

from fastapi import HTTPException

from app.services import ImageRefreshService

_image_refresh_service: Optional[ImageRefreshService] = None


def init_image_refresh_service() -> bool:
    """Initialise the singleton image refresh service."""
    global _image_refresh_service
    if _image_refresh_service is None:
        try:
            service = ImageRefreshService()
            _image_refresh_service = service
            if service.is_available:
                print("✅ BrightData image refresh service initialised")
                return True
            print("⚠️ BrightData image refresh service unavailable - check configuration")
            return False
        except Exception as exc:  # pylint: disable=broad-except
            print(f"⚠️ BrightData image refresh service initialization failed: {exc}")
            print("⚠️ Service will continue but image refresh endpoints will be unavailable")
            # Create a minimal service instance that indicates unavailability
            # This allows the FastAPI app to start even if BrightData isn't configured
            class UnavailableService:
                is_available = False
                def __getattr__(self, name):
                    raise RuntimeError(f"BrightData service unavailable: {exc}")
            _image_refresh_service = UnavailableService()
            return False
    return _image_refresh_service.is_available if hasattr(_image_refresh_service, 'is_available') else False


def get_image_refresh_service() -> ImageRefreshService:
    """FastAPI dependency that returns the configured service."""
    if _image_refresh_service is None or not _image_refresh_service.is_available:
        raise HTTPException(
            status_code=503,
            detail="Image refresh service not available. Configure BrightData credentials.",
        )
    return _image_refresh_service


async def get_optional_image_refresh_service() -> Optional[ImageRefreshService]:
    """Return the service instance when available, None otherwise."""
    return _image_refresh_service if _image_refresh_service and _image_refresh_service.is_available else None
