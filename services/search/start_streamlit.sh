#!/bin/bash
# Launch the Streamlit pipeline tester (viewer/app.py).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${ROOT_DIR}"

echo "🧪 Starting Streamlit pipeline tester..."

# Ensure virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment missing; creating one..."
    python -m venv venv
fi

echo "📦 Activating virtual environment..."
source venv/bin/activate

# Install/update dependencies when requirements change
DEPS_SENTINEL="venv/.requirements-installed"
if [ ! -f "${DEPS_SENTINEL}" ] || [ requirements.txt -nt "${DEPS_SENTINEL}" ]; then
    echo "📥 Installing/updating dependencies..."
    pip install -r requirements.txt
    touch "${DEPS_SENTINEL}"
fi

# Load environment variables if .env is present (optional but handy)
if [ -f ".env" ]; then
    echo "⚙️  Loading environment variables from .env..."
    set -a
    source .env
    set +a
else
    echo "ℹ️  No .env file detected; relying on existing environment variables."
fi

STREAMLIT_PORT="${STREAMLIT_PORT:-7015}"
STREAMLIT_ADDRESS="${STREAMLIT_ADDRESS:-0.0.0.0}"

echo "🌐 Streamlit UI: http://${STREAMLIT_ADDRESS}:${STREAMLIT_PORT}"
echo "   (override via STREAMLIT_ADDRESS / STREAMLIT_PORT env vars)"
echo ""

exec streamlit run viewer/app.py \
    --server.address "${STREAMLIT_ADDRESS}" \
    --server.port "${STREAMLIT_PORT}"
