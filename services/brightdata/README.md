# DIME-AI-BD

A lightweight FastAPI service that encapsulates the BrightData image refresh functionality extracted from `DIME-AI-SEARCH-API`. The service exposes endpoints to trigger profile refreshes for Instagram accounts, monitor job status, and proxy image responses without CORS issues.

## Features

- Trigger BrightData snapshots for a batch of usernames.
- Retrieve refreshed profile image URLs aggregated from BrightData results.
- Inspect snapshot job status while refreshes are running.
- Proxy Instagram-hosted images with permissive CORS headers.

## Quickstart

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Configure BrightData credentials and Redis via environment variables:

   ```bash
   export BRIGHTDATA_API_KEY="<your-token>"
   export BRIGHTDATA_INSTAGRAM_DATASET_ID="<ig-dataset>"
   export BRIGHTDATA_TIKTOK_DATASET_ID="<tiktok-dataset>"
   ```

3. Launch the API (or use the repo-level helper script `start_all_dime.sh`, which now starts this service alongside the search API and viewer):

   ```bash
   uvicorn app.main:app --reload --port 7100
   ```

4. Access documentation at `http://localhost:7100/docs`.

## API Overview

- `POST /brightdata/images/refresh` – enqueue a refresh job for explicit usernames (returns a job ID).
- `POST /brightdata/images/refresh/search-results` – enqueue a refresh job using usernames extracted from search results.
- `GET /brightdata/images/refresh/job/{job_id}` – inspect the progress or outcome of a refresh job.
- `GET /brightdata/images/refresh/job/{job_id}/stream` – stream real-time job progress via SSE.
- `GET /brightdata/images/refresh/status` – view the health of the BrightData integration.
- `GET /brightdata/images/fetch/{platform}/{username}` – synchronously fetch a single Instagram or TikTok profile snapshot (e.g. `platform=instagram`, `username=maple_bgs`).
- `GET /brightdata/images/proxy?url=...` – proxy a remote Instagram image.

## Notes

- Refresh jobs run inside the FastAPI process using asyncio. Job state lives in-memory, so restarting the service clears historical metadata. (When you use `start_all_dime.sh`, the service is restarted automatically and logs are written under `logs/BrightData_Image_Service.log`.)
- BrightData fetches run concurrently up to `BRIGHTDATA_MAX_CONCURRENCY` (default 5). Adjust this setting to tune throughput.
- Database update hooks from the original API are retained as no-op metadata to preserve compatibility for upstream callers.

## Streaming progress

- `GET /brightdata/images/refresh/job/{job_id}/stream` returns a Server-Sent Events stream with job lifecycle updates (`queued`, `started`, `completed`, or `failed`). Each event payload includes a timestamp plus summary details (e.g., BrightData summary counts once completed). Clients can subscribe while a job is running to receive updates in real time.
