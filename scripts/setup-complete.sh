#!/bin/bash
# Complete setup script with all dependencies and Stripe keys

set -e

export PATH="$HOME/.bun/bin:$PATH"

echo "🔧 Complete Testing Environment Setup"
echo "======================================"
echo ""

# 1. Install Bun if not present
if ! command -v bun &> /dev/null; then
    echo "📦 Installing bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi

# 2. Install Java (required for Firebase emulators)
if ! command -v java &> /dev/null; then
    echo "📦 Installing Java..."
    sudo yum install -y java-11-openjdk java-11-openjdk-devel || echo "⚠️  Could not install Java automatically"
fi

# 3. Install Stripe CLI
if ! command -v stripe &> /dev/null; then
    echo "📦 Installing Stripe CLI..."
    curl -sL https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz -o /tmp/stripe_cli.tar.gz
    tar -xzf /tmp/stripe_cli.tar.gz -C /tmp
    sudo mv /tmp/stripe /usr/local/bin/
    chmod +x /usr/local/bin/stripe
fi

# 4. Set environment variables (load from environment or use placeholders)
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_YOUR_SECRET_KEY_HERE}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_YOUR_WEBHOOK_SECRET_HERE}"
export STRIPE_TRIAL_DAYS="${STRIPE_TRIAL_DAYS:-3}"
export PUBLIC_STRIPE_PUBLISHABLE_KEY="${PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_YOUR_PUBLISHABLE_KEY_HERE}"
export PUBLIC_SITE_URL="http://localhost:9200"

export FIREBASE_AUTH_EMULATOR_HOST=localhost:9001
export FIRESTORE_EMULATOR_HOST=localhost:9002
export STORAGE_EMULATOR_HOST=localhost:9003
export PUBSUB_EMULATOR_HOST=localhost:9005
export GOOGLE_CLOUD_PROJECT=demo-penny-dev

export SEARCH_SERVICE_URL=http://localhost:9100
export BRIGHTDATA_SERVICE_URL=http://localhost:9101
export GMAIL_STUB=1

# 5. Install Node dependencies with bun
echo "📦 Installing dependencies with bun..."
cd "$(dirname "$0")/.."
bun install

echo "📦 Installing Functions dependencies..."
cd functions
bun install
cd ..

# 6. Install Python dependencies
echo "📦 Installing Python dependencies..."
cd services/search
python3 -m pip install -q firebase-admin google-cloud-firestore google-cloud-storage 2>/dev/null || python3 -m pip install firebase-admin google-cloud-firestore google-cloud-storage
cd ../brightdata
python3 -m pip install -q firebase-admin google-cloud-firestore google-cloud-storage 2>/dev/null || python3 -m pip install firebase-admin google-cloud-firestore google-cloud-storage
cd ../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "⚠️  IMPORTANT: You need to authenticate Firebase CLI:"
echo "   firebase login"
echo ""
echo "Then you can:"
echo "  1. Start emulators: bun run dev:emulators"
echo "  2. Seed data: bun run seed"
echo "  3. Run tests: bun run test:all"

