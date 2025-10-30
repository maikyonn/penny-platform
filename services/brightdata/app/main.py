"""Application entrypoint for the BrightData FastAPI service."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.config import settings
from app.dependencies import init_image_refresh_service


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.VERSION,
        debug=settings.DEBUG,
    )

    if settings.ALLOWED_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.ALLOWED_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.on_event("startup")
    async def startup_event() -> None:
        init_image_refresh_service()

    @app.get("/health", tags=["Health"])
    async def health_check() -> dict:
        return {"status": "ok", "service": settings.APP_NAME, "version": settings.VERSION}

    app.include_router(api_router)

    return app


app = create_app()

