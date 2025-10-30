"""LLM-based post filtering to score influencer profiles against a business brief."""
from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterable, List, Optional

from openai import OpenAI

from app.config import settings


@dataclass
class ProfileFitResult:
    """Score and rationale returned from the profile fit assessor."""

    account: Optional[str]
    profile_url: Optional[str]
    followers: Optional[int]
    score: Optional[int]
    rationale: str
    error: Optional[str] = None
    prompt: Optional[str] = None
    raw_response: Optional[str] = None


def _truncate(text: Optional[str], max_len: int = 240) -> str:
    if not text:
        return ""
    s = str(text).strip()
    return (s[: max_len - 1] + "…") if len(s) > max_len else s


def _parse_posts(posts_raw: Any, max_posts: int) -> List[Dict[str, Any]]:
    """Parse posts JSON (string or list) into simplified dicts."""
    if posts_raw is None:
        return []

    posts = []
    if isinstance(posts_raw, str):
        posts_raw = posts_raw.strip()
        if not posts_raw:
            return []
        try:
            posts = json.loads(posts_raw)
        except json.JSONDecodeError:
            return []
    elif isinstance(posts_raw, list):
        posts = posts_raw
    else:
        return []

    simplified: List[Dict[str, Any]] = []
    for post in posts[:max_posts]:
        if not isinstance(post, dict):
            continue

        image_url = post.get("image_url") or post.get("thumbnail_url") or post.get("cover_image")
        if not image_url:
            # Skip posts without imagery to avoid leaking social URLs
            continue

        caption = _append_hashtags(post.get("caption"), post.get("post_hashtags"))

        simplified.append(
            {
                "caption": _truncate(caption),
                "image_url": image_url,
                "video_url": post.get("video_url"),
                "likes": post.get("likes"),
                "comments": post.get("comments"),
                "datetime": post.get("datetime"),
                "content_type": post.get("content_type"),
            }
        )
    return simplified


def _append_hashtags(caption: Optional[str], hashtags: Any) -> str:
    base = (caption or "").strip()

    tag_list: List[str] = []
    if isinstance(hashtags, str):
        tag_list = [tag.strip() for tag in hashtags.split(",") if tag.strip()]
    elif isinstance(hashtags, list):
        tag_list = [str(tag).strip() for tag in hashtags if str(tag).strip()]

    if not tag_list:
        return base

    hash_line = "Hashtags: " + " ".join(f"#{tag.lstrip('#')}" for tag in tag_list)
    return f"{base}\n{hash_line}" if base else hash_line


def build_profile_documents(
    profiles: Iterable[Dict[str, Any]],
    *,
    max_posts: int = 6,
) -> List[Dict[str, Any]]:
    """Prepare profile dictionaries with parsed posts ready for scoring."""
    documents: List[Dict[str, Any]] = []
    for profile in profiles:
        posts_raw = profile.get("posts") or profile.get("posts_raw")
        posts = _parse_posts(posts_raw, max_posts=max_posts)
        doc = dict(profile)
        doc["parsed_posts"] = posts
        documents.append(doc)
    return documents


