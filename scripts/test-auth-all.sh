#!/bin/bash
# Run all authentication and subscription tests

set -e

echo "🧪 Running authentication and subscription tests..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if emulators are running
if ! curl -s http://localhost:9002 > /dev/null 2>&1; then
    echo "⚠️  Firestore emulator not running. Starting emulators..."
    echo "   Run 'npm run dev:emulators' in another terminal"
    echo "   Or press Ctrl+C and start emulators first"
    read -p "Press Enter to continue anyway..."
fi

# Test Search Service
echo -e "${BLUE}📦 Testing Search Service...${NC}"
cd services/search
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi
PROFILE=test pytest tests/test_auth.py -v
cd ../..

echo ""

# Test BrightData Service
echo -e "${BLUE}📦 Testing BrightData Service...${NC}"
cd services/brightdata
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi
PROFILE=test pytest tests/test_auth.py -v
cd ../..

echo ""

# Test Functions
echo -e "${BLUE}📦 Testing Firebase Functions...${NC}"
cd functions
npm test -- stripe.test.ts
cd ..

echo ""
echo -e "${GREEN}✅ All auth tests complete!${NC}"

