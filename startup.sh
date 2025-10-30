#!/bin/bash
# ═════════════════════════════════════════════════════════════════════════════
# Penny Platform - Centralized Development Environment Startup Script
# ═════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Get the directory where this script is located, regardless of how it's invoked
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}"
LOG_DIR="${ROOT_DIR}/logs"
mkdir -p "${LOG_DIR}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ═════════════════════════════════════════════════════════════════════════════
# Environment Setup
# ═════════════════════════════════════════════════════════════════════════════

setup_environment() {
    echo -e "${BLUE}🌍 Setting up environment variables...${NC}"
    
    # Load environment variables from central env files
    if [[ -f "${ROOT_DIR}/scripts/load-env.sh" ]]; then
        source "${ROOT_DIR}/scripts/load-env.sh" "${PROFILE:-dev}"
    else
        echo -e "${YELLOW}⚠️  load-env.sh not found, using defaults${NC}"
        export PROFILE="${PROFILE:-dev}"
    fi
    
    # Add bun to PATH
    export PATH="$HOME/.bun/bin:${ROOT_DIR}/node_modules/.bin:$PATH"
    
    # Ensure PROFILE is set
    export PROFILE="${PROFILE:-dev}"
    
    # Service URLs (can be overridden by env files)
    export SEARCH_SERVICE_URL="${SEARCH_SERVICE_URL:-http://localhost:9100}"
    export BRIGHTDATA_SERVICE_URL="${BRIGHTDATA_SERVICE_URL:-http://localhost:9101}"
    export VIEWER_SERVICE_URL="${VIEWER_SERVICE_URL:-http://localhost:9102}"
    export PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-http://localhost:9200}"
    
    # Development flags
    export GMAIL_STUB=1
    
    echo -e "${GREEN}✅ Environment configured (PROFILE=${PROFILE})${NC}"
}

# ═════════════════════════════════════════════════════════════════════════════
# Stop all services function (defined early so it can be called from flags)
# ═════════════════════════════════════════════════════════════════════════════

stop_all_services() {
    echo -e "${RED}🛑 Stopping all services...${NC}"
    echo ""
    
    # Stop Firebase emulators
    echo -e "${BLUE}   Stopping Firebase emulators...${NC}"
    pkill -f "firebase.*emulators" || true
    pkill -f "firebase-tools" || true
    pkill -f "cloud-firestore-emulator" || true
    pkill -f "pubsub-emulator" || true
    pkill -f "cloud-storage-rules" || true
    
    # Stop Python services
    echo -e "${BLUE}   Stopping Python services...${NC}"
    pkill -f "uvicorn.*search" || true
    pkill -f "uvicorn.*brightdata" || true
    pkill -f "streamlit.*viewer" || true
    
    # Stop web app
    echo -e "${BLUE}   Stopping web app...${NC}"
    pkill -f "vite.*web" || true
    pkill -f "svelte-kit" || true
    
    # Stop Redis
    echo -e "${BLUE}   Stopping Redis...${NC}"
    pkill -f "redis-server.*9300" || true
    
    # Clean up lock files
    rm -f /tmp/hub-*.json 2>/dev/null || true
    
    sleep 2
    echo ""
    echo -e "${GREEN}✅ All services stopped${NC}"
}

# ═════════════════════════════════════════════════════════════════════════════
# Service Control Options
# ═════════════════════════════════════════════════════════════════════════════

START_EMULATORS=true  # Default: start emulators
START_SEARCH=false
START_BRIGHTDATA=false
START_VIEWER=false
START_WEB=false
START_REDIS=false
SEED_DATA=false
TEST_MODE=false
ALL_SERVICES=false  # Don't start all services by default

while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            ALL_SERVICES=true
            shift
            ;;
        --emulators)
            START_EMULATORS=true
            shift
            ;;
        --search)
            START_SEARCH=true
            shift
            ;;
        --brightdata)
            START_BRIGHTDATA=true
            shift
            ;;
        --viewer)
            START_VIEWER=true
            shift
            ;;
        --web)
            START_WEB=true
            shift
            ;;
        --redis)
            START_REDIS=true
            shift
            ;;
        --seed)
            SEED_DATA=true
            shift
            ;;
        --test)
            TEST_MODE=true
            shift
            ;;
        --stop)
            stop_all_services
            exit 0
            ;;
        --help|-h)
            cat << EOF
