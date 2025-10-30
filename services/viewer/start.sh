#!/bin/bash
# LanceDB viewer launcher

set -e

echo "🧭 Starting LanceDB Viewer..."

if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment not found. Creating one..."
    python -m venv venv
fi

echo "📦 Activating virtual environment..."
source venv/bin/activate

DEPS_SENTINEL="venv/.requirements-installed"
if [ ! -f "${DEPS_SENTINEL}" ] || [ requirements.txt -nt "${DEPS_SENTINEL}" ]; then
    echo "📥 Installing/updating dependencies..."
    pip install -r requirements.txt
    touch "${DEPS_SENTINEL}"
fi

if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from template..."
    cp .env.example .env
    echo "ℹ️  Using defaults from .env.example (override DB_PATH/PORT if needed)."
fi

set -a
source .env
set +a

PORT="${VIEWER_PORT:-7002}"
ROOT_PATH="${VIEWER_ROOT_PATH:-/db-viewer}"

echo "🌐 Viewer will be available at http://localhost:${PORT}${ROOT_PATH}"
echo ""

python -m app
