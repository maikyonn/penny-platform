# Development Guide

Complete guide for setting up and running the Penny Platform development environment.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Starting the Development Environment](#starting-the-development-environment)
- [Service URLs & Ports](#service-urls--ports)
- [Common Workflows](#common-workflows)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js 20+** or **Bun** (recommended)
- **Python 3.8+** with `venv` support
- **Java 17+** (required for Firebase emulators)
- **Redis** (optional, for job queuing)
- **Git**

### Installing Prerequisites

#### On Amazon Linux / RHEL / Fedora:

```bash
# Java 17
sudo dnf install java-17-amazon-corretto java-17-amazon-corretto-devel

# Python 3
sudo dnf install python3 python3-pip python3-venv

# Redis (optional)
sudo dnf install redis
```

#### On macOS:

```bash
# Using Homebrew
brew install openjdk@17 python@3.11 redis bun
```

#### On Ubuntu/Debian:

```bash
sudo apt update
sudo apt install openjdk-17-jdk python3 python3-pip python3-venv redis-server bun
```

## Environment Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd penny-platform
```

### 2. Configure Environment Variables

Environment variables are managed centrally in the `env/` directory:

1. **Copy the example file:**
   ```bash
   cp env/.env.example env/.env
   ```

2. **Edit `env/.env`** and fill in your API keys:
   - `OPENAI_API_KEY` - OpenAI API key for LLM features
   - `DEEPINFRA_API_KEY` - DeepInfra API key for embeddings
   - `BRIGHTDATA_API_KEY` - BrightData API key
   - `STRIPE_SECRET_KEY` - Stripe secret key
   - `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret

3. **Configure profile-specific settings** in `env/.env.dev`:
   ```bash
   # Profile & Environment
   PROFILE=dev
   APP_ENV=local
   LOG_LEVEL=debug
   ```

### 3. Install Dependencies

```bash
# Install Node.js dependencies (using bun)
bun install

# Python dependencies are installed automatically when services start
# Or manually:
cd services/search && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
cd services/brightdata && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

### 4. Database Setup

Ensure the LanceDB database is available:

```bash
# Check if database exists
ls -la DIME-AI-DB/data/lancedb/

# If missing, ensure DB_PATH is set correctly in env/.env
DB_PATH=/path/to/DIME-AI-DB/data/lancedb
```

## Starting the Development Environment

### Quick Start

The `startup.sh` script manages all services. By default, it starts only Firebase emulators:

```bash
# Start Firebase emulators only (default)
./startup.sh

# Start everything (emulators + all services)
./startup.sh --all

# Start specific services
./startup.sh --search --brightdata
```

### Available Options

```bash
./startup.sh [options]

Options:
  --all          Start everything (emulators + all services)
  --emulators    Start Firebase emulators (default)
  --search       Start Search API service (Port 9100)
  --brightdata   Start BrightData service (Port 9101)
  --viewer       Start Viewer service (Port 9102)
  --web          Start SvelteKit web app (Port 9200)
  --redis        Start Redis server (Port 9300)
  --seed         Seed Firebase with test data
  --test         Run service tests
  --help, -h     Show help message
```

### Examples

```bash
# Development infrastructure only (Firebase emulators)
./startup.sh

# Full stack development
./startup.sh --all

# Backend services only
./startup.sh --search --brightdata --redis

# With test data
./startup.sh --all --seed

# Frontend development
./startup.sh --web

# Get help
./startup.sh --help
```

## Service URLs & Ports

### Firebase Emulators (Default)

| Service | Port | URL |
|---------|------|-----|
| Emulator UI | 9000 | http://localhost:9000 |
| Auth Emulator | 9001 | http://localhost:9001 |
| Firestore Emulator | 9002 | http://localhost:9002 |
| Storage Emulator | 9003 | http://localhost:9003 |
| Functions Emulator | 9004 | http://localhost:9004 |
| Pub/Sub Emulator | 9005 | http://localhost:9005 |

### Backend Services

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| Search API | 9100 | http://localhost:9100/docs | FastAPI search service |
| BrightData API | 9101 | http://localhost:9101/docs | FastAPI BrightData service |
| Viewer | 9102 | http://localhost:9102 | Streamlit database viewer |

### Frontend & Infrastructure

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| Web App | 9200 | http://localhost:9200 | SvelteKit frontend |
| Redis | 9300 | localhost:9300 | Redis server (job queue) |

## Common Workflows

### Starting Fresh

```bash
# 1. Start emulators
./startup.sh

# 2. In another terminal, start backend services
./startup.sh --search --brightdata --redis

# 3. In another terminal, start frontend
./startup.sh --web
```

### Full Stack Development

```bash
# Start everything at once
./startup.sh --all
```

### Backend Development

```bash
# Start emulators + backend services
./startup.sh --search --brightdata --redis
```

### Frontend Development

```bash
# Start emulators + web app
./startup.sh --web
```

### Viewing Logs

All service logs are written to `logs/`:

```bash
# Tail all logs
tail -f logs/*.log

# Specific service logs
tail -f logs/search-service.log
tail -f logs/brightdata-service.log
tail -f logs/firebase-emulators.log
```

### Stopping Services

```bash
# Stop all services
pkill -f 'firebase|uvicorn|streamlit|redis-server'

# Or stop specific ports
lsof -ti:9100 | xargs kill -9  # Search service
lsof -ti:9101 | xargs kill -9  # BrightData service
lsof -ti:9200 | xargs kill -9  # Web app
```

## Environment Variables

Environment variables are loaded from centralized files in `env/`:

- **`env/.env`** - Base configuration (shared across all profiles)
- **`env/.env.dev`** - Development profile overrides
- **`env/.env.test`** - Test profile overrides

### Key Environment Variables

```bash
# Profile
PROFILE=dev

# Firebase
FIRESTORE_EMULATOR_HOST=localhost:9002
FIREBASE_AUTH_EMULATOR_HOST=localhost:9001
GOOGLE_CLOUD_PROJECT=penny-dev

# Database
DB_PATH=/path/to/DIME-AI-DB/data/lancedb

# Service URLs
SEARCH_API_URL=http://localhost:9100
BRIGHTDATA_API_URL=http://localhost:9101

# API Keys (set in env/.env)
OPENAI_API_KEY=sk-...
DEEPINFRA_API_KEY=...
BRIGHTDATA_API_KEY=...
STRIPE_SECRET_KEY=sk_test_...
```

### Loading Environment Variables

Services automatically load env vars from `env/`:
- **Python services** - Load via `packages/config/py/settings.py`
- **Shell scripts** - Load via `scripts/load-env.sh`
- **Node.js apps** - Load via `scripts/load-env.js`

## Testing

### Running Tests

```bash
# Run all tests
./startup.sh --test

# Or run service-specific tests
cd services/search && pytest
cd services/brightdata && pytest
cd functions && bun test
```

### Test Profiles

Tests use the `test` profile automatically:

```bash
# Tests load from env/.env.test
PROFILE=test pytest
```

### Stripe Testing

For Stripe webhook testing:

```bash
# 1. Start Firebase emulators
./startup.sh

# 2. In another terminal, forward Stripe events
stripe listen --forward-to http://localhost:9004/penny-dev/us-central1/stripeWebhook

# 3. Trigger test events
stripe trigger checkout.session.completed
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i:9100

# Kill process
lsof -ti:9100 | xargs kill -9
```

### Firebase Emulators Not Starting

```bash
# Check Java version
java -version  # Should be Java 17+

# Check Firebase CLI
firebase --version

# Clear emulator cache
rm -rf ~/.cache/firebase/emulators/
```

### Python Services Not Starting

```bash
# Check virtual environment exists
ls services/search/venv/

# Recreate virtual environment
cd services/search
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Database Not Found

```bash
# Check DB_PATH in env/.env
cat env/.env | grep DB_PATH

# Verify database exists
ls -la DIME-AI-DB/data/lancedb/

# Update DB_PATH if needed
# In env/.env:
DB_PATH=/full/path/to/DIME-AI-DB/data/lancedb
```

### Environment Variables Not Loading

```bash
# Verify env files exist
ls -la env/

# Check load-env script
source scripts/load-env.sh dev
echo $PROFILE  # Should output "dev"

# Manually set PROFILE
export PROFILE=dev
./startup.sh --search
```

### Services Not Responding

```bash
# Check if service is running
curl http://localhost:9100/docs  # Search service
curl http://localhost:9101/docs  # BrightData service

# Check logs
tail -f logs/search-service.log
tail -f logs/brightdata-service.log

# Restart service
pkill -f "uvicorn.*9100"
./startup.sh --search
```

### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping  # Should return "PONG"

# Start Redis manually
redis-server --port 6379

# Or use startup script
./startup.sh --redis
```

## Additional Resources

- **Search Service:** `services/search/README.md`
- **BrightData Service:** `services/brightdata/README.md`
- **Firebase Functions:** `functions/README.md`
- **Web App:** `apps/web/README.md`
- **Main README:** `README.md`

## Getting Help

- Check service logs in `logs/` directory
- Review error messages in terminal output
- Verify environment variables are set correctly
- Ensure all prerequisites are installed
- Check service ports are not in use

