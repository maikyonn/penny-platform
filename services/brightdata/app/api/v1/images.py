"""Image refresh API endpoints backed by BrightData + async workers."""

import asyncio
import json
import socket
from ipaddress import ip_address
from typing import List, Optional, Set
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.config import settings
from app.dependencies import get_image_refresh_service, get_optional_image_refresh_service
from app.models import ImageRefreshRequest, ImageRefreshSearchRequest, ProfileHandle
from app.services import ImageRefreshService

router = APIRouter()

ALLOWED_IMAGE_HOSTS: Set[str] = {"cdninstagram.com", "fna.fbcdn.net", "instagram.com"}


@router.post("/refresh")
async def refresh_images(
    request: ImageRefreshRequest,
    image_service: ImageRefreshService = Depends(get_image_refresh_service),
):
    """Queue a BrightData refresh job for the specified usernames."""
    try:
        profiles = request.resolve_profiles()
        job_id = await image_service.enqueue_refresh_job(profiles)
        response_data = {
            "success": True,
            "job_id": job_id,
            "queued_profiles": [profile.model_dump() for profile in profiles],
        }
        if request.update_database:
            response_data["database_update"] = {
                "status": "disabled",
                "message": "Database updates are not supported by the BrightData service",
            }
        return response_data
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=f"Image refresh enqueue failed: {exc}") from exc


@router.post("/refresh/search-results")
async def refresh_images_for_search_results(
    request: ImageRefreshSearchRequest,
    image_service: ImageRefreshService = Depends(get_image_refresh_service),
):
    """Queue a refresh job for usernames extracted from search results."""
    try:
        handles = _extract_profile_handles(request.search_results)
        if not handles:
            raise HTTPException(status_code=400, detail="No valid creator handles found in search results")

        max_items = settings.BRIGHTDATA_MAX_URLS or 50
        if len(handles) > max_items:
            handles = handles[:max_items]

        job_id = await image_service.enqueue_refresh_job(handles)

        response_data = {
            "success": True,
            "job_id": job_id,
            "queued_profiles": [handle.model_dump() for handle in handles],
        }

        if request.update_database:
            response_data["database_update"] = {
                "status": "disabled",
                "message": "Database updates are not supported by the BrightData service",
            }

        return response_data
    except HTTPException:
        raise
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=f"Image refresh enqueue failed: {exc}") from exc


@router.get("/refresh/job/{job_id}")
async def get_refresh_job_status(
    job_id: str,
    image_service: ImageRefreshService = Depends(get_image_refresh_service),
):
    """Return the current state of a queued BrightData job."""
    try:
        job_status = await image_service.get_job_status(job_id)
        if job_status:
            return {"success": True, "job": job_status}
        raise HTTPException(status_code=404, detail="Job not found")
    except HTTPException:
        raise
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=f"Failed to get job status: {exc}") from exc


@router.get("/refresh/job/{job_id}/stream")
async def stream_refresh_job(
    job_id: str,
    image_service: ImageRefreshService = Depends(get_image_refresh_service),
):
    """Stream real-time job events as Server-Sent Events."""
    try:
        event_iter = await image_service.stream_job_events(job_id)
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=f"Failed to prepare stream: {exc}") from exc

    if event_iter is None:
        raise HTTPException(status_code=404, detail="Job not found")

    heartbeat_interval = 15
    iterator = event_iter.__aiter__()

    async def event_source():
        while True:
            try:
                event = await asyncio.wait_for(iterator.__anext__(), timeout=heartbeat_interval)
            except StopAsyncIteration:
                break
            except asyncio.TimeoutError:
                yield ": heartbeat\n\n"
                continue
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/refresh/status")
async def get_service_status(
    image_service: ImageRefreshService = Depends(get_optional_image_refresh_service),
):
    """Get status of the image refresh service."""
    service_available = image_service is not None
    return {
        "service_available": service_available,
        "active_jobs": await image_service.get_active_jobs_count() if service_available else 0,
        "brightdata_configured": service_available,
    }


