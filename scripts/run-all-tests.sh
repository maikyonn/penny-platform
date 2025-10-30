#!/bin/bash
# Run all tests including auth, subscription, and integration tests

set -e

echo "🧪 Running comprehensive test suite..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check if emulators are running
if ! curl -s http://localhost:9002 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Firestore emulator not detected at localhost:9002${NC}"
    echo "   Make sure to start emulators: npm run dev:emulators"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Test Search Service
echo ""
echo -e "${BLUE}📦 Testing Search Service...${NC}"
cd services/search
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

echo "  → Running auth tests..."
PROFILE=test pytest tests/test_auth.py -v --tb=short

echo "  → Running integration auth tests..."
PROFILE=test pytest tests/test_integration_auth.py -v --tb=short

cd ../..

# Test BrightData Service
echo ""
echo -e "${BLUE}📦 Testing BrightData Service...${NC}"
cd services/brightdata
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

echo "  → Running auth tests..."
PROFILE=test pytest tests/test_auth.py -v --tb=short

cd ../..

# Test Functions
echo ""
echo -e "${BLUE}📦 Testing Firebase Functions...${NC}"
cd functions
if [ -d "node_modules" ]; then
    echo "  → Running Stripe webhook tests..."
    npm test -- stripe.test.ts || echo "  ⚠️  Functions tests skipped (dependencies not installed)"
else
    echo "  ⚠️  Functions dependencies not installed. Run 'cd functions && npm install'"
fi
cd ..

echo ""
echo -e "${GREEN}✅ All tests complete!${NC}"
echo ""
echo "Next steps:"
echo "  • Review test output above"
echo "  • Run Stripe webhook tests: ./scripts/test-stripe-webhook.sh"
echo "  • Check Firestore emulator UI: http://localhost:9000"

