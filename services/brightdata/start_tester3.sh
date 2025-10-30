#!/bin/bash
# Startup script for BrightData Service (Tester 3)

set -e

# Navigate to service directory
cd "$(dirname "$0")"

# Set Firebase emulator hosts
export FIRESTORE_EMULATOR_HOST=localhost:9002
export FIREBASE_AUTH_EMULATOR_HOST=localhost:9001
export GOOGLE_CLOUD_PROJECT=penny-dev

# Set service URLs
export BRIGHTDATA_SERVICE_URL=http://localhost:9101

# Set profile to dev
export PROFILE=dev

# BrightData API keys (optional for dev - will be stubbed)
export BRIGHTDATA_API_KEY="${BRIGHTDATA_API_KEY:-}"
export BRIGHTDATA_API_TOKEN="${BRIGHTDATA_API_TOKEN:-}"

# Activate virtual environment
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

source venv/bin/activate

# Check if port is in use
if lsof -Pi :9101 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 9101 is already in use. Stopping existing process..."
    pkill -f "uvicorn app.main:app.*9101" || true
    sleep 2
fi

# Start the service
echo "🚀 Starting BrightData Service on port 9101..."
echo "   Firebase emulators: Firestore=$FIRESTORE_EMULATOR_HOST, Auth=$FIREBASE_AUTH_EMULATOR_HOST"
echo "   Profile: $PROFILE"
echo "   Health check: http://localhost:9101/health"
echo "   API docs: http://localhost:9101/docs"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 9101

