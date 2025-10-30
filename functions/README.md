# Firebase Functions

Firebase Cloud Functions (Gen 2) for Penny Platform, migrated from Supabase Edge Functions.

## Structure

```
functions/
├── src/
│   ├── index.ts           # Main exports
│   ├── gmail.ts           # Gmail OAuth and send
│   ├── stripe.ts          # Stripe webhooks
│   ├── campaigns.ts       # Campaign CRUD operations
│   ├── ai.ts              # AI endpoints (draft, chatbot, router)
│   ├── reports.ts         # Report generation
│   ├── search.ts          # Search stub/proxy
│   ├── cron/              # Scheduled functions
│   │   ├── billing-meter.ts
│   │   └── refresh-influencers.ts
│   └── pubsub/            # Pub/Sub handlers
│       └── outreach-send.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Install Dependencies

```bash
cd functions
npm install
```

### Build

```bash
npm run build
```

### Run Locally with Emulators

Functions run automatically when you start the Firebase Emulator Suite:

```bash
# From root directory
npm run dev:emulators
```

Functions will be available at:
- `http://localhost:5001/penny-dev/us-central1/{functionName}`

### Test Functions

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Deploy

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:gmailSend
```

## Function Endpoints

### Gmail

- `gmailAuthorize` - OAuth callback handler
- `gmailSend` - Send outreach email via Gmail API

### Stripe

- `stripeWebhook` - Handle Stripe webhook events

### Campaigns

- `campaignsCreate` - Create new campaign
- `campaignsMatch` - Match influencers to campaign

### AI

- `aiDraftOutreach` - Generate outreach draft with AI
- `chatbotStub` - Chatbot endpoint (stubbed)
- `supportAiRouter` - Route support queries

### Reports

- `reportsGenerate` - Generate campaign reports

### Search

- `searchStub` - Search endpoint stub

### Scheduled

- `billingMeter` - Hourly billing meter aggregation
- `refreshInfluencers` - Refresh influencer data (runs every 12 hours)

### Pub/Sub

- `outreachSend` - Process outreach messages from Pub/Sub

## Environment Variables

Set these in Firebase Console (Secret Manager) or `.env.local` for local development:

- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `GMAIL_STUB` - Set to "1" to stub Gmail API (for dev/testing)

## Migration from Supabase Edge Functions

| Supabase Edge Function | Firebase Function | Status |
|------------------------|-------------------|--------|
| `gmail-send` | `gmailSend` | ✅ Migrated |
| `gmail-authorize` | `gmailAuthorize` | ✅ Migrated |
| `campaigns-create` | `campaignsCreate` | ✅ Migrated |
| `campaigns-match` | `campaignsMatch` | ✅ Migrated |
| `ai-draft-outreach` | `aiDraftOutreach` | ✅ Migrated |
| `chatbot-stub` | `chatbotStub` | ✅ Migrated |
| `support-ai-router` | `supportAiRouter` | ✅ Migrated |
| `reports-generate` | `reportsGenerate` | ✅ Migrated |
| `search-stub` | `searchStub` | ✅ Migrated |
| `cron-billing-meter` | `billingMeter` | ✅ Migrated |
| `cron-refresh-influencers` | `refreshInfluencers` | ✅ Migrated |
| `outreach-send` | `outreachSend` | ✅ Migrated |

## Testing

### Unit Tests

Create test files in `functions/src/__tests__/`:

```typescript
import { describe, it, expect } from "vitest";
import { gmailSend } from "../gmail";

describe("gmailSend", () => {
  it("should send email in stub mode", async () => {
    // Test implementation
  });
});
```

### Integration Tests with Emulators

```bash
# Start emulators
firebase emulators:start

# Run tests that use emulators
npm test
```

## Error Handling

All functions should:
1. Verify authentication/authorization
2. Validate input with Zod schemas (from `@penny/shared`)
3. Handle errors gracefully
4. Return appropriate HTTP status codes
5. Log errors for debugging

## Secrets Management

For production, use Firebase Secret Manager:

```bash
# Set a secret
firebase functions:secrets:set STRIPE_SECRET_KEY

# List secrets
firebase functions:secrets:access STRIPE_SECRET_KEY
```

In function code, reference secrets in the function config:

```typescript
export const myFunction = onRequest(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (req, res) => {
    const key = process.env.STRIPE_SECRET_KEY;
    // ...
  }
);
```

