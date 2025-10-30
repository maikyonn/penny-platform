#!/bin/bash
# Test Stripe webhook locally

set -e

echo "🧪 Testing Stripe webhook handler..."
echo ""

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found. Please install it first:"
    echo "   ./scripts/setup-stripe-local.sh"
    exit 1
fi

# Check if webhook endpoint is running
FUNCTION_URL="http://localhost:9004/penny-dev/us-central1/stripeWebhook"

echo "📡 Testing webhook endpoint: $FUNCTION_URL"
echo ""

# Test checkout.session.completed
echo "1️⃣ Testing checkout.session.completed..."
stripe trigger checkout.session.completed

echo ""
echo "2️⃣ Testing customer.subscription.created..."
stripe trigger customer.subscription.created

echo ""
echo "3️⃣ Testing customer.subscription.updated..."
stripe trigger customer.subscription.updated

echo ""
echo "4️⃣ Testing customer.subscription.deleted..."
stripe trigger customer.subscription.deleted

echo ""
echo "✅ Webhook tests complete!"
echo ""
echo "To forward webhooks to your local function, run:"
echo "  stripe listen --forward-to $FUNCTION_URL"
echo ""
echo "Note: Functions run on port 9004 (not 5001)"

