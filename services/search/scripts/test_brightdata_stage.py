#!/usr/bin/env python
"""Fire a BrightData stage request against the Search API using known TikTok profiles."""

from __future__ import annotations

import argparse
import json
import sys
from typing import List

import requests

DEFAULT_BASE_URL = "http://localhost:7001/search"
PROFILE_URLS: List[str] = [
    "https://www.tiktok.com/@makeupshan",
    "https://www.tiktok.com/@chicorato64",
    "https://www.tiktok.com/@mimirane",
    "https://www.tiktok.com/@7qiix_",
    "https://www.tiktok.com/@menaminuki",
    "https://www.tiktok.com/@dizzybabakan",
    "https://www.tiktok.com/@shield.nt",
    "https://www.tiktok.com/@tsania_yoongi19",
    "https://www.tiktok.com/@_fazer_vc_flz",
    "https://www.tiktok.com/@gueuphnalyte",
    "https://www.tiktok.com/@bbellababy",
    "https://www.tiktok.com/@ittellir",
    "https://www.tiktok.com/@sonqmao",
    "https://www.tiktok.com/@beaplaysroblox",
    "https://www.tiktok.com/@michellevaleriee",
    "https://www.tiktok.com/@khim_myy07",
    "https://www.tiktok.com/@aurelliaemily",
    "https://www.tiktok.com/@salemsalem74",
    "https://www.tiktok.com/@katelynsonnier",
    "https://www.tiktok.com/@mln",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Test BrightData stage with TikTok URLs.")
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help="Search API base URL (default: %(default)s)",
    )
    args = parser.parse_args()

    endpoint = f"{args.base_url.rstrip('/')}/pipeline/brightdata"
    payload = {
        "profiles": [
            {
                "platform": "instagram" if "instagram.com" in url.lower() else "tiktok",
                "username": url.rstrip("/").split("/")[-1].lstrip("@"),
                "display_name": url.rstrip("/").split("/")[-1].lstrip("@"),
                "profile_url": url,
            }
            for url in PROFILE_URLS
        ]
    }

    print(f"POST {endpoint}")
    response = requests.post(endpoint, json=payload, timeout=60)
    print(f"Status: {response.status_code}")
    response.raise_for_status()
    job = response.json()
    job_id = job.get("job_id")
    if not job_id:
        print(json.dumps(job, indent=2))
        print("No job_id returned; cannot continue.")
        return 1

    print(f"Job queued: {job_id} (queue={job.get('queue')})")
    status_endpoint = f"{args.base_url.rstrip('/')}/job/{job_id}"

    while True:
        status_resp = requests.get(status_endpoint, timeout=30)
        status_resp.raise_for_status()
        snapshot = status_resp.json()
        print(json.dumps(snapshot, indent=2))
        state = snapshot.get("status")
        if state in {"finished", "failed"}:
            return 0 if state == "finished" else 1
        print("Job still running; waiting...")


if __name__ == "__main__":
    sys.exit(main())
