"""Streamlit app to exercise the Penny Search pipeline stage-by-stage."""

from __future__ import annotations

import io
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urlparse

import pandas as pd
import requests
import streamlit as st

try:
    from app.services.stages import normalize_stage_name
except ModuleNotFoundError:
    import sys
    from pathlib import Path

    PROJECT_ROOT = Path(__file__).resolve().parents[1]
    if str(PROJECT_ROOT) not in sys.path:
        sys.path.insert(0, str(PROJECT_ROOT))
    from app.services.stages import normalize_stage_name


st.set_page_config(page_title="Penny Search Stage Tester", layout="wide")
st.title("🔍 Penny Search – Stage Tester")
st.caption("Experiment with Search → BrightData → LLM stages interactively.")

if "search_results" not in st.session_state:
    st.session_state.search_results: Optional[List[Dict[str, Any]]] = None
if "brightdata_results" not in st.session_state:
    st.session_state.brightdata_results: Optional[List[Dict[str, Any]]] = None
if "pipeline_job_id" not in st.session_state:
    st.session_state.pipeline_job_id: Optional[str] = None
if "pipeline_job_info" not in st.session_state:
    st.session_state.pipeline_job_info: Optional[Dict[str, Any]] = None
if "pipeline_results" not in st.session_state:
    st.session_state.pipeline_results: Optional[List[Dict[str, Any]]] = None
if "pipeline_results_csv" not in st.session_state:
    st.session_state.pipeline_results_csv: Optional[str] = None
if "search_job_id" not in st.session_state:
    st.session_state.search_job_id: Optional[str] = None
if "search_job_status" not in st.session_state:
    st.session_state.search_job_status: Optional[Dict[str, Any]] = None
if "bd_job_id" not in st.session_state:
    st.session_state.bd_job_id: Optional[str] = None
if "bd_job_status" not in st.session_state:
    st.session_state.bd_job_status: Optional[Dict[str, Any]] = None
if "bd_last_result" not in st.session_state:
    st.session_state.bd_last_result: Optional[Dict[str, Any]] = None
if "bd_events" not in st.session_state:
    st.session_state.bd_events: List[Dict[str, Any]] = []
if "bd_service_url" not in st.session_state:
    st.session_state.bd_service_url = "http://localhost:9101/brightdata/images"
if "brightdata_stage_job_id" not in st.session_state:
    st.session_state.brightdata_stage_job_id: Optional[str] = None
if "brightdata_stage_status" not in st.session_state:
    st.session_state.brightdata_stage_status: Optional[Dict[str, Any]] = None
if "llm_stage_job_id" not in st.session_state:
    st.session_state.llm_stage_job_id: Optional[str] = None
if "llm_stage_status" not in st.session_state:
    st.session_state.llm_stage_status: Optional[Dict[str, Any]] = None
if "rerank_service_url" not in st.session_state:
    st.session_state.rerank_service_url = "http://localhost:9101/brightdata/rerank"
if "rerank_status" not in st.session_state:
    st.session_state.rerank_status: Optional[Dict[str, Any]] = None
if "last_search_query" not in st.session_state:
    st.session_state.last_search_query: Optional[str] = None