${BLUE}════════════════════════════════════════════════════════════════${NC}
${BLUE}  Penny Platform - Development Environment Startup${NC}
${BLUE}════════════════════════════════════════════════════════════════${NC}

${GREEN}Usage:${NC} ./startup.sh [options]

${GREEN}Default Behavior (no flags):${NC}
  Starts Firebase emulators only (dev infrastructure)

${GREEN}Options:${NC}
  --all          Start everything (emulators + all services)
  --emulators    Start Firebase emulators (default if no flags)
  --search       Start Search API service (Port 9100)
  --brightdata   Start BrightData service (Port 9101)
  --viewer       Start Viewer service (Port 9102)
  --web          Start SvelteKit web app (Port 9200)
  --redis        Start Redis server (Port 9300)
  --seed         Seed Firebase with test data
  --test         Run service tests
  --stop         Stop all running services
  --help, -h     Show this help message

${GREEN}Examples:${NC}
  ./startup.sh                    # Start Firebase emulators only
  ./startup.sh --all              # Start everything
  ./startup.sh --search           # Start emulators + Search service
  ./startup.sh --seed             # Start emulators + seed data
  ./startup.sh --all --seed       # Start everything + seed data

${GREEN}Development Infrastructure (Default):${NC}
  Firebase Emulator UI:  http://localhost:9000
  Auth:                  http://localhost:9001
  Firestore:             http://localhost:9002
  Storage:               http://localhost:9003
  Functions:             http://localhost:9004
  Pub/Sub:               http://localhost:9005

${GREEN}Optional Services (use flags):${NC}
  Search API:            http://localhost:9100/docs
  BrightData API:        http://localhost:9101/docs
  Viewer:                http://localhost:9102
  Web App:               http://localhost:9200
  Redis:                 localhost:9300

${GREEN}Stripe Testing:${NC}
  Run in separate terminal: stripe listen --forward-to localhost:9004/.../stripeWebhook

${GREEN}Logs:${NC}
  All service logs are written to: ${LOG_DIR}/

EOF
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# If --all flag is used, start everything
if [ "$ALL_SERVICES" = true ]; then
    START_EMULATORS=true
    START_SEARCH=true
    START_BRIGHTDATA=true
    START_VIEWER=true
    START_REDIS=true
fi

# If any service flags are used, keep emulators on by default
if [ "$START_SEARCH" = true ] || [ "$START_BRIGHTDATA" = true ] || \
   [ "$START_VIEWER" = true ] || [ "$START_WEB" = true ]; then
    START_EMULATORS=true
fi

# ═════════════════════════════════════════════════════════════════════════════
# Utility Functions
# ═════════════════════════════════════════════════════════════════════════════

kill_port() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        local pids
        pids=$(lsof -ti tcp:"${port}" 2>/dev/null || true)
        if [[ -n "${pids}" ]]; then
            echo -e "${YELLOW}🔁 Killing process on port ${port}...${NC}"
            kill ${pids} 2>/dev/null || true
            sleep 1
        fi
    fi
}

wait_for_port() {
    local port="$1"
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:${port} >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Port ${port} is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    echo -e "${YELLOW}⚠️  Port ${port} did not become ready${NC}"
        return 1
}

ensure_python_venv() {
    local service_dir="$1"
    local venv_dir="${service_dir}/venv"

    if [[ ! -d "${venv_dir}" ]]; then
        echo -e "${BLUE}🐍 Creating Python virtual environment...${NC}"
        cd "${service_dir}"
        python3 -m venv venv
        source venv/bin/activate
        pip install --quiet --upgrade pip
        if [[ -f "requirements.txt" ]]; then
            pip install --quiet -r requirements.txt
        fi
        cd "${ROOT_DIR}"
    fi
}

check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    local missing=()
    
    # Check Node/Bun
    if ! command -v node >/dev/null 2>&1 && ! command -v bun >/dev/null 2>&1; then
        missing+=("Node.js or Bun")
    fi
    
    # Check Python
    if ! command -v python3 >/dev/null 2>&1; then
        missing+=("Python 3")
    fi
    
    # Check Java (for Firebase emulators)
    if [ "$START_EMULATORS" = true ] && ! command -v java >/dev/null 2>&1; then
        missing+=("Java (required for Firebase emulators)")
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing required tools:${NC}"
        for tool in "${missing[@]}"; do
            echo -e "${RED}   - ${tool}${NC}"
        done
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites met${NC}"
}

# ═════════════════════════════════════════════════════════════════════════════
# Service Startup Functions
# ═════════════════════════════════════════════════════════════════════════════

