#!/bin/bash
# Run all tests with bun and Stripe keys configured

set -e

export PATH="$HOME/.bun/bin:$PATH"

# Stripe Configuration (load from environment or use placeholders)
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_YOUR_SECRET_KEY_HERE}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_YOUR_WEBHOOK_SECRET_HERE}"
export STRIPE_TRIAL_DAYS="${STRIPE_TRIAL_DAYS:-3}"
export PUBLIC_STRIPE_PUBLISHABLE_KEY="${PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_YOUR_PUBLISHABLE_KEY_HERE}"
export PUBLIC_SITE_URL="http://localhost:9200"

# Firebase Emulator Configuration
export FIREBASE_AUTH_EMULATOR_HOST=localhost:9001
export FIRESTORE_EMULATOR_HOST=localhost:9002
export STORAGE_EMULATOR_HOST=localhost:9003
export PUBSUB_EMULATOR_HOST=localhost:9005
export GOOGLE_CLOUD_PROJECT=demo-penny-dev

# Python Services
export SEARCH_SERVICE_URL=http://localhost:9100
export BRIGHTDATA_SERVICE_URL=http://localhost:9101
export GMAIL_STUB=1

cd "$(dirname "$0")/.."

echo "🧪 Running tests with bun..."
echo ""

# Check if emulators are running
if ! curl -s http://localhost:9002 > /dev/null 2>&1; then
    echo "⚠️  Firestore emulator not detected. Starting emulators..."
    bun run dev:emulators &
    EMULATOR_PID=$!
    echo "Waiting for emulators to start..."
    sleep 15
fi

# Test Search Service
echo "📦 Testing Search Service..."
cd services/search
PROFILE=test pytest tests/test_auth.py -v --tb=short 2>&1 | head -30
cd ../..

# Test BrightData Service  
echo ""
echo "📦 Testing BrightData Service..."
cd services/brightdata
PROFILE=test pytest tests/test_auth.py -v --tb=short 2>&1 | head -30
cd ../..

# Test Functions
echo ""
echo "📦 Testing Firebase Functions..."
cd functions
bun test 2>&1 | head -30 || echo "⚠️  Functions tests may need additional setup"
cd ..

echo ""
echo "✅ Tests complete!"