def call_api(base_url: str, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{base_url.rstrip('/')}{path}"
    response = requests.post(url, json=payload, timeout=120)
    if not response.ok:
        raise RuntimeError(f"{response.status_code} {response.reason}: {response.text}")
    return response.json()


def get_job_status(base_url: str, job_id: str) -> Dict[str, Any]:
    url = f"{base_url.rstrip('/')}/job/{job_id}"
    response = requests.get(url, timeout=30)
    if not response.ok:
        raise RuntimeError(f"{response.status_code} {response.reason}: {response.text}")
    return response.json()


def _build_profile_handle(value: str) -> Optional[Dict[str, str]]:
    raw = (value or "").strip()
    if not raw:
        return None
    platform = "instagram"
    username = raw.lstrip("@")

    try:
        parsed = urlparse(raw)
    except Exception:
        parsed = None

    if parsed and parsed.netloc:
        host = parsed.netloc.lower()
        path = (parsed.path or "").strip("/")
        if not path:
            return None
        username = path.split("/")[0].lstrip("@")
        if "tiktok.com" in host:
            platform = "tiktok"
        elif "instagram.com" in host:
            platform = "instagram"
    elif raw.startswith("@"):
        platform = "instagram"

    if not username:
        return None
    return {"username": username, "platform": platform}


def _parse_handles_from_lines(raw_text: str) -> List[Dict[str, str]]:
    handles: List[Dict[str, str]] = []
    for line in (raw_text or "").splitlines():
        handle = _build_profile_handle(line)
        if handle:
            handles.append(handle)
    seen = set()
    unique: List[Dict[str, str]] = []
    for handle in handles:
        key = (handle["platform"], handle["username"].lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append(handle)
    return unique[:50]


def _iter_brightdata_events(base_url: str, job_id: str):
    stream_url = f"{base_url.rstrip('/')}/refresh/job/{job_id}/stream"
    with requests.get(stream_url, stream=True, timeout=300) as response:
        response.raise_for_status()
        for raw_line in response.iter_lines(decode_unicode=True):
            if not raw_line or not raw_line.startswith("data:"):
                continue
            payload = raw_line.split("data:", 1)[1].strip()
            if not payload:
                continue
            try:
                yield json.loads(payload)
            except json.JSONDecodeError:
                continue


def _fetch_brightdata_job(base_url: str, job_id: str) -> Dict[str, Any]:
    url = f"{base_url.rstrip('/')}/refresh/job/{job_id}"
    response = requests.get(url, timeout=30)
    if response.status_code == 404:
        raise RuntimeError("BrightData job not found")
    response.raise_for_status()
    payload = response.json()
    return payload.get("job") or payload


_PROFILE_COMPLETED_STAGES = {"BRIGHTDATA_PROFILE_COMPLETED"}
_PROFILE_FAILED_STAGES = {"BRIGHTDATA_PROFILE_FAILED"}
_PROFILE_SKIPPED_STAGES = {"BRIGHTDATA_PROFILE_SKIPPED"}


def _safe_int(value: Any) -> Optional[int]:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _max_hint(current: Optional[int], new: Optional[int]) -> Optional[int]:
    if new is None:
        return current
    return new if current is None or new > current else current


@dataclass
class BrightDataProgressState:
    total_hint: Optional[int] = None
    success_keys: Set[str] = field(default_factory=set)
    failed_keys: Set[str] = field(default_factory=set)
    skipped_keys: Set[str] = field(default_factory=set)

    def merge(self, other: "BrightDataProgressState") -> None:
        self.total_hint = _max_hint(self.total_hint, other.total_hint)
        self.success_keys.update(other.success_keys)
        self.failed_keys.update(other.failed_keys)
        self.skipped_keys.update(other.skipped_keys)

    def processed_count(self) -> int:
        return len(self.success_keys | self.failed_keys | self.skipped_keys)


def _extract_profile_key(data: Dict[str, Any]) -> Optional[str]:
    for key in ("account", "username", "profile", "profile_name"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().lower()
    for key in ("profile_url", "url"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().lower()
    return None


def _accumulate_brightdata_progress(events: List[Dict[str, Any]]) -> BrightDataProgressState:
    state = BrightDataProgressState()
    for event in events or []:
        if not isinstance(event, dict):
            continue
        stage_raw = event.get("stage") or event.get("event")
        if not isinstance(stage_raw, str):
            continue
        stage = normalize_stage_name(stage_raw)
        data = event.get("data") or {}
        if stage == "snapshot":
            nested_events = data.get("events")
            if isinstance(nested_events, list):
                state.merge(_accumulate_brightdata_progress(nested_events))
            continue
        if stage == "BRIGHTDATA_STARTED":
            state.total_hint = _max_hint(state.total_hint, _safe_int(data.get("count")))
            continue
        if stage == "BRIGHTDATA_COMPLETED":
            completed_count = _safe_int(data.get("count"))
            if completed_count is not None:
                state.total_hint = _max_hint(
                    state.total_hint,
                    completed_count + len(state.failed_keys) + len(state.skipped_keys),
                )
            continue
        if stage in _PROFILE_COMPLETED_STAGES:
            key = _extract_profile_key(data)
            if key:
                state.success_keys.add(key)
            continue
        if stage in _PROFILE_FAILED_STAGES:
            key = _extract_profile_key(data)
            if key:
                state.failed_keys.add(key)
            continue
        if stage in _PROFILE_SKIPPED_STAGES:
            key = _extract_profile_key(data)
            if key:
                state.skipped_keys.add(key)
            continue
    return state


def _compute_brightdata_progress(
    events: List[Dict[str, Any]],
    result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Optional[int]]:
    state = _accumulate_brightdata_progress(events)

    success_hint: Optional[int] = None
    failed_hint: Optional[int] = None
    result_total_hint: Optional[int] = None

    if isinstance(result, dict):
        summary_payload = result.get("summary")
        if isinstance(summary_payload, dict):
            result_total_hint = _max_hint(result_total_hint, _safe_int(summary_payload.get("total")))
            success_hint = _max_hint(success_hint, _safe_int(summary_payload.get("successful")))
            failed_hint = _max_hint(failed_hint, _safe_int(summary_payload.get("failed")))

        results_list = result.get("results")
        if isinstance(results_list, list):
            result_total_hint = _max_hint(result_total_hint, len(results_list))
            successes_from_results = sum(
                1 for item in results_list if isinstance(item, dict) and item.get("success") is True
            )
            failures_from_results = sum(
                1 for item in results_list if isinstance(item, dict) and item.get("success") is False
            )
            if successes_from_results:
                success_hint = max(success_hint or 0, successes_from_results)
            if failures_from_results:
                failed_hint = max(failed_hint or 0, failures_from_results)

    success_count = max(len(state.success_keys), success_hint or 0)
    failure_events_count = len(state.failed_keys | state.skipped_keys)
    failed_count = max(failure_events_count, failed_hint or 0)
    processed_count = max(state.processed_count(), success_count + failed_count)

    total_candidates = [
        state.total_hint,
        result_total_hint,
        (success_hint + failed_hint) if (success_hint is not None and failed_hint is not None) else None,
        success_count + failed_count,
    ]
    total_candidates = [value for value in total_candidates if value is not None]
    total = max(total_candidates) if total_candidates else None
    if total is not None and processed_count > total:
        total = processed_count

    pending: Optional[int] = None
    if total is not None:
        pending = max(total - processed_count, 0)

    return {
        "total": total,
        "processed": processed_count,
        "success": success_count,
        "failed": failed_count,
        "pending": pending,
    }


def _format_progress_caption(summary: Dict[str, Optional[int]]) -> str:
    processed = summary.get("processed") or 0
    total = summary.get("total")
    success = summary.get("success") or 0
    failed = summary.get("failed") or 0
    pending = summary.get("pending")

    parts = []
    if total:
        parts.append(f"{processed} of {total} profiles processed")
    else:
        parts.append(f"{processed} profiles processed")
    parts.append(f"✓ {success}")
    if failed:
        parts.append(f"✗ {failed}")
    if pending:
        parts.append(f"{pending} pending")
    return " • ".join(parts)


def _render_brightdata_progress(
    events: List[Dict[str, Any]],
    result: Optional[Dict[str, Any]] = None,
    *,
    heading: Optional[str] = None,
) -> Dict[str, Optional[int]]:
    summary = _compute_brightdata_progress(events, result)
    if not summary["processed"] and not summary["total"]:
        return summary

    if heading:
        st.markdown(heading)

    if summary["total"]:
        total = summary["total"] or 0
        progress_value = int(min(summary["processed"], total) / total * 100) if total else 0
        st.progress(progress_value)
        st.caption(_format_progress_caption(summary))
        columns = st.columns(4)
    else:
        st.caption(_format_progress_caption(summary))
        columns = st.columns(3)

    processed_label = (
        f"{summary['processed']}/{summary['total']}" if summary["total"] is not None else f"{summary['processed']}"
    )
    columns[0].metric("Processed", processed_label)
    columns[1].metric("Successful", summary["success"])
    columns[2].metric("Failed", summary["failed"])
    if summary["total"] is not None:
        columns[3].metric("Pending", summary["pending"] or 0)
    return summary


def _render_progress_placeholders(
    progress_placeholder,
    caption_placeholder,
    summary: Dict[str, Optional[int]],
) -> None:
    total = summary.get("total")
    processed = summary.get("processed") or 0
    if total:
        total_value = total or 0
        progress_value = int(min(processed, total_value) / total_value * 100) if total_value else 0
        progress_placeholder.progress(progress_value)
        caption_placeholder.caption(_format_progress_caption(summary))
    elif processed:
        progress_placeholder.empty()
        caption_placeholder.caption(_format_progress_caption(summary))
    else:
        progress_placeholder.empty()
        caption_placeholder.empty()


def _extract_latest_job_result(events: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    for event in reversed(events or []):
        job_payload = event.get("job")
        if isinstance(job_payload, dict):
            result = job_payload.get("result")
            if isinstance(result, dict):
                return result
    return None


def _normalize_rerank_text(value: Any) -> str:
    if value is None or value is False:
        return ""
    if isinstance(value, (list, tuple)):
        return " ".join(filter(None, (_normalize_rerank_text(item) for item in value)))
    if isinstance(value, dict):
        return " ".join(
            filter(
                None,
                (_normalize_rerank_text(item) for item in value.values()),
            )
        )
    return str(value).strip()


def _document_for_rerank(result: Dict[str, Any], mode: str) -> str:
    bio = _normalize_rerank_text(result.get("biography"))
    profile_text = _normalize_rerank_text(result.get("profile_fts_source")) or bio
    account = _normalize_rerank_text(result.get("account") or result.get("username"))
    profile_name = _normalize_rerank_text(result.get("profile_name"))
    posts_source = (
        result.get("posts_fts_source")
        or result.get("posts_raw")
        or result.get("posts")
        or result.get("posts_text")
    )
    posts_text = _normalize_rerank_text(posts_source)

    if mode == "bio":
        return bio or profile_text or profile_name or account
    if mode == "posts":
        return posts_text or bio or profile_text or profile_name or account

    combined_segments = [segment for segment in (bio, posts_text) if segment]
    combined = " ".join(combined_segments).strip()
    return combined or profile_text or bio or profile_name or account


def _apply_rerank_results(
    results: List[Dict[str, Any]],
    ranking: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not results:
        return results

    reordered: List[Dict[str, Any]] = []
    seen_indices: Set[int] = set()

    for entry in ranking:
        try:
            idx = int(entry.get("index"))
            score = float(entry.get("score"))
        except (TypeError, ValueError):
            continue
        if idx < 0 or idx >= len(results) or idx in seen_indices:
            continue
        seen_indices.add(idx)
        item = dict(results[idx])
        item["rerank_score"] = score
        reordered.append(item)

    for idx, item in enumerate(results):
        if idx in seen_indices:
            continue
        remainder = dict(item)
        if "rerank_score" not in remainder:
            remainder["rerank_score"] = None
        reordered.append(remainder)

    return reordered


with st.sidebar:
    base_url = st.text_input("Search API base URL", value="http://localhost:9100/search")
    st.markdown(
        """
        - `/pipeline` → enqueue discovery + enrichment pipeline  
        - `/job/{id}` → poll job status/events  
        - `/job/{id}/stream` → SSE stream of events  
        - `/` → enqueue a search job  
        - `/pipeline/brightdata` → BrightData enrichment job  
        - `/pipeline/llm` → profile-fit scoring job
        """
    )

st.subheader("1. Async Pipeline Job (RQ)")
with st.form("pipeline_async_form"):
    col_left, col_right = st.columns(2)
    with col_left:
        query = st.text_input("Search query", value="eco-friendly skincare creators")
        method = st.selectbox("Method", ["hybrid", "semantic", "lexical"])
        limit = st.number_input("Limit", min_value=1, value=50, step=1)
        run_rerank = st.checkbox("Enable rerank (Qwen3)", value=True)
        rerank_top_k = st.number_input("Rerank top_k", min_value=1, max_value=500, value=100, step=10)
        rerank_mode = st.selectbox("Rerank mode", options=["bio+posts", "bio", "posts"])
    with col_right:
        run_brightdata = st.checkbox("Run BrightData stage", value=False)
        run_llm = st.checkbox("Run LLM scoring", value=False)
        business_query = st.text_input(
            "Business fit query (optional)", value="Sustainable beauty brand targeting Gen Z"
        )
        max_profiles = st.number_input("Max profiles", min_value=1, max_value=5000, value=200, step=10)
        max_posts = st.number_input("Max posts per profile", min_value=1, max_value=20, value=6, step=1)
        concurrency = st.number_input("LLM concurrency", min_value=1, max_value=64, value=32, step=1)
    enqueue = st.form_submit_button("Enqueue pipeline job", use_container_width=True)

if enqueue:
    try:
        payload = {
            "search": {
                "query": query,
                "method": method,
                "limit": limit,
            },
            "run_brightdata": run_brightdata,
            "run_llm": run_llm,
            "run_rerank": run_rerank,
            "rerank_top_k": rerank_top_k,
            "rerank_mode": rerank_mode,
            "business_fit_query": business_query or None,
            "max_profiles": max_profiles,
            "max_posts": max_posts,
            "concurrency": concurrency,
        }
        job = call_api(base_url, "/pipeline", payload)
    except Exception as exc:  # pylint: disable=broad-except
        st.error(f"Failed to enqueue job: {exc}")
    else:
        st.session_state.pipeline_job_id = job.get("job_id")
        st.session_state.pipeline_job_info = {"status": "queued", "queue": job.get("queue")}
        st.success(f"Enqueued job {job.get('job_id')} on queue '{job.get('queue')}'")

if st.session_state.pipeline_job_id:
    st.info(f"Active job ID: {st.session_state.pipeline_job_id}")
    col_status, col_actions = st.columns([3, 1])
    with col_status:
        job_info = st.session_state.pipeline_job_info or {}
        st.metric("Job status", job_info.get("status", "unknown"))
        stream_url = f"{base_url.rstrip('/')}/job/{st.session_state.pipeline_job_id}/stream"
        st.markdown(f"SSE stream: `{stream_url}`")
        st.caption("Consume this URL with curl or your frontend SSE client to stream events.")
    with col_actions:
        if st.button("Refresh status", use_container_width=True):
            try:
                st.session_state.pipeline_job_info = get_job_status(base_url, st.session_state.pipeline_job_id)
            except Exception as exc:  # pylint: disable=broad-except
                st.error(f"Status fetch failed: {exc}")
        if st.button("Clear job", type="secondary", use_container_width=True):
            st.session_state.pipeline_job_id = None
            st.session_state.pipeline_job_info = None
            st.session_state.pipeline_results = None
            st.session_state.pipeline_results_csv = None

    job_info = st.session_state.pipeline_job_info
    if job_info:
        events = job_info.get("events") or []
        result_payload = job_info.get("result") if isinstance(job_info.get("result"), dict) else None
        _render_brightdata_progress(events, result_payload, heading="###### BrightData Progress")
        if events:
            st.write("Progress events")
            event_rows = []
            for event in events:
                ts_ms = event.get("ts")
                ts_display = ""
                if isinstance(ts_ms, (int, float)):
                    ts_display = datetime.fromtimestamp(ts_ms / 1000).strftime("%Y-%m-%d %H:%M:%S")
                event_rows.append(
                    {
                        "Stage": event.get("stage"),
                        "Timestamp": ts_display,
                        "Keys": ", ".join(event.get("data", {}).keys()),
                    }
                )
            st.table(event_rows)
            with st.expander("Event payloads"):
                for event in events:
                    st.markdown(f"**{event.get('stage')}**")
                    st.json(event.get("data"))

        if job_info.get("error"):
            st.error(job_info["error"])
        if job_info.get("result"):
            result = job_info["result"]
            brightdata_records = result.get("brightdata_results")
            if isinstance(brightdata_records, list) and brightdata_records:
                st.session_state.brightdata_results = brightdata_records
            st.success(f"Job finished with {result.get('count', 0)} results")
            results_rows = result.get("results")
            if isinstance(results_rows, list) and results_rows:
                st.session_state.pipeline_results = results_rows
                df = pd.json_normalize(results_rows)
                st.dataframe(df, use_container_width=True)
                buffer = io.StringIO()
                df.to_csv(buffer, index=False)
                csv_payload = buffer.getvalue()
                st.session_state.pipeline_results_csv = csv_payload
                timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
                st.download_button(
                    "Download results CSV",
                    data=csv_payload,
                    file_name=f"pipeline_results_{timestamp}.csv",
                    mime="text/csv",
                    use_container_width=True,
                )
            st.json(result)

st.markdown("---")

st.subheader("2. Search Creators")
with st.form("search_form"):
    query = st.text_input("Query", value="beauty skincare creators")
    method = st.selectbox("Method", options=["hybrid", "semantic", "lexical"])
    limit = st.number_input("Limit", min_value=1, value=20, step=1)
    submitted = st.form_submit_button("Run Search", use_container_width=True)

if submitted:
    try:
        payload = {"query": query, "method": method, "limit": limit}
        job = call_api(base_url, "/", payload)
    except Exception as exc:  # pylint: disable=broad-except
        st.error(f"Search enqueue failed: {exc}")
    else:
        st.session_state.search_job_id = job.get("job_id")
        st.session_state.search_job_status = {"status": "queued"}
        st.session_state.last_search_query = query
        st.success(f"Search job {st.session_state.search_job_id} enqueued on {job.get('queue')}.")

if st.session_state.search_job_id:
    st.info(f"Search job ID: {st.session_state.search_job_id}")
    col_refresh, col_clear = st.columns(2)
    with col_refresh:
        if st.button("Refresh search job status", key="refresh_search_job", use_container_width=True):
            try:
                info = get_job_status(base_url, st.session_state.search_job_id)
            except Exception as exc:  # pylint: disable=broad-except
                st.error(f"Status fetch failed: {exc}")
            else:
                st.session_state.search_job_status = info
                result = info.get("result") or {}
                if isinstance(result, dict):
                    if result.get("results"):
                        st.session_state.search_results = result.get("results", [])
                    if result.get("query"):
                        st.session_state.last_search_query = result.get("query")
    with col_clear:
        if st.button("Clear search job", key="clear_search_job", type="secondary", use_container_width=True):
            st.session_state.search_job_id = None
            st.session_state.search_job_status = None
            st.session_state.search_results = None
            st.session_state.rerank_status = None
    if st.session_state.search_job_status:
        st.json(st.session_state.search_job_status)

if st.session_state.search_results:
    st.caption("Latest search results (from job snapshot) will be fed into the rerank and BrightData stages.")

st.subheader("3. Rerank Search Results")
if not st.session_state.search_results:
    st.info("Run a search to enable reranking.")
else:
    search_query_default = st.session_state.last_search_query
    if not search_query_default:
        job_snapshot = st.session_state.search_job_status or {}
        if isinstance(job_snapshot, dict):
            job_result = job_snapshot.get("result")
            if isinstance(job_result, dict):
                search_query_default = job_result.get("query") or search_query_default

    rerank_query = st.text_input(
        "Search query for reranking",
        value=search_query_default or "",
        key="rerank_query_input",
    )
    if rerank_query:
        st.session_state.last_search_query = rerank_query

    service_url_input = st.text_input(
        "Reranker service URL",
        value=st.session_state.rerank_service_url,
        key="rerank_service_url_input",
    )
    if service_url_input:
        st.session_state.rerank_service_url = service_url_input

    max_candidates = len(st.session_state.search_results)
    default_top_k = min(20, max_candidates) if max_candidates else 1
    rerank_top_k = st.number_input(
        "Top K to rerank",
        min_value=1,
        max_value=max_candidates or 1,
        value=default_top_k or 1,
        step=1,
        key="rerank_top_k_input",
    )
    rerank_mode = st.selectbox(
        "Rerank mode",
        options=["bio+posts", "bio", "posts"],
        index=0,
        key="rerank_mode_select",
    )

    if st.button("Run rerank", use_container_width=True):
        if not rerank_query:
            st.warning("Provide a search query before reranking.")
        else:
            docs = [
                _document_for_rerank(item, rerank_mode)
                for item in st.session_state.search_results[:rerank_top_k]
            ]
            try:
                response = requests.post(
                    st.session_state.rerank_service_url,
                    json={"query": rerank_query, "documents": docs, "top_k": rerank_top_k},
                    timeout=60,
                )
                response.raise_for_status()
            except requests.exceptions.RequestException as exc:  # pylint: disable=broad-except
                st.error(f"Rerank request failed: {exc}")
            except Exception as exc:  # pylint: disable=broad-except
                st.error(f"Unexpected rerank error: {exc}")
            else:
                payload = response.json()
                ranking = payload.get("ranking") or []
                st.session_state.search_results = _apply_rerank_results(
                    st.session_state.search_results,
                    ranking,
                )
                st.session_state.rerank_status = {
                    "ranking": ranking,
                    "top_k": payload.get("top_k"),
                    "count": payload.get("count"),
                    "mode": rerank_mode,
                }
                st.success(f"Reranked {len(ranking)} profile(s).")
                preview_count = max(1, min(len(st.session_state.search_results), len(ranking) or 10))
                preview_rows = [
                    {
                        "account": item.get("account"),
                        "profile_name": item.get("profile_name"),
                        "rerank_score": item.get("rerank_score"),
                    }
                    for item in st.session_state.search_results[:preview_count]
                ]
                st.table(preview_rows)
    if st.session_state.rerank_status:
        st.json(st.session_state.rerank_status)

st.subheader("4. BrightData Stage")
default_urls = ""
if st.session_state.search_results:
    default_urls = "\n".join(
        filter(
            None,
            [
                item.get("profile_url")
                or (f"https://instagram.com/{item.get('account')}" if item.get("account") else "")
                for item in st.session_state.search_results
            ],
        )
    )

with st.form("brightdata_form"):
    raw_profiles = st.text_area(
        "Profiles JSON",
        value=json.dumps(st.session_state.brightdata_results or st.session_state.search_results or [], indent=2),
        height=220,
    )
    max_profiles = st.number_input("Max profiles", min_value=1, value=10, step=1)
    run_brightdata = st.form_submit_button("Run BrightData refresh", use_container_width=True)

if run_brightdata:
    try:
        profiles = json.loads(raw_profiles or "[]")
        if not isinstance(profiles, list) or not all(isinstance(item, dict) for item in profiles):
            raise ValueError("Provide a JSON array of normalized profile objects.")
        missing_urls = [
            idx for idx, profile in enumerate(profiles)
            if not isinstance(profile.get("profile_url") or profile.get("url") or profile.get("input_url"), str)
            or not (profile.get("profile_url") or profile.get("url") or profile.get("input_url"))
        ]
        if missing_urls:
            raise ValueError("Each profile must include a 'profile_url' (or 'url') field.")
        payload: Dict[str, Any] = {"profiles": profiles, "max_profiles": max_profiles}
        job = call_api(base_url, "/pipeline/brightdata", payload)
    except Exception as exc:  # pylint: disable=broad-except
        st.error(f"BrightData stage enqueue failed: {exc}")
    else:
        st.session_state.brightdata_stage_job_id = job.get("job_id")
        st.session_state.brightdata_stage_status = {"status": "queued"}
        st.session_state.brightdata_results = None
        st.success(f"BrightData stage job {st.session_state.brightdata_stage_job_id} enqueued.")

if st.session_state.brightdata_stage_job_id:
    st.info(f"BrightData stage job ID: {st.session_state.brightdata_stage_job_id}")
    col_bd_refresh, col_bd_clear = st.columns(2)
    with col_bd_refresh:
        if st.button("Refresh stage status", key="refresh_bd_stage", use_container_width=True):
            try:
                info = get_job_status(base_url, st.session_state.brightdata_stage_job_id)
            except Exception as exc:  # pylint: disable=broad-except
                st.error(f"Status fetch failed: {exc}")
            else:
                st.session_state.brightdata_stage_status = info
                result = info.get("result") or {}
                if isinstance(result, dict):
                    normalized_payload = result.get("brightdata_results") or result.get("records")
                    if isinstance(normalized_payload, list):
                        st.session_state.brightdata_results = normalized_payload
    with col_bd_clear:
        if st.button("Clear stage job", key="clear_bd_stage", type="secondary", use_container_width=True):
            st.session_state.brightdata_stage_job_id = None
            st.session_state.brightdata_stage_status = None
            st.session_state.brightdata_results = None
    if st.session_state.brightdata_stage_status:
        stage_info = st.session_state.brightdata_stage_status
        events = stage_info.get("events") or []
        result_payload = stage_info.get("result") if isinstance(stage_info.get("result"), dict) else None
        _render_brightdata_progress(events, result_payload, heading="###### BrightData Stage Progress")
        st.json(stage_info)

st.markdown("##### Direct BrightData Service (SSE)")
bd_service_url = st.text_input(
    "BrightData service base URL",
    value=st.session_state.bd_service_url,
    key="bd_service_url_input",
)
if bd_service_url:
    st.session_state.bd_service_url = bd_service_url

direct_urls = st.text_area(
    "Profile URLs or @handles (one per line)",
    value=default_urls,
    height=150,
    key="bd_direct_urls",
)

if st.button("Start BrightData job (direct)", use_container_width=True):
    handles = _parse_handles_from_lines(direct_urls)
    if not handles:
        st.warning("Provide at least one profile URL or @username.")
    else:
        payload = {"profiles": handles}
        try:
            response = requests.post(
                f"{st.session_state.bd_service_url.rstrip('/')}/refresh",
                json=payload,
                timeout=30,
            )
            response.raise_for_status()
        except Exception as exc:  # pylint: disable=broad-except
            st.error(f"BrightData service request failed: {exc}")
        else:
            data = response.json()
            st.session_state.bd_job_id = data.get("job_id")
            st.session_state.bd_events = []
            st.session_state.bd_job_status = None
            st.session_state.bd_last_result = None
            st.session_state.brightdata_results = None
            if st.session_state.bd_job_id:
                st.success(f"BrightData job {st.session_state.bd_job_id} enqueued.")
            else:
                st.warning("No job_id returned from BrightData service.")

if st.session_state.bd_job_id:
    st.info(f"Active BrightData job: {st.session_state.bd_job_id}")
    col_stream, col_poll, col_clear = st.columns(3)
    with col_stream:
        if st.button("Stream job events", use_container_width=True):
            progress_placeholder = st.empty()
            progress_caption = st.empty()
            placeholder = st.empty()
            streamed: List[Dict[str, Any]] = []
            latest_result = st.session_state.bd_last_result
            try:
                for event in _iter_brightdata_events(
                    st.session_state.bd_service_url, st.session_state.bd_job_id
                ):
                    streamed.append(event)
                    placeholder.json(event)
                    job_payload = event.get("job")
                    if isinstance(job_payload, dict) and isinstance(job_payload.get("result"), dict):
                        latest_result = job_payload["result"]
                        normalized_records = latest_result.get("records") or latest_result.get("brightdata_results")
                        if isinstance(normalized_records, list):
                            st.session_state.brightdata_results = normalized_records
                    summary = _compute_brightdata_progress(streamed, latest_result)
                    _render_progress_placeholders(progress_placeholder, progress_caption, summary)
            except Exception as exc:  # pylint: disable=broad-except
                st.error(f"SSE stream error: {exc}")
            else:
                st.success("BrightData job stream completed.")
            st.session_state.bd_events = streamed
            st.session_state.bd_last_result = latest_result
            if isinstance(latest_result, dict):
                normalized_records = latest_result.get("records") or latest_result.get("brightdata_results")
                if isinstance(normalized_records, list):
                    st.session_state.brightdata_results = normalized_records
    with col_poll:
        if st.button("Refresh job status", use_container_width=True):
            try:
                st.session_state.bd_job_status = _fetch_brightdata_job(
                    st.session_state.bd_service_url, st.session_state.bd_job_id
                )
            except Exception as exc:  # pylint: disable=broad-except
                st.error(f"Job status fetch failed: {exc}")
            else:
                st.success("Job status updated.")
                job_snapshot = st.session_state.bd_job_status
                if isinstance(job_snapshot, dict):
                    result_payload = job_snapshot.get("result")
                    if isinstance(result_payload, dict):
                        st.session_state.bd_last_result = result_payload
                        normalized_records = result_payload.get("records") or result_payload.get("brightdata_results")
                        if isinstance(normalized_records, list):
                            st.session_state.brightdata_results = normalized_records
    with col_clear:
        if st.button("Clear BrightData job", type="secondary", use_container_width=True):
            st.session_state.bd_job_id = None
            st.session_state.bd_events = []
            st.session_state.bd_job_status = None
            st.session_state.bd_last_result = None
            st.session_state.brightdata_results = None

direct_events = st.session_state.bd_events
direct_result = st.session_state.bd_last_result or _extract_latest_job_result(direct_events)
if isinstance(direct_result, dict):
    normalized_records = direct_result.get("records") or direct_result.get("brightdata_results")
    if isinstance(normalized_records, list) and normalized_records:
        st.session_state.brightdata_results = normalized_records
_render_brightdata_progress(direct_events, direct_result, heading="###### Direct BrightData Progress")

if st.session_state.bd_job_status:
    st.write("Latest BrightData job snapshot")
    st.json(st.session_state.bd_job_status)

if st.session_state.bd_events:
    st.write("Most recent BrightData event")
    st.json(st.session_state.bd_events[-1])

st.markdown("---")

st.subheader("5. LLM Stage (Profile Fit)")
col_llm_left, col_llm_right = st.columns(2)

with col_llm_left:
    llm_profiles = st.text_area(
        "Profiles JSON",
        value=json.dumps(
            st.session_state.brightdata_results or st.session_state.search_results or [], indent=2
        ),
        height=250,
        key="llm_profiles_input",
    )

business_query = st.text_input(
    "Business fit query",
    value="Eco-friendly skincare brand targeting Gen Z audience",
)
max_llm = st.number_input("Max profiles for LLM", min_value=1, value=5, step=1)
use_bd = st.checkbox("Use BrightData inside LLM stage", value=False)
run_llm = st.button("Run LLM scoring", use_container_width=True)

if run_llm:
    try:
        profiles = json.loads(llm_profiles or "[]")
        payload = {
            "profiles": profiles,
            "business_fit_query": business_query,
            "max_profiles": max_llm,
            "use_brightdata": use_bd,
        }
        job = call_api(base_url, "/pipeline/llm", payload)
    except Exception as exc:  # pylint: disable=broad-except
        st.error(f"LLM stage enqueue failed: {exc}")
    else:
        st.session_state.llm_stage_job_id = job.get("job_id")
        st.session_state.llm_stage_status = {"status": "queued"}
        st.success(f"LLM stage job {st.session_state.llm_stage_job_id} enqueued.")

if st.session_state.llm_stage_job_id:
    st.info(f"LLM stage job ID: {st.session_state.llm_stage_job_id}")
    col_llm_refresh, col_llm_clear = st.columns(2)
    with col_llm_refresh:
        if st.button("Refresh LLM stage", key="refresh_llm_stage", use_container_width=True):
            try:
                info = get_job_status(base_url, st.session_state.llm_stage_job_id)
            except Exception as exc:  # pylint: disable=broad-except
                st.error(f"Status fetch failed: {exc}")
            else:
                st.session_state.llm_stage_status = info
    with col_llm_clear:
        if st.button("Clear LLM stage job", key="clear_llm_stage", type="secondary", use_container_width=True):
            st.session_state.llm_stage_job_id = None
            st.session_state.llm_stage_status = None
    if st.session_state.llm_stage_status:
        st.json(st.session_state.llm_stage_status)