start_firebase_emulators() {
    echo -e "${CYAN}🔥 Starting Firebase Emulators...${NC}"
    
    # Kill existing emulators comprehensively
    echo -e "${BLUE}   Stopping any existing Firebase emulators...${NC}"
    pkill -f "firebase.*emulators" || true
    pkill -f "firebase-tools" || true
    pkill -f "cloud-firestore-emulator" || true
    pkill -f "pubsub-emulator" || true
    pkill -f "cloud-storage-rules" || true
    
    # Clean up emulator lock files
    rm -f /tmp/hub-*.json 2>/dev/null || true
    
    sleep 2
    
    # Clean up any corrupted Pub/Sub emulator downloads (incomplete downloads)
    if [[ -d ~/.cache/firebase/emulators ]]; then
        find ~/.cache/firebase/emulators -name "*pubsub*" -type f -size -60M -delete 2>/dev/null || true
    fi
    
    # Ensure PATH includes bun and npm bin directories
    export PATH="$HOME/.bun/bin:${ROOT_DIR}/node_modules/.bin:$PATH"
    
    # Find firebase command
    FIREBASE_CMD=$(command -v firebase || echo "")
    if [[ -z "$FIREBASE_CMD" ]]; then
        # Try bun's bin directory
        if [[ -f "$HOME/.bun/bin/firebase" ]]; then
            FIREBASE_CMD="$HOME/.bun/bin/firebase"
        elif [[ -f "${ROOT_DIR}/node_modules/.bin/firebase" ]]; then
            FIREBASE_CMD="${ROOT_DIR}/node_modules/.bin/firebase"
        else
            echo -e "${RED}❌ Firebase CLI not found. Please install with: bun add -g firebase-tools${NC}"
            return 1
        fi
    fi
    
    # Verify firebase.json exists
    if [[ ! -f "${ROOT_DIR}/firebase.json" ]]; then
        echo -e "${RED}❌ firebase.json not found in ${ROOT_DIR}${NC}"
        return 1
    fi
    
    # Change to root directory first (before nohup)
    cd "${ROOT_DIR}"
    
    # Use full PATH in nohup command and ensure we're in the right directory
    # Change directory in the subshell to ensure firebase.json is found
    # Use demo-penny-dev project to skip production API calls that cause permission errors
    nohup bash -c "cd '${ROOT_DIR}' && export PATH=\"\$HOME/.bun/bin:${ROOT_DIR}/node_modules/.bin:\$PATH\" && '${FIREBASE_CMD}' emulators:start --project demo-penny-dev" \
        > "${LOG_DIR}/firebase-emulators.log" 2>&1 &
    local pid=$!
    
    echo -e "${GREEN}✅ Firebase emulators starting (PID ${pid})${NC}"
    echo -e "   Logs: ${LOG_DIR}/firebase-emulators.log"
    echo -e "   UI: http://localhost:9000"
    
    # Wait longer for emulators to initialize (especially for first-time downloads)
    echo -e "${BLUE}⏳ Waiting for emulators to initialize (may take 15-20 seconds on first run)...${NC}"
    sleep 15
    
    # Check if process is still running
    if ! kill -0 $pid 2>/dev/null; then
        echo -e "${RED}❌ Firebase emulators process died. Check logs: ${LOG_DIR}/firebase-emulators.log${NC}"
        echo -e "${YELLOW}💡 Common issues:${NC}"
        echo -e "   - Incomplete emulator downloads (try clearing ~/.cache/firebase/emulators)"
        echo -e "   - Permission errors (check Firebase authentication)"
        return 1
    fi
    
    # Wait for Firestore port (non-fatal check - emulators might need more time)
    if wait_for_port 9002; then
        echo -e "${GREEN}✅ Firestore emulator is ready${NC}"
    else
        echo -e "${YELLOW}⚠️  Firestore port not responding yet (may still be initializing)${NC}"
        echo -e "   Check status at: http://localhost:9000"
    fi
}

start_search_service() {
    echo -e "${CYAN}🔍 Starting Search Service...${NC}"

    local service_dir="${ROOT_DIR}/services/search"
    ensure_python_venv "${service_dir}"
    
    kill_port 9100
    
    cd "${service_dir}"
    # Load env vars and start service with PROFILE set
    nohup bash -c "source ${ROOT_DIR}/scripts/load-env.sh ${PROFILE:-dev} && source venv/bin/activate && PROFILE=${PROFILE:-dev} uvicorn app.main:app --reload --host 0.0.0.0 --port 9100" \
        > "${LOG_DIR}/search-service.log" 2>&1 &
    local pid=$!
    
    echo -e "${GREEN}✅ Search service starting (PID ${pid})${NC}"
    echo -e "   Logs: ${LOG_DIR}/search-service.log"
    echo -e "   API: http://localhost:9100/docs"
}

