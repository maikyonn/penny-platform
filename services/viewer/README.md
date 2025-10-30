# LanceDB Data Viewer

Interactive LanceDB explorer for the GenZ Creator dataset. Runs on port 7002 and is reverse proxied at `/db-viewer` on `pen.optimat.us`.

## Features

- Table browser with schema inspection.
- Row preview with optional column filtering (case-insensitive contains).
- CSV export via Gradio's built-in grid download.
- Auto-detects the LanceDB path used by the Search API (falls back to `.env` override).

## Quick Start

```bash
./start.sh
```

The viewer listens on `http://localhost:7002`. When reverse-proxied, use `http://pen.optimat.us/db-viewer`.

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```
# Optional override if auto-detection fails
DB_PATH=/absolute/path/to/DIME-AI-DB/data/lancedb

# Network settings
VIEWER_PORT=7002
VIEWER_ROOT_PATH=/db-viewer
```

Defaults:
- `DB_PATH` resolves to `../DIME-AI-DB/data/lancedb` (or legacy `../DIME-AI-DB/influencers_vectordb`).
- `VIEWER_PORT` uses `7002`.
- `VIEWER_ROOT_PATH` uses `/db-viewer`.

## Development Notes

- The app is Gradio-based (`app.py`) and can be launched with `python -m app`.
- Dependencies are listed in `requirements.txt`.
- The viewer is read-only; it does not modify LanceDB data.