@router.get("/fetch/{platform}/{username}")
async def fetch_single_profile(
    platform: str,
    username: str,
    image_service: ImageRefreshService = Depends(get_image_refresh_service),
):
    """Fetch a single Instagram or TikTok profile snapshot synchronously."""
    try:
        payload = await image_service.fetch_single_profile(username=username, platform=platform)
        return {"success": True, "result": payload}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=f"Single profile fetch failed: {exc}") from exc


@router.get("/proxy")
async def proxy_image(url: str = Query(..., description="Image URL to proxy")):
    """Proxy Instagram images to bypass CORS restrictions while guarding against SSRF."""
    if not url:
        raise HTTPException(status_code=400, detail="No URL provided")

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Invalid URL scheme")

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL host")

    if not _is_allowed_host(hostname):
        raise HTTPException(status_code=403, detail="Invalid domain")

    if not await _is_public_hostname(hostname):
        raise HTTPException(status_code=403, detail="Blocked host address")

    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            ),
            "Referer": "https://www.instagram.com/",
            "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        }
        client = httpx.AsyncClient(timeout=10.0, follow_redirects=True)
        request = client.build_request("GET", url, headers=headers)
        response = await client.send(request, stream=True)

        try:
            await _validate_redirect_chain(response)

            if response.status_code != httpx.codes.OK:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch image")

            content_type = response.headers.get("content-type", "image/jpeg")

            async def body_generator():
                try:
                    async for chunk in response.aiter_bytes():
                        yield chunk
                finally:
                    await response.aclose()
                    await client.aclose()

            return StreamingResponse(
                body_generator(),
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            )
        except Exception:
            await response.aclose()
            await client.aclose()
            raise
    except HTTPException:
        raise
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=408, detail="Request timeout") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Request failed: {exc}") from exc
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=f"Proxy error: {exc}") from exc


def _extract_profile_handles(search_results: List[dict]) -> List[ProfileHandle]:
    handles: List[ProfileHandle] = []
    for result in search_results:
        if not isinstance(result, dict):
            continue

        profile_url = result.get("profile_url") or result.get("url")
        username: Optional[str] = None
        platform: Optional[str] = None

        if isinstance(profile_url, str) and profile_url.strip():
            platform = _infer_platform(profile_url)
            username = _extract_username_from_url(profile_url)

        if not username:
            account = result.get("account") or result.get("username")
            if isinstance(account, str) and account.strip():
                username = account.strip()

        if not username:
            continue

        handles.append(ProfileHandle(username=username, platform=platform or "instagram"))
    return handles


def _infer_platform(url: str) -> Optional[str]:
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return None
    if "tiktok.com" in host:
        return "tiktok"
    if "instagram.com" in host:
        return "instagram"
    return None


def _extract_username_from_url(url: str) -> Optional[str]:
    try:
        parsed = urlparse(url)
    except Exception:
        return None
    path = (parsed.path or "").strip("/")
    if not path:
        return None
    segments = path.split("/")
    candidate = segments[0]
    if candidate.startswith("@"):
        candidate = candidate[1:]
    return candidate or None


def _is_allowed_host(hostname: str) -> bool:
    return any(hostname == pattern or hostname.endswith(f".{pattern}") for pattern in ALLOWED_IMAGE_HOSTS)


async def _is_public_hostname(hostname: str) -> bool:
    loop = asyncio.get_running_loop()
    try:
        addrinfo = await loop.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return False
    except Exception:
        return False

    for _, _, _, _, sockaddr in addrinfo:
        ip_str = sockaddr[0]
        try:
            ip = ip_address(ip_str)
        except ValueError:
            return False
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False
    return True


async def _validate_redirect_chain(response: httpx.Response) -> None:
    for http_response in list(response.history) + [response]:
        request_url = http_response.request.url
        host = (request_url.host or "").lower()
        if not host:
            raise HTTPException(status_code=400, detail="Invalid redirect host")
        if not _is_allowed_host(host):
            raise HTTPException(status_code=403, detail="Redirected to disallowed host")
        if not await _is_public_hostname(host):
            raise HTTPException(status_code=403, detail="Redirected to blocked host")