start_brightdata_service() {
    echo -e "${CYAN}💡 Starting BrightData Service...${NC}"
    
    local service_dir="${ROOT_DIR}/services/brightdata"
    ensure_python_venv "${service_dir}"
    
    kill_port 9101
    
    cd "${service_dir}"
    # Load env vars and start service with PROFILE set
    nohup bash -c "source ${ROOT_DIR}/scripts/load-env.sh ${PROFILE:-dev} && source venv/bin/activate && PROFILE=${PROFILE:-dev} uvicorn app.main:app --reload --host 0.0.0.0 --port 9101" \
        > "${LOG_DIR}/brightdata-service.log" 2>&1 &
    local pid=$!
    
    echo -e "${GREEN}✅ BrightData service starting (PID ${pid})${NC}"
    echo -e "   Logs: ${LOG_DIR}/brightdata-service.log"
    echo -e "   API: http://localhost:9101/docs"
}

start_viewer_service() {
    echo -e "${CYAN}👁️  Starting Viewer Service...${NC}"
    
    local service_dir="${ROOT_DIR}/services/viewer"
    ensure_python_venv "${service_dir}"
    
    kill_port 9102
    
    cd "${service_dir}"
    # Load env vars and start service with PROFILE set
    nohup bash -c "source ${ROOT_DIR}/scripts/load-env.sh ${PROFILE:-dev} && source venv/bin/activate && PROFILE=${PROFILE:-dev} streamlit run app.py --server.port 9102" \
        > "${LOG_DIR}/viewer-service.log" 2>&1 &
    local pid=$!
    
    echo -e "${GREEN}✅ Viewer service starting (PID ${pid})${NC}"
    echo -e "   Logs: ${LOG_DIR}/viewer-service.log"
    echo -e "   URL: http://localhost:9102"
}

start_web_app() {
    echo -e "${CYAN}🌐 Starting Web App...${NC}"
    
    kill_port 9200
    
    cd "${ROOT_DIR}/apps/web"
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        echo -e "${BLUE}📦 Installing web app dependencies...${NC}"
        npm install
    fi
    
    # Load env vars and start app (SvelteKit will pick up PUBLIC_* vars)
    nohup bash -c "source ${ROOT_DIR}/scripts/load-env.sh ${PROFILE:-dev} && npm run dev -- --port 9200" \
        > "${LOG_DIR}/web-app.log" 2>&1 &
    local pid=$!
    
    echo -e "${GREEN}✅ Web app starting (PID ${pid})${NC}"
    echo -e "   Logs: ${LOG_DIR}/web-app.log"
    echo -e "   URL: http://localhost:9200"
}

start_redis() {
    echo -e "${CYAN}🧠 Starting Redis...${NC}"
    
    if ! command -v redis-server >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Redis not found, skipping...${NC}"
        return
    fi

    kill_port 9300
    pkill -f redis-server || true
        sleep 1

    nohup redis-server --port 9300 \
        > "${LOG_DIR}/redis.log" 2>&1 &
    local pid=$!
    
    echo -e "${GREEN}✅ Redis starting (PID ${pid})${NC}"
    echo -e "   Logs: ${LOG_DIR}/redis.log"
    echo -e "   Port: 9300"
}

seed_test_data() {
    echo -e "${CYAN}🌱 Seeding test data...${NC}"
    
    # Wait for emulators to be ready
    sleep 3
    
    cd "${ROOT_DIR}"
    
    if [[ ! -f "scripts/seed-firestore.ts" ]]; then
        echo -e "${YELLOW}⚠️  Seed script not found, skipping...${NC}"
        return
    fi

    firebase emulators:exec --project demo-penny-dev 'node scripts/seed-firestore.ts' \
        > "${LOG_DIR}/seed-data.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Test data seeded successfully${NC}"
    else
        echo -e "${RED}❌ Failed to seed test data (see logs)${NC}"
    fi
}

