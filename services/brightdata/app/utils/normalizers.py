"""BrightData record normalisation mirrored from DIME-AI-DB."""

from __future__ import annotations

import json
import math
import re
from datetime import datetime
from statistics import median
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


COMBINED_HEADERS = [
    "lance_db_id",
    "platform",
    "platform_id",
    "username",
    "display_name",
    "biography",
    "followers",
    "following",
    "posts_count",
    "likes_total",
    "engagement_rate",
    "external_url",
    "profile_url",
    "profile_image_url",
    "is_verified",
    "is_private",
    "is_commerce_user",
    "posts",
    "reel_post_ratio_last10",
    "median_view_count_last10",
    "median_like_count_last10",
    "median_comment_count_last10",
    "total_img_posts_ig",
    "total_reels_ig",
]

EXTRA_FIELDS = [
    "individual_vs_org_score",
    "generational_appeal_score",
    "professionalization_score",
    "relationship_status_score",
    "location",
    "ethnicity",
    "age",
    "occupation",
    "keyword1",
    "keyword2",
    "keyword3",
    "keyword4",
    "keyword5",
    "keyword6",
    "keyword7",
    "keyword8",
    "keyword9",
    "keyword10",
    "prompt_file",
    "raw_response",
    "processing_error",
    "source_batch",
    "llm_processed",
    "source_csv",
]


