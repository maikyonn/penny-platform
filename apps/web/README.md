# Penny Platform Web Frontend

SvelteKit frontend application for the Penny Platform, now backed entirely by Firebase (Firestore, Cloud Functions, and Identity Toolkit).

## Overview

This app integrates with the following services:

- **Firebase** – Authentication, Firestore data storage, and Cloud Functions for backend logic
- **Stripe** – Billing and subscription management (via Firebase Extension)
- **Search API** – Connects to `services/search` (port 9100)
- **BrightData Service** – Image refresh capabilities via `services/brightdata` (port 9101)

## Getting Started

### 1. Install dependencies

```bash
cd apps/web
npm install
```

### 2. Environment variables

Environment variables are loaded from the root `env/.env` file by `./startup.sh`. Ensure the following keys are populated:

```env
# Firebase Identity (client SDK)
FIREBASE_WEB_API_KEY=

# Gmail OAuth (delegated sending)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

The startup script also sets the Firebase emulator hosts (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, etc.).

### 3. Run locally

From the repository root:

```bash
./startup.sh --web
```

Open the app at [http://localhost:9200](http://localhost:9200).

## Project structure (simplified)

```
apps/web/
├── src/
│   ├── lib/              # Shared UI components and server utilities
│   ├── routes/           # SvelteKit routes (API + pages)
│   └── lib/server        # Firebase admin helpers, Firestore loaders
├── tests/                # Vitest unit/integration tests
├── package.json
└── README.md
```

## Testing

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Firestore data model

The frontend expects Firestore collections aligned with the backend schema:

- `users/{uid}` – Plan info, usage limits, Gmail metadata
- `outreach_campaigns/{campaignId}` – Campaign details with a `targets/` subcollection
- `threads/{threadId}` – Outreach conversations (messages stored in `threads/{id}/messages`)
- `influencers/{influencerId}` – Global influencer catalog

## Notes

- Legacy Supabase files have been removed; any remaining references in scripts/tests have been deprecated.
- Stripe webhooks are now handled by Firebase Functions (`functions/src/stripe.ts`) and update `users/{uid}.plan`.
- Gmail authorization and sending flow is routed through the `gmailAuthorize`/`gmailSend` Cloud Functions.
