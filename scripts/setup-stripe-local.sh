#!/bin/bash
# Setup Stripe CLI for local testing

set -e

echo "🎯 Setting up Stripe CLI for local testing..."

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found. Installing..."
    
    # Detect OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install stripe/stripe-cli/stripe
        else
            echo "Please install Homebrew first or install Stripe CLI manually"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz
        tar -xvf stripe_linux_x86_64.tar.gz
        sudo mv stripe /usr/local/bin/
        rm stripe_linux_x86_64.tar.gz
    else
        echo "❌ Unsupported OS. Please install Stripe CLI manually:"
        echo "   https://stripe.com/docs/stripe-cli"
        exit 1
    fi
fi

echo "✅ Stripe CLI installed"

# Login to Stripe
echo "🔐 Please login to Stripe CLI..."
stripe login

# Forward webhooks to local server
echo "📡 Setting up webhook forwarding..."
echo ""
echo "To forward Stripe webhooks to your local server, run:"
echo "  stripe listen --forward-to http://localhost:9004/penny-dev/us-central1/stripeWebhook"
echo ""
echo "This will provide a webhook signing secret. Add it to your .env.local:"
echo "  STRIPE_WEBHOOK_SECRET=whsec_..."
echo ""

# Create test data
echo "🧪 Creating test data..."
stripe fixtures trigger payment_intent.succeeded
stripe fixtures trigger customer.subscription.created

echo ""
echo "✅ Stripe CLI setup complete!"
echo ""
echo "Useful commands:"
echo "  stripe listen --forward-to http://localhost:9004/penny-dev/us-central1/stripeWebhook"
echo "  stripe trigger payment_intent.succeeded"
echo "  stripe trigger customer.subscription.created"
echo "  stripe trigger customer.subscription.updated"
echo "  stripe trigger customer.subscription.deleted"