class ProfileFitAssessor:
    """Run OpenAI-based scoring across influencer profiles."""

    def __init__(
        self,
        *,
        business_query: str,
        model: str = "gpt-5-mini",
        verbosity: str = "medium",
        max_posts: int = 6,
        concurrency: int = 8,
        openai_api_key: Optional[str] = None,
    ) -> None:
        if not business_query:
            raise ValueError("business_query must be provided for profile fit assessment")

        self.business_query = business_query
        self.model = model
        self.verbosity = verbosity
        self.max_posts = max_posts
        self.concurrency = max(1, concurrency)
        settings_api_key = settings.OPENAI_API_KEY.get_secret_value() if settings.OPENAI_API_KEY else None
        self.api_key = openai_api_key or settings_api_key

        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY must be set to run profile fit post-filtering")

    # The OpenAI client is lightweight; create per call to avoid cross-thread issues
    def _call_openai(self, prompt: str) -> str:
        client = OpenAI(api_key=self.api_key)
        response = client.responses.create(
            model=self.model,
            input=[{"role": "user", "content": prompt}],
            text={
                "format": {"type": "text"},
                "verbosity": self.verbosity,
            },
            reasoning={"effort": "medium"},
            tools=[],
            store=True,
            include=[
                "reasoning.encrypted_content",
                "web_search_call.action.sources",
            ],
        )

        if getattr(response, "output_text", None):
            return str(response.output_text).strip()

        data = response.model_dump(mode="json")
        if isinstance(data, dict):
            if data.get("output_text"):
                return str(data["output_text"]).strip()
            output_items = data.get("output", [])
            if isinstance(output_items, list):
                parts: List[str] = []
                for item in output_items:
                    if isinstance(item, dict) and item.get("type") == "output_text" and item.get("content"):
                        parts.append(str(item["content"]))
                if parts:
                    return "\n".join(parts).strip()
        return str(response)

    def _build_prompt(self, profile: Dict[str, Any]) -> str:
        bio = profile.get("biography") or ""
        profile_name = profile.get("profile_name") or profile.get("full_name") or ""
        followers = profile.get("followers")
        category = profile.get("category_name") or profile.get("business_category_name") or ""
        is_verified = profile.get("is_verified")
        profile_url = profile.get("profile_url") or profile.get("url") or ""
        posts: List[Dict[str, Any]] = profile.get("parsed_posts", [])

        lines: List[str] = []
        lines.append("Evaluate this Instagram profile for partnership suitability.")
        lines.append("")
        lines.append("Business context (user query):")
        lines.append(self.business_query)
        lines.append("")
        lines.append("Profile summary:")
        lines.append(f"- Name: {profile_name}")
        lines.append(f"- URL: {profile_url}")
        lines.append(f"- Followers: {followers}")
        lines.append(f"- Category: {category}")
        lines.append(f"- Verified: {is_verified}")
        lines.append("- Bio:")
        lines.append(str(bio))
        lines.append("")
        lines.append("Recent posts (caption and media):")
        for idx, post in enumerate(posts[: self.max_posts], start=1):
            caption = (post.get("caption") or "").strip().replace("\n", " ")
            content_type = post.get("content_type") or ""
            lines.append(f"{idx}. {caption}")
            if content_type:
                lines.append(f"   content_type: {content_type}")
            if post.get("image_url"):
                lines.append(f"   image: {post['image_url']}")
            if post.get("video_url"):
                lines.append(f"   video: {post['video_url']}")
            if post.get("url"):
                lines.append(f"   post: {post['url']}")
        lines.append("")
        lines.append("Return ONLY a strict JSON object with the following schema, no extra text:")
        lines.append('{"score": <integer 1-10>, "rationale": <string>}')
        return "\n".join(lines)

    def _score_profile(self, profile: Dict[str, Any]) -> ProfileFitResult:
        prompt = self._build_prompt(profile)
        attempts = 0
        last_error: Optional[str] = None

        while attempts < 3:
            try:
                raw = self._call_openai(prompt)
                text = (raw or "").strip()
                parsed = json.loads(text)
                score = int(parsed.get("score")) if parsed.get("score") is not None else None
                if score is not None:
                    score = max(1, min(10, score))
                rationale = parsed.get("rationale", "")
                return ProfileFitResult(
                    account=profile.get("account"),
                    profile_url=profile.get("profile_url") or profile.get("url"),
                    followers=profile.get("followers"),
                    score=score,
                    rationale=rationale,
                    prompt=prompt,
                    raw_response=text,
                )
            except Exception as exc:  # pylint: disable=broad-except
                attempts += 1
                last_error = str(exc)

        return ProfileFitResult(
            account=profile.get("account"),
            profile_url=profile.get("profile_url") or profile.get("url"),
            followers=profile.get("followers"),
            score=None,
            rationale=f"error: {last_error}",
            error=last_error,
            prompt=prompt,
            raw_response=None,
        )

    def score_profiles(
        self,
        profiles: Iterable[Dict[str, Any]],
        *,
        progress_cb: Optional[Callable[[int, int, ProfileFitResult], None]] = None,
    ) -> List[ProfileFitResult]:
        documents = build_profile_documents(profiles, max_posts=self.max_posts)
        results: List[ProfileFitResult] = []
        total = len(documents)
        completed = 0

        with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            future_map = {executor.submit(self._score_profile, profile): profile for profile in documents}
            for future in as_completed(future_map):
                fit = future.result()
                results.append(fit)
                completed += 1
                if progress_cb:
                    progress_cb(completed, total, fit)

        return results
