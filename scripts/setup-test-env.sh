#!/bin/bash
# Setup complete testing environment with Stripe keys

set -e

echo "🔧 Setting up testing environment..."
echo ""

# Set Stripe environment variables (load from environment or use placeholders)
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_YOUR_SECRET_KEY_HERE}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_YOUR_WEBHOOK_SECRET_HERE}"
export STRIPE_TRIAL_DAYS="${STRIPE_TRIAL_DAYS:-3}"
export PUBLIC_STRIPE_PUBLISHABLE_KEY="${PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_YOUR_PUBLISHABLE_KEY_HERE}"
export PUBLIC_SITE_URL="http://localhost:9200"

# Firebase Emulator variables
export FIREBASE_AUTH_EMULATOR_HOST=localhost:9001
export FIRESTORE_EMULATOR_HOST=localhost:9002
export STORAGE_EMULATOR_HOST=localhost:9003
export PUBSUB_EMULATOR_HOST=localhost:9005
export GOOGLE_CLOUD_PROJECT=demo-penny-dev

# Python service URLs
export SEARCH_SERVICE_URL=http://localhost:9100
export BRIGHTDATA_SERVICE_URL=http://localhost:9101

# Stub mode
export GMAIL_STUB=1

echo "✅ Environment variables configured"
echo ""
echo "Stripe keys configured:"
echo "  • Secret Key: ${STRIPE_SECRET_KEY:0:20}..."
echo "  • Webhook Secret: ${STRIPE_WEBHOOK_SECRET:0:20}..."
echo "  • Publishable Key: ${PUBLIC_STRIPE_PUBLISHABLE_KEY:0:20}..."
echo ""

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "⚠️  Bun not found. Installing bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi

echo "📦 Installing dependencies with bun..."
cd "$(dirname "$0")/.."
bun install

echo "📦 Installing Functions dependencies..."
cd functions
bun install
cd ..

echo "📦 Installing Python dependencies..."
cd services/search
python3 -m pip install -q firebase-admin google-cloud-firestore 2>/dev/null || echo "⚠️  Could not install Python dependencies"
cd ../brightdata
python3 -m pip install -q firebase-admin google-cloud-firestore 2>/dev/null || echo "⚠️  Could not install Python dependencies"
cd ../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start emulators: bun run dev:emulators"
echo "  2. Run tests: bun run test:all"

