# Penny Platform Web Frontend

SvelteKit frontend application for the Penny Platform, integrated with Supabase backend.

## Overview

This is a SvelteKit application that provides the web interface for the Penny Platform. It's integrated with:

- **Supabase** - Authentication, database, storage, and Edge Functions
- **Stripe** - Billing and subscription management
- **Search API** - Connects to `services/search` (port 7001)
- **BrightData Service** - Image refresh capabilities via `services/brightdata` (port 7100)

## Getting Started

### 1. Install Dependencies

```bash
cd apps/web
npm install
```

### 2. Environment Variables

Copy `.env.production` to `.env.local` and populate the following:

**Supabase Configuration:**
```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

**Stripe Configuration:**
```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER_MONTHLY=price_1SNfDqH1EcnfAMZvPOAmYS9F
STRIPE_PRICE_PRO_MONTHLY=price_1SNfDpH1EcnfAMZv9W6TsTw3
STRIPE_PRICE_EVENT_SPECIAL=price_1SNfDnH1EcnfAMZvTQyNhbEX
STRIPE_TRIAL_DAYS=3
PUBLIC_STRIPE_PUBLISHABLE_KEY=
PUBLIC_SITE_URL=http://localhost:5173
```

**Platform Services:**
```env
PUBLIC_SEARCH_API_URL=http://localhost:7001
PUBLIC_BRIGHTDATA_API_URL=http://localhost:7100
```

For local development, `PUBLIC_*` values should match their non-public counterparts.

### 3. Database Setup

Apply the initial migration to your Supabase project:

```bash
supabase db push
```

The migration file `supabase/migrations/20251014190000_init.sql` provisions:
- Organizations & access control
- Campaigns & targeting
- Influencers & outreach
- AI recommendations & chat
- Billing & usage tracking

### 4. Edge Functions

Deploy Edge Functions:

```bash
supabase functions deploy campaigns-create
supabase functions deploy campaigns-match
supabase functions deploy outreach-send
supabase functions deploy reports-generate
supabase functions deploy support-ai-router
supabase functions deploy cron-refresh-influencers
supabase functions deploy cron-billing-meter --no-verify-jwt
```

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Project Structure

```
apps/web/
├── src/
│   ├── lib/              # Shared utilities and Supabase clients
│   ├── routes/           # SvelteKit routes
│   ├── components/       # Reusable components
│   └── edge-functions/  # Edge Function source code
├── supabase/
│   ├── migrations/       # Database migrations
│   └── functions/        # Edge Function deployments
├── e2e/                  # Playwright E2E tests
└── tests/                # Unit tests
```

## Integration with Monorepo Services

### Search API

The frontend connects to the Search API at `services/search`:
- Endpoint: `http://localhost:7001/search`
- Used for creator/influencer search functionality

### BrightData Service

The frontend uses BrightData service at `services/brightdata`:
- Endpoint: `http://localhost:7100/brightdata`
- Used for profile image refresh operations

### Centralized Config

The frontend can use the centralized `@penny/config` package for shared configuration. Update imports to use:

```typescript
import { ENV } from "@penny/config";
```

## Testing

### Unit Tests

```bash
npm run test
```

### E2E Tests

```bash
npm run test:e2e
```

## Deployment

The app is configured for Vercel deployment (see `vercel.json`). To deploy:

1. Push to your repository
2. Connect to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

## Database Schema

See `ARCHITECTURE.md` for detailed database schema documentation. Key tables include:

- `organizations` - Multi-tenant organization structure
- `campaigns` - Campaign management
- `influencers` - Influencer catalog
- `outreach_threads` - Outreach conversations
- `subscriptions` - Stripe subscription tracking
- `usage_logs` - Usage metering

All tables have Row Level Security (RLS) enabled.

## Stripe Integration

The app integrates with Stripe for billing:

- **Starter Plan**: $99/month (3-day trial)
- **Growth Plan**: $299/month
- **Event Special**: $999 one-time

Webhook endpoint: `/api/webhooks/stripe`

## Development Notes

- `src/hooks.server.ts` attaches Supabase server client to `event.locals`
- Browser components use `getBrowserClient()` from `src/lib/supabase/browserClient.ts`
- Database typings are in `src/lib/database.types.ts`
- To seed data locally, use `supabase start` (requires Docker)

## Original Source

This frontend was cloned from: https://github.com/maikyonn/penny-platform.git
