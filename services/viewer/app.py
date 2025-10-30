"""
Gradio-based LanceDB viewer for inspecting influencer data.

Usage:
    python -m app
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Iterable, List, Tuple

import gradio as gr
import pandas as pd
from dotenv import load_dotenv
import lancedb
from lancedb.table import Table


load_dotenv()


def resolve_db_path() -> Path:
    """Resolve LanceDB path via env override or default locations."""
    env_path = os.getenv("DB_PATH")
    if env_path:
        return Path(env_path).expanduser()

    repo_root = Path(__file__).resolve().parent
    candidates = [
        repo_root.parent / "DIME-AI-DB" / "data" / "lancedb",
        repo_root.parent / "DIME-AI-DB" / "data" / "combined" / "influencers_vectordb",
        repo_root.parent / "DIME-AI-DB" / "influencers_vectordb",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


@lru_cache(maxsize=1)
def connect() -> lancedb.DBConnection:
    path = resolve_db_path()
    if not path.exists():
        raise FileNotFoundError(
            f"LanceDB path not found at '{path}'. Set DB_PATH env variable."
        )
    return lancedb.connect(path.as_posix())


def list_tables() -> List[str]:
    return sorted(connect().table_names())


def open_table(name: str) -> Table:
    if not name:
        raise ValueError("Select a table to explore.")
    return connect().open_table(name)


def status_banner(extra: str = "") -> str:
    base = f"**LanceDB path**: `{resolve_db_path()}`"
    suffix = " ✅ Connected" if resolve_db_path().exists() else " ❌ Not found"
    tail = f"\n\n{extra}" if extra else ""
    return base + suffix + tail


def describe_table(name: str):
    try:
        table = open_table(name)
    except Exception as exc:  # pragma: no cover
        return (
            gr.Dropdown.update(choices=[], value=None),
            "⚠️ Unable to open table.",
            status_banner(str(exc)),
        )

    columns = [field.name for field in table.schema]
    schema_md = "\n".join(f"- `{field.name}` ({field.type})" for field in table.schema)
    choices = ["(no filter)"] + columns
    return (
        gr.Dropdown.update(choices=choices, value="(no filter)"),
        f"**Table:** `{name}`  \n**Columns:** {len(columns)}\n{schema_md or 'No columns found.'}",
        status_banner(f"Loaded `{name}`."),
    )


def refresh_tables():
    try:
        names = list_tables()
    except Exception as exc:  # pragma: no cover
        return gr.Dropdown.update(choices=[], value=None), status_banner(str(exc))
    if not names:
        return gr.Dropdown.update(choices=[], value=None), status_banner(
            "No tables available in LanceDB."
        )
    return gr.Dropdown.update(choices=names, value=names[0]), status_banner(
        f"Found {len(names)} table(s)."
    )


def _apply_filter(table: Table, column: str | None, query: str | None, limit: int) -> pd.DataFrame:
    scan = table.query().limit(limit)
    if column and column != "(no filter)" and query:
        sanitized = query.replace("'", "''").lower()
        expr = f"LOWER({column}) LIKE '%{sanitized}%'"
        scan = scan.where(expr)
    return scan.to_pandas()


def preview(
    table_name: str,
    limit: int,
    column: str | None,
    query: str | None,
):
    try:
        table = open_table(table_name)
    except Exception as exc:  # pragma: no cover
        return pd.DataFrame(), "⚠️ Unable to load data.", status_banner(str(exc))

    try:
        frame = _apply_filter(table, column, query, int(limit))
    except Exception as exc:  # pragma: no cover
        return (
            pd.DataFrame(),
            "⚠️ Query failed. Adjust filters and try again.",
            status_banner(str(exc)),
        )

    if frame.empty:
        note = "No rows matched current filters." if query else f"No rows returned (limit {limit})."
    else:
        note = f"Showing {len(frame)} row(s). Use CSV icon to download."
    return frame, note, status_banner(f"Preview generated for `{table_name}`.")


def build_ui() -> gr.Blocks:
    tables: Iterable[str] = []
    banner = status_banner()
    try:
        tables = list_tables()
        if tables:
            banner = status_banner(f"Found {len(tables)} table(s).")
    except Exception as exc:  # pragma: no cover
        banner = status_banner(str(exc))

    with gr.Blocks(title="LanceDB Viewer") as demo:
        gr.Markdown("# LanceDB Explorer\nInspect influencer data in LanceDB.")
        status = gr.Markdown(banner)

        with gr.Row():
            table_select = gr.Dropdown(
                label="Table",
                choices=list(tables),
                value=tables[0] if tables else None,
                interactive=True,
            )
            refresh_btn = gr.Button("Refresh Tables", variant="secondary")

        schema_md = gr.Markdown("Select a table to view its schema.")

        with gr.Row():
            limit_slider = gr.Slider(10, 500, value=50, step=10, label="Rows to preview")
            column_dropdown = gr.Dropdown(
                label="Filter column",
                choices=["(no filter)"],
                value="(no filter)",
                interactive=True,
            )
            query_box = gr.Textbox(
                label="Filter value (contains)",
                placeholder="Optional substring filter (case-insensitive)",
            )

        load_btn = gr.Button("Load Data", variant="primary")
        data_grid = gr.Dataframe(value=pd.DataFrame(), interactive=False, label="Results")
        note_md = gr.Markdown()

        refresh_btn.click(refresh_tables, outputs=[table_select, status])
        table_select.change(describe_table, inputs=table_select, outputs=[column_dropdown, schema_md, status])
        load_btn.click(
            preview,
            inputs=[table_select, limit_slider, column_dropdown, query_box],
            outputs=[data_grid, note_md, status],
        )

    return demo


def main() -> None:
    app = build_ui()
    port = int(os.getenv("VIEWER_PORT", "7002"))
    root_path = os.getenv("VIEWER_ROOT_PATH", "/db-viewer")
    app.launch(server_name="0.0.0.0", server_port=port, show_error=True, root_path=root_path)


if __name__ == "__main__":
    main()
