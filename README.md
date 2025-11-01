# Penny Platform

AI-powered influencer marketing platform.

## Quick Start

```bash
# Start development environment (Firebase emulators)
./startup.sh

# Start with backend services
./startup.sh --search --brightdata

# Start everything
./startup.sh --all
```

## Services

| Service | Port | URL |
|---------|------|-----|
| Firebase Emulator UI | 9000 | http://localhost:9000 |
| Auth Emulator | 9001 | http://localhost:9001 |
| Firestore Emulator | 9002 | http://localhost:9002 |
| Storage Emulator | 9003 | http://localhost:9003 |
| Functions Emulator | 9004 | http://localhost:9004 |
| Pub/Sub Emulator | 9005 | http://localhost:9005 |
| Search API | 9100 | http://localhost:9100/docs |
| BrightData API | 9101 | http://localhost:9101/docs |
| Viewer | 9102 | http://localhost:9102 |
| Web App | 9200 | http://localhost:9200 |
| Redis | 9300 | localhost:9300 |

## Usage

```bash
# Start dev environment (Firebase emulators only - default)
./startup.sh

# Start everything (emulators + all services)
./startup.sh --all

# Start specific backend services (emulators start automatically)
./startup.sh --search --brightdata

# Start with test data
./startup.sh --seed

# Run tests
./startup.sh --test

# Get help
./startup.sh --help
```

## Prerequisites

- **Node.js** or **Bun**
- **Python 3.8+**
- **Java 17+** (for Firebase emulators)
- **Redis** (optional)

## Development

```bash
# View logs
tail -f logs/<service>.log

# Stop all services
pkill -f 'firebase|uvicorn|streamlit'
```

## Project Structure

```
penny-platform/
├── apps/
│   └── web/              # SvelteKit web app
├── services/
│   ├── search/           # Search API (FastAPI)
│   ├── brightdata/       # BrightData service (FastAPI)
│   └── viewer/           # Viewer (Streamlit)
├── functions/            # Firebase Functions
├── packages/
│   ├── config/           # Shared configuration
│   └── shared/           # Shared types/schemas
├── scripts/              # Utility scripts
├── startup.sh            # 🚀 Main startup script
└── logs/                 # Service logs
```

## Configuration

Environment variables are automatically set by `startup.sh`. Key variables:

- `FIRESTORE_EMULATOR_HOST=localhost:9002`
- `FIREBASE_AUTH_EMULATOR_HOST=localhost:9001`
- `SEARCH_SERVICE_URL=http://localhost:9100`
- `BRIGHTDATA_SERVICE_URL=http://localhost:9101`

## Testing

```bash
# Run all tests
./startup.sh --test

# Test specific service
cd services/search && pytest
cd services/brightdata && pytest
cd functions && npm test
```

## Deployment

### Cloud Functions

```bash
# deploy a single function
firebase deploy --only functions:chatbotIntake

# or deploy every custom function at once
firebase deploy --only functions
```

Make sure the Cloud Build service account `853331514443@cloudbuild.gserviceaccount.com` has these IAM roles:

- `roles/cloudfunctions.developer`
- `roles/run.admin`
- `roles/iam.serviceAccountUser`
- `roles/artifactregistry.reader`
- `roles/artifactregistry.writer`
- `roles/storage.objectViewer`
- `roles/logging.logWriter`

If deploys complain about Artifact Registry access, grant repository-level bindings:

```bash
gcloud artifacts repositories add-iam-policy-binding gcf-artifacts \
  --project penni-platform --location us-central1 \
  --member=serviceAccount:853331514443-compute@developer.gserviceaccount.com \
  --role=roles/artifactregistry.reader

gcloud artifacts repositories add-iam-policy-binding gcf-artifacts \
  --project penni-platform --location us-central1 \
  --member=serviceAccount:853331514443-compute@developer.gserviceaccount.com \
  --role=roles/artifactregistry.writer
```

An artifact cleanup policy keeps container images from accumulating:

```bash
firebase functions:artifacts:setpolicy --location us-central1 --days 30 --force
```

### Web Frontend (Firebase App Hosting)

1. Initialize App Hosting (one time):

   ```bash
   firebase init apphosting
   ```

   - Link to backend `penni-web-backend`
   - Root directory: `apps/web`
   - Install: `npm install`
   - Build: `npm run build`
   - Start: `npm run start`

   This writes `apphosting.yaml` for the backend.

2. Deploy the SvelteKit app:

   ```bash
   cd apps/web
   npm run build
   cd ..
   firebase deploy --only apphosting:penni-web-backend
   ```

Secrets (Stripe, Gmail, OpenAI, etc.) belong in Google Secret Manager; the deploy automatically grants the build identity access.

## Documentation

- **Search Service:** `services/search/README.md`
- **BrightData Service:** `services/brightdata/README.md`
- **Functions:** `functions/README.md`
- **Web App:** `apps/web/README.md`
