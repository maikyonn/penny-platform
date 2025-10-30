#!/bin/bash
# Startup script for Tester 2 - Search Service
# Sets all required environment variables and starts the service

set -e

echo "🚀 Starting Search Service for Tester 2..."

# Navigate to service directory
cd "$(dirname "$0")"

# Set Firebase emulator hosts
export FIRESTORE_EMULATOR_HOST=localhost:9002
export FIREBASE_AUTH_EMULATOR_HOST=localhost:9001
export GOOGLE_CLOUD_PROJECT=penny-dev

# Set service URLs
export SEARCH_SERVICE_URL=http://localhost:9100
export BRIGHTDATA_SERVICE_URL=http://localhost:9101

# Set profile to dev
export PROFILE=dev

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
else
    echo "⚠️  Virtual environment not found. Creating one..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
fi

# Check if port 9100 is available
if lsof -i :9100 > /dev/null 2>&1; then
    echo "⚠️  Port 9100 is already in use. Checking process..."
    lsof -i :9100
    echo "Please stop the process using port 9100 or modify the port."
    exit 1
fi

# Check Firebase emulators (warn but don't fail)
echo "🔍 Checking Firebase emulators..."
if ! curl -s http://localhost:9002 > /dev/null 2>&1; then
    echo "⚠️  Warning: Firestore emulator (port 9002) is not running"
    echo "   You may need to wait for Tester 1 to start emulators"
fi

if ! curl -s http://localhost:9001 > /dev/null 2>&1; then
    echo "⚠️  Warning: Auth emulator (port 9001) is not running"
    echo "   You may need to wait for Tester 1 to start emulators"
fi

# Display environment variables
echo ""
echo "📋 Environment Variables:"
echo "   FIRESTORE_EMULATOR_HOST=$FIRESTORE_EMULATOR_HOST"
echo "   FIREBASE_AUTH_EMULATOR_HOST=$FIREBASE_AUTH_EMULATOR_HOST"
echo "   GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT"
echo "   SEARCH_SERVICE_URL=$SEARCH_SERVICE_URL"
echo "   BRIGHTDATA_SERVICE_URL=$BRIGHTDATA_SERVICE_URL"
echo "   PROFILE=$PROFILE"
echo ""

# Start the service
echo "🎯 Starting uvicorn server on port 9100..."
echo "   API Docs will be available at: http://localhost:9100/docs"
echo "   Health check: http://localhost:9100/health"
echo ""
echo "Press Ctrl+C to stop the service"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 9100