def normalize_profile_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise a single BrightData record."""

    platform = detect_platform(record)
    if platform == "tiktok":
        base_row = _normalize_tiktok_record(record)
    else:
        base_row = _normalize_instagram_record(record)

    base_row["platform"] = platform
    base_row["lance_db_id"] = ""

    for field in EXTRA_FIELDS:
        base_row.setdefault(field, "")

    # Surface BrightData warnings/errors alongside the normalised row.
    base_row["warning"] = _to_string(record.get("warning"))
    base_row["warning_code"] = _to_string(record.get("warning_code"))
    base_row["error"] = _to_string(record.get("error"))
    base_row["error_code"] = _to_string(record.get("error_code"))
    base_row["input_url"] = _extract_input_url(record) or base_row.get("profile_url", "")

    return base_row


def detect_platform(record: Dict[str, Any]) -> str:
    explicit = _to_string(record.get("platform") or record.get("platform_name"))
    if explicit:
        lowered = explicit.lower()
        if "tiktok" in lowered:
            return "tiktok"
        if "instagram" in lowered:
            return "instagram"

    url_value = _to_string(record.get("profile_url") or record.get("url"))
    if "tiktok.com" in url_value:
        return "tiktok"
    if "instagram.com" in url_value:
        return "instagram"
    return "instagram"


# ---------------------------------------------------------------------------
# TikTok normalisation
# ---------------------------------------------------------------------------


def _normalize_tiktok_record(record: Dict[str, Any]) -> Dict[str, Any]:
    row = {column: "" for column in COMBINED_HEADERS}
    row["platform"] = "tiktok"

    username = _first_non_empty(
        _to_string(record.get("account_id")),
        _to_string(record.get("account")),
        _to_string(record.get("username")),
    )
    display_name = _first_non_empty(
        _decode_text(record.get("profile_name")),
        _decode_text(record.get("nickname")),
        username,
    )

    row["platform_id"] = _to_string(record.get("id"))
    row["username"] = username
    row["display_name"] = display_name
    row["biography"] = _decode_text(record.get("biography") or record.get("signature"))
    row["followers"] = _to_string(record.get("followers"))
    row["following"] = _to_string(record.get("following"))
    row["posts_count"] = _to_string(record.get("videos_count"))
    row["likes_total"] = _to_string(record.get("likes") or record.get("likes_total"))
    row["engagement_rate"] = _to_string(
        record.get("avg_engagement") or record.get("awg_engagement_rate")
    )
    row["external_url"] = _to_string(record.get("bio_link") or record.get("external_url"))
    profile_url = _first_non_empty(
        _to_string(record.get("profile_url")),
        _to_string(record.get("url")),
        _extract_input_url(record),
    )
    row["profile_url"] = profile_url
    row["profile_image_url"] = _first_non_empty(
        _to_string(record.get("profile_pic_url_hd")),
        _to_string(record.get("profile_pic_url")),
        _to_string(record.get("profile_image_link")),
    )
    row["is_verified"] = _normalize_flag(record.get("is_verified"))
    row["is_private"] = _normalize_flag(record.get("is_private"))
    row["is_commerce_user"] = _normalize_flag(record.get("is_commerce_user"))

    merged_posts = _merge_tiktok_posts(record)
    posts_json = _normalize_posts(merged_posts, "tiktok")
    ratio, median_view, median_like, median_comment = _compute_post_statistics(posts_json)

    row["posts"] = posts_json
    row["reel_post_ratio_last10"] = ratio
    row["median_view_count_last10"] = median_view
    row["median_like_count_last10"] = median_like
    row["median_comment_count_last10"] = median_comment
    row["total_img_posts_ig"] = ""
    row["total_reels_ig"] = ""

    return row


def _merge_tiktok_posts(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    videos = _safe_json_loads(raw.get("top_videos"))
    posts = _safe_json_loads(raw.get("top_posts_data"))
    extra = _safe_json_loads(raw.get("posts"))

    combined: Dict[str, Dict[str, Any]] = {}
    order: List[str] = []

    def _ensure(identifier: str) -> Dict[str, Any]:
        if identifier not in combined:
            combined[identifier] = {"video_id": identifier}
            order.append(identifier)
        return combined[identifier]

    def _identifier(item: Dict[str, Any], keys: Sequence[str]) -> Optional[str]:
        for key in keys:
            value = item.get(key)
            if value not in (None, "", []):
                return str(value)
        url_value = _first_non_empty(
            _to_string(item.get("video_url")),
            _to_string(item.get("post_url")),
            _to_string(item.get("url")),
        )
        return url_value or None

    def _merge(items: Iterable[Any], keys: Sequence[str]) -> None:
        if not isinstance(items, list):
            return
        for entry in items:
            if not isinstance(entry, dict):
                continue
            identifier = _identifier(entry, keys)
            if not identifier:
                continue
            target = _ensure(identifier)
            for key, value in entry.items():
                if key not in target or target[key] in (None, "", []):
                    target[key] = value

    _merge(posts, ("post_id", "video_id", "aweme_id"))
    _merge(videos, ("video_id", "post_id", "aweme_id"))
    _merge(extra, ("post_id", "video_id", "aweme_id"))

    return [combined[key] for key in order]


# ---------------------------------------------------------------------------
# Instagram normalisation
# ---------------------------------------------------------------------------


def _normalize_instagram_record(record: Dict[str, Any]) -> Dict[str, Any]:
    row = {column: "" for column in COMBINED_HEADERS}
    row["platform"] = "instagram"

    username = _first_non_empty(_to_string(record.get("account")), _to_string(record.get("username")))
    display_name = _first_non_empty(
        _decode_text(record.get("profile_name")),
        _decode_text(record.get("full_name")),
        username,
    )

    row["platform_id"] = _first_non_empty(
        _to_string(record.get("platform_id")),
        _to_string(record.get("fbid")),
        _to_string(record.get("id")),
    )
    row["username"] = username
    row["display_name"] = display_name
    row["biography"] = _decode_text(record.get("biography"))
    row["followers"] = _to_string(record.get("followers"))
    row["following"] = _to_string(record.get("following"))
    row["posts_count"] = _to_string(record.get("posts_count"))
    row["likes_total"] = _to_string(record.get("likes_total") or record.get("likes"))
    row["engagement_rate"] = _to_string(record.get("avg_engagement"))
    row["external_url"] = _to_string(record.get("external_url"))
    profile_url = _first_non_empty(
        _to_string(record.get("profile_url")),
        _to_string(record.get("url")),
        _extract_input_url(record),
    )
    row["profile_url"] = profile_url
    row["profile_image_url"] = _first_non_empty(
        _to_string(record.get("profile_image_link")),
        _to_string(record.get("profile_image_url")),
    )
    row["is_verified"] = _normalize_flag(record.get("is_verified"))
    row["is_private"] = _normalize_flag(record.get("is_private"))
    row["is_commerce_user"] = _normalize_flag(record.get("is_commerce_user"))

    posts_json = _normalize_posts(_safe_json_loads(record.get("posts")), "instagram")
    ratio, median_view, median_like, median_comment = _compute_post_statistics(posts_json)
    total_images, total_reels = _count_instagram_media(posts_json)

    row["posts"] = posts_json
    row["reel_post_ratio_last10"] = ratio
    row["median_view_count_last10"] = median_view
    row["median_like_count_last10"] = median_like
    row["median_comment_count_last10"] = median_comment
    row["total_img_posts_ig"] = total_images
    row["total_reels_ig"] = total_reels

    return row


# ---------------------------------------------------------------------------
# Post helpers (copied from DIME-AI-DB pipeline)
# ---------------------------------------------------------------------------


def _normalize_posts(entries: Any, platform: str) -> str:
    posts: List[Dict[str, Any]] = []
    if isinstance(entries, str):
        entries = _safe_json_loads(entries)
    if not isinstance(entries, list):
        entries = []

    def _first(item: Dict[str, Any], *keys: str) -> Any:
        for key in keys:
            if key in item and item[key] not in (None, "", []):
                return item[key]
        return None

    def _to_int(value: Any) -> Optional[int]:
        if value in (None, "", []):
            return None
        try:
            return int(float(value))
        except Exception:
            return None

    def _to_list(value: Any) -> Optional[List[Any]]:
        if value in (None, ""):
            return None
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                parts = [part.strip() for part in value.split(",") if part.strip()]
                return parts or None
        return None

    for item in entries:
        if not isinstance(item, dict):
            continue

        post_id = _first(item, "id", "post_id", "aweme_id", "video_id")
        caption = _first(item, "caption", "desc", "title", "text", "description") or ""
        if isinstance(caption, str):
            caption = _decode_text(caption)
        like_count = _to_int(
            _first(item, "likes", "like_count", "diggCount", "diggcount", "collectCount")
        )
        favorite_count = _to_int(
            _first(item, "favorites_count", "favoriteCount", "collectCount")
        )
        comment_count = _to_int(
            _first(item, "comments", "comment_count", "commentCount", "commentcount")
        )
        share_count = _to_int(_first(item, "share_count", "shareCount", "forwardCount"))
        view_count = _to_int(_first(item, "view_count", "viewCount", "playCount", "playcount"))
        url = _first(
            item,
            "url",
            "videoUrl",
            "video_url",
            "share_url",
            "permalink",
            "post_url",
        )
        media_type = _first(
            item,
            "content_type",
            "media_type",
            "type",
            "post_type",
        ) or ("video" if platform == "tiktok" else "image")
        timestamp = _first(
            item,
            "datetime",
            "createTime",
            "create_time",
            "create_date",
            "published_at",
        )
        duration = _first(item, "duration", "videoDuration", "video_duration")
        hashtags_raw = _to_list(_first(item, "hashtags", "post_hashtags"))
        hashtags: List[str] = []
        if hashtags_raw:
            for tag in hashtags_raw:
                if isinstance(tag, str) and tag.strip():
                    clean_tag = tag.strip()
                    if clean_tag.startswith("#"):
                        clean_tag = clean_tag[1:]
                    if clean_tag:
                        hashtags.append(clean_tag)
        thumbnail_url = _first(
            item,
            "image_url",
            "thumbnail_url",
            "thumb_url",
            "cover_image",
        )

        location_name = ""
        if platform == "instagram":
            location_value = (
                item.get("location")
                or item.get("place")
                or item.get("location_name")
            )
            if isinstance(location_value, dict):
                location_name = _decode_text(
                    _first(location_value, "name", "title", "short_name") or ""
                )
            elif isinstance(location_value, str):
                location_name = _decode_text(location_value)
            elif isinstance(location_value, list) and location_value:
                first_loc = location_value[0]
                if isinstance(first_loc, dict):
                    location_name = _decode_text(
                        _first(first_loc, "name", "title", "short_name") or ""
                    )

        if caption and hashtags:
            cleaned_caption = caption
            for tag in hashtags:
                pattern = re.compile(rf"(?i)(?<!\\w)#\s*{re.escape(tag)}\b")
                cleaned_caption = pattern.sub("", cleaned_caption)
            cleaned_caption = re.sub(r"\s+", " ", cleaned_caption).strip()
            caption = cleaned_caption
        elif caption:
            caption = re.sub(r"\s+", " ", caption).strip()

        mapped = {
            "platform": platform,
            "id": post_id,
            "caption": caption,
            "hashtags": hashtags or [],
            "like_count": like_count,
            "comment_count": comment_count,
            "share_count": share_count,
            "view_count": view_count,
            "favorite_count": favorite_count,
            "url": url,
            "media_type": media_type,
            "timestamp": timestamp,
            "duration": duration,
            "thumbnail_url": thumbnail_url,
            "location_name": location_name,
        }

        extra = {
            key: value
            for key, value in item.items()
            if key not in {
                "id",
                "post_id",
                "aweme_id",
                "video_id",
                "caption",
                "desc",
                "title",
                "text",
                "description",
                "likes",
                "like_count",
                "diggCount",
                "diggcount",
                "collectCount",
                "favorites_count",
                "favoriteCount",
                "comments",
                "comment_count",
                "commentCount",
                "commentcount",
                "share_count",
                "shareCount",
                "forwardCount",
                "view_count",
                "viewCount",
                "playCount",
                "playcount",
                "url",
                "videoUrl",
                "video_url",
                "share_url",
                "permalink",
                "post_url",
                "content_type",
                "media_type",
                "type",
                "post_type",
                "datetime",
                "createTime",
                "create_time",
                "create_date",
                "published_at",
                "duration",
                "videoDuration",
                "video_duration",
                "hashtags",
                "post_hashtags",
                "image_url",
                "thumbnail_url",
                "thumb_url",
                "cover_image",
            }
        }
        if extra:
            mapped["extra"] = extra

        posts.append(mapped)

    return json.dumps(posts, ensure_ascii=False)


def _compute_post_statistics(posts_json: str) -> Tuple[str, str, str, str]:
    if not posts_json:
        return "", "", "", ""
    try:
        posts = json.loads(posts_json)
    except Exception:
        return "", "", "", ""
    if not isinstance(posts, list):
        return "", "", "", ""

    def _parse_timestamp(value: Any) -> Optional[datetime]:
        if not isinstance(value, str) or not value.strip():
            return None
        raw = value.strip()
        try:
            if raw.endswith("Z"):
                return datetime.fromisoformat(raw[:-1] + "+00:00")
            return datetime.fromisoformat(raw)
        except Exception:
            for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
                try:
                    return datetime.strptime(raw, fmt)
                except Exception:
                    continue
        return None

    enumerated: List[Tuple[int, Dict[str, Any], Optional[datetime]]] = []
    for idx, post in enumerate(posts):
        if isinstance(post, dict):
            enumerated.append((idx, post, _parse_timestamp(post.get("timestamp"))))

    with_timestamp = [item for item in enumerated if item[2] is not None]
    without_timestamp = [item for item in enumerated if item[2] is None]
    with_timestamp.sort(key=lambda item: item[2], reverse=True)
    without_timestamp.sort(key=lambda item: item[0])

    ordered_posts = [item[1] for item in with_timestamp + without_timestamp][:10]

    total = 0
    reel_like = 0
    view_values: List[int] = []
    like_values: List[int] = []
    comment_values: List[int] = []

    for post in ordered_posts:
        if not isinstance(post, dict):
            continue
        total += 1
        media_type = post.get("media_type")
        if _is_video_type(media_type if isinstance(media_type, str) else None):
            reel_like += 1

        like = post.get("like_count")
        if isinstance(like, (int, float)):
            like_values.append(int(like))
        view = post.get("view_count")
        if isinstance(view, (int, float)):
            view_values.append(int(view))
        comments = post.get("comment_count")
        if isinstance(comments, (int, float)):
            comment_values.append(int(comments))

    def _format_ratio(num: int, denom: int) -> str:
        if denom <= 0:
            return ""
        ratio = num / denom
        return f"{ratio:.3f}"

    def _format_median(values: List[int]) -> str:
        if not values:
            return ""
        med = median(values)
        if isinstance(med, float) and med.is_integer():
            return str(int(med))
        return f"{float(med):.3f}"

    return (
        _format_ratio(reel_like, total),
        _format_median(view_values),
        _format_median(like_values),
        _format_median(comment_values),
    )


def _count_instagram_media(posts_json: str) -> Tuple[str, str]:
    if not posts_json:
        return "", ""
    try:
        posts = json.loads(posts_json)
    except Exception:
        return "", ""
    if not isinstance(posts, list):
        return "", ""

    image_types = {"graphimage", "image", "photo", "graphsidecar"}
    reel_types = {"reel", "video", "graphvideo", "igtv"}

    total_images = 0
    total_reels = 0
    for post in posts:
        if not isinstance(post, dict):
            continue
        media_type = post.get("media_type")
        if isinstance(media_type, str):
            lowered = media_type.lower()
            if lowered in image_types or "image" in lowered or "photo" in lowered:
                total_images += 1
            elif lowered in reel_types or "video" in lowered or "reel" in lowered:
                total_reels += 1

    images_str = str(total_images) if total_images else ""
    reels_str = str(total_reels) if total_reels else ""
    return images_str, reels_str


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------


def _first_non_empty(*values: Optional[str]) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _normalize_flag(value: object) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        if math.isnan(value):
            return ""
        return "true" if value else "false"
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y"}:
            return "true"
        if normalized in {"false", "0", "no", "n"}:
            return "false"
    return ""


def _to_string(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return str(value)


def _safe_json_loads(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if not value:
        return []
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
        except Exception:
            return []
        return parsed if isinstance(parsed, list) else []
    return []


def _decode_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    if not value:
        return ""
    try:
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        decoded = json.loads(f'"{escaped}"')
    except Exception:
        decoded = value
    decoded = decoded.strip()
    return re.sub(r"\s+", " ", decoded)


def _is_video_type(media_type: Optional[str]) -> bool:
    if not media_type:
        return False
    lowered = media_type.lower()
    if "video" in lowered or "reel" in lowered:
        return True
    if lowered in {"reel", "video", "graphvideo", "igtv"}:
        return True
    return False


def _extract_input_url(record: Dict[str, Any]) -> Optional[str]:
    input_value = record.get("input")
    if isinstance(input_value, str):
        text = input_value.strip()
        if not text:
            return None
        try:
            payload = json.loads(text)
            if isinstance(payload, dict):
                url = payload.get("url") or payload.get("profile_url")
                return _to_string(url)
        except Exception:
            return None
    return None