run_tests() {
    echo -e "${CYAN}🧪 Running tests...${NC}"
    
    cd "${ROOT_DIR}"
    
    # Run Python service tests
    if [ -d "services/search/tests" ]; then
        echo -e "${BLUE}Testing Search service...${NC}"
        cd services/search
        source venv/bin/activate
        PROFILE=test pytest tests/ -v || true
        cd "${ROOT_DIR}"
    fi
    
    if [ -d "services/brightdata/tests" ]; then
        echo -e "${BLUE}Testing BrightData service...${NC}"
        cd services/brightdata
        source venv/bin/activate
        PROFILE=test pytest tests/ -v || true
        cd "${ROOT_DIR}"
    fi
    
    # Run Functions tests
    if [ -d "functions" ]; then
        echo -e "${BLUE}Testing Firebase Functions...${NC}"
        cd functions
        npm test || true
        cd "${ROOT_DIR}"
    fi
    
    echo -e "${GREEN}✅ Tests completed${NC}"
}

# ═════════════════════════════════════════════════════════════════════════════
# Main Execution
# ═════════════════════════════════════════════════════════════════════════════

main() {
    clear
    
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}    🚀 Penny Platform Development Infrastructure Startup     ${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Setup environment
    setup_environment
    check_prerequisites
    
echo ""

    # Handle test mode
if [ "$TEST_MODE" = true ]; then
    run_tests
    exit 0
fi

# Start services
if [ "$START_REDIS" = true ]; then
    start_redis
        echo ""
    fi
    
    if [ "$START_EMULATORS" = true ]; then
        start_firebase_emulators
        echo ""
    fi
    
    # Wait a bit for emulators to initialize
    if [ "$START_EMULATORS" = true ]; then
        sleep 3
fi

if [ "$START_SEARCH" = true ]; then
        start_search_service
        echo ""
fi

if [ "$START_BRIGHTDATA" = true ]; then
        start_brightdata_service
        echo ""
fi

if [ "$START_VIEWER" = true ]; then
        start_viewer_service
        echo ""
    fi
    
    if [ "$START_WEB" = true ]; then
        start_web_app
        echo ""
    fi
    
    # Seed data if requested
    if [ "$SEED_DATA" = true ]; then
        sleep 5  # Give services time to fully start
        seed_test_data
        echo ""
    fi
    
    # Summary
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}           ✨ Development Environment Ready!                  ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    echo -e "${CYAN}📍 Running Services:${NC}"
    if [ "$START_EMULATORS" = true ]; then
        echo -e "  ${GREEN}🔥 Firebase Emulators:${NC}"
        echo "     • Emulator UI:   http://localhost:9000"
        echo "     • Auth:          http://localhost:9001"
        echo "     • Firestore:     http://localhost:9002"
        echo "     • Storage:       http://localhost:9003"
        echo "     • Functions:     http://localhost:9004"
        echo "     • Pub/Sub:       http://localhost:9005"
fi

    if [ "$START_SEARCH" = true ] || [ "$START_BRIGHTDATA" = true ] || \
       [ "$START_VIEWER" = true ] || [ "$START_WEB" = true ] || [ "$START_REDIS" = true ]; then
        echo ""
        echo -e "  ${GREEN}🔧 Backend Services:${NC}"
        if [ "$START_SEARCH" = true ]; then
            echo "     • Search API:      http://localhost:9100/docs"
        fi
        if [ "$START_BRIGHTDATA" = true ]; then
            echo "     • BrightData API:  http://localhost:9101/docs"
        fi
        if [ "$START_VIEWER" = true ]; then
            echo "     • Viewer:          http://localhost:9102"
    fi
        if [ "$START_WEB" = true ]; then
            echo "     • Web App:         http://localhost:9200"
        fi
        if [ "$START_REDIS" = true ]; then
            echo "     • Redis:           localhost:9300"
        fi
fi

echo ""
    echo -e "${CYAN}💳 Stripe Testing:${NC}"
    echo "   Run: stripe listen --forward-to localhost:9004/demo-penny-dev/us-central1/stripeWebhook"
    echo ""
    echo -e "${CYAN}🌱 Seed Test Data:${NC}"
    echo "   Run: ./startup.sh --seed"
    echo ""
    echo -e "${CYAN}📋 Logs:${NC} ${LOG_DIR}/"
echo ""
    echo -e "${YELLOW}💡 Start backend services: ./startup.sh --search --brightdata${NC}"
    echo -e "${YELLOW}💡 Stop all services: ./startup.sh --stop${NC}"
echo ""
}

# Run main function
main
