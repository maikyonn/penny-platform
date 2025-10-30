# Development Environment Setup

## 🚀 Quick Start (Recommended)

```bash
# 1. Start dev environment (Firebase emulators only)
./startup.sh

# 2. Access Firebase Emulator UI
# - http://localhost:9000

# 3. Start backend services when needed
./startup.sh --search --brightdata
```

## 📋 Step-by-Step Setup

### 1. First Time Setup

```bash
# Run complete setup (installs dependencies, configures environment)
./scripts/setup-complete.sh

# Install Stripe CLI for local webhook testing
./scripts/setup-stripe-local.sh
```

### 2. Start Development Environment

**Default: Start Firebase Emulators Only**
```bash
./startup.sh
```

**Start with Backend Services**
```bash
# Specific services (emulators start automatically)
./startup.sh --search --brightdata

# Everything
./startup.sh --all

# With test data seeding
./startup.sh --seed
```

### 3. Stripe Local Testing

```bash
# Start Stripe CLI listener (in separate terminal)
stripe listen --forward-to localhost:9004/penny-dev/us-central1/stripeWebhook

# Test Stripe webhooks
./scripts/test-stripe-webhook.sh
```

## 🎯 Common Workflows

### Daily Development

```bash
# Morning: Start dev environment
./startup.sh

# Start backend services when needed
./startup.sh --search --brightdata

# View logs
tail -f logs/firebase-emulators.log
tail -f logs/search-service.log

# Stop services when done
pkill -f 'firebase|uvicorn|streamlit'
```

### Testing

```bash
# Run all tests
./startup.sh --test

# Test authentication
./scripts/test-auth-all.sh

# Test Stripe integration
./scripts/test-stripe-webhook.sh

# Run specific service tests
cd services/search && pytest
cd functions && npm test
```

### Seed Test Data

```bash
# Seed after emulators are running
npm run seed

# Or use startup script
./startup.sh --seed
```

## 📦 Available Scripts

### Startup Scripts

| Script | Purpose |
|--------|---------|
| `./startup.sh` | Start Firebase emulators (default) |
| `./startup.sh --all` | Start everything (emulators + all services) |
| `./startup.sh --search` | Start emulators + Search service |
| `./startup.sh --brightdata` | Start emulators + BrightData service |
| `./startup.sh --web` | Start emulators + web app |
| `./startup.sh --seed` | Start emulators + seed test data |
| `./startup.sh --test` | Run tests |

### Setup Scripts (Run Once)

| Script | Purpose |
|--------|---------|
| `scripts/setup-complete.sh` | Complete environment setup |
| `scripts/setup-stripe-local.sh` | Install Stripe CLI |
| `scripts/setup-test-env.sh` | Set environment variables |

### Testing Scripts

| Script | Purpose |
|--------|---------|
| `scripts/test-auth-all.sh` | Test authentication |
| `scripts/test-stripe-webhook.sh` | Test Stripe webhooks |
| `scripts/run-all-tests.sh` | Run all tests |

### NPM Scripts

```bash
# Firebase
npm run dev:emulators        # Start emulators
npm run seed                 # Seed test data

# Services
npm run dev:search           # Start Search (port 9100)
npm run dev:brightdata       # Start BrightData (port 9101)
npm run dev:viewer           # Start Viewer (port 9102)

# Testing
npm run test:all             # All tests
npm run test:functions       # Functions tests
npm run test:search          # Search tests
npm run test:brightdata      # BrightData tests
npm run test:stripe          # Stripe tests
npm run test:auth            # Auth tests

# Deployment
npm run deploy:firestore     # Deploy Firestore rules
npm run deploy:functions     # Deploy Functions
```

## 🔧 Environment Variables

These are automatically set by `startup.sh`:

```bash
# Firebase Emulators
FIREBASE_AUTH_EMULATOR_HOST=localhost:9001
FIRESTORE_EMULATOR_HOST=localhost:9002
STORAGE_EMULATOR_HOST=localhost:9003
PUBSUB_EMULATOR_HOST=localhost:9005
GOOGLE_CLOUD_PROJECT=demo-penny-dev

# Service URLs
SEARCH_SERVICE_URL=http://localhost:9100
BRIGHTDATA_SERVICE_URL=http://localhost:9101
PUBLIC_SITE_URL=http://localhost:9200

# Stripe (Test Keys)
STRIPE_SECRET_KEY=sk_test_51SKoanH...
STRIPE_WEBHOOK_SECRET=whsec_65c2322...
STRIPE_TRIAL_DAYS=3
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SKoanH...

# Development
PROFILE=dev
GMAIL_STUB=1
```

## 🚪 Service Ports

| Service | Port | URL |
|---------|------|-----|
| Firebase Emulator UI | 9000 | http://localhost:9000 |
| Auth | 9001 | http://localhost:9001 |
| Firestore | 9002 | http://localhost:9002 |
| Storage | 9003 | http://localhost:9003 |
| Functions | 9004 | http://localhost:9004 |
| Pub/Sub | 9005 | http://localhost:9005 |
| Search API | 9100 | http://localhost:9100/docs |
| BrightData API | 9101 | http://localhost:9101/docs |
| Viewer | 9102 | http://localhost:9102 |
| Web App | 9200 | http://localhost:9200 |
| Redis | 9300 | localhost:9300 |

## 🐛 Troubleshooting

### Ports in use
```bash
# Check ports
lsof -i :9000,9001,9002,9003,9004,9005

# Kill processes
pkill -f 'firebase|uvicorn|streamlit'
```

### Emulators won't start
```bash
# Clear cache
rm -rf ~/.cache/firebase/emulators/

# Restart
./startup.sh --emulators
```

### Dependencies missing
```bash
# Reinstall everything
./scripts/setup-complete.sh
```

### Firebase not authenticated
```bash
firebase login
```

### Stripe CLI not working
```bash
# Reinstall
./scripts/setup-stripe-local.sh

# Authenticate
stripe login
```

## 📝 Logs

All logs are written to `logs/` directory:

```bash
# View logs
tail -f logs/firebase-emulators.log
tail -f logs/search-service.log
tail -f logs/brightdata-service.log
tail -f logs/viewer-service.log

# View all logs
ls -lh logs/
```

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] `./startup.sh` runs without errors
- [ ] Firebase UI accessible at http://localhost:9000
- [ ] Firestore emulator responding at http://localhost:9002
- [ ] Search API docs at http://localhost:9100/docs
- [ ] BrightData API docs at http://localhost:9101/docs
- [ ] Test data seeded successfully
- [ ] Stripe webhook test passes
- [ ] All service tests pass

## 🎓 Learning Resources

- **Firebase Emulators:** https://firebase.google.com/docs/emulator-suite
- **Stripe Testing:** https://stripe.com/docs/testing
- **Service READMEs:**
  - `services/search/README.md`
  - `services/brightdata/README.md`
  - `functions/README.md`

