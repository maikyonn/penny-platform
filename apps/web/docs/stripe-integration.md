# Stripe Integration Technical Notes

## Scope and Intent
This document describes the current Stripe billing integration inside the Penny Platform SvelteKit app. It captures what was implemented during the most recent iteration, where key pieces live in the codebase, what has and has not been validated, and the concrete follow-up work required before you can rely on the integration in production.

---

## High-Level Architecture
| Layer | Responsibilities | Key Files |
| ----- | ---------------- | --------- |
| Environment configuration | surface Stripe keys, price IDs, and metadata to the app | `.env.example`, `src/env.d.ts` |
| Server-side helpers | lazily instantiate Stripe SDK clients, map plan tiers to price IDs, fetch Supabase subscription state | `src/lib/server/stripe.ts`, `src/lib/server/billing/plans.ts`, `src/lib/server/subscriptions.ts` |
| HTTP endpoints | create Checkout sessions, open the Billing Portal, ingest Stripe webhooks | `src/routes/api/billing/checkout/+server.ts`, `src/routes/api/billing/portal/+server.ts`, `src/routes/api/webhooks/stripe/+server.ts` |
| Database | persist subscription status per user and lock it down with RLS | `supabase/migrations/20251014190000_init.sql` (updated `subscriptions` table and policies) |
| Frontend | start checkout from pricing, show success state, expose “Manage billing” actions | `src/routes/pricing/+page.svelte`, `src/routes/(app)/my-account/+page.svelte`, `src/routes/(app)/settings/+page.svelte`, `src/routes/billing/success/+page.svelte` |

---

## Environment Variables
New required variables (all documented in `.env.example` and typed in `src/env.d.ts`):

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER_MONTHLY=price_1SNfDqH1EcnfAMZvPOAmYS9F
STRIPE_PRICE_PRO_MONTHLY=price_1SNfDpH1EcnfAMZv9W6TsTw3
STRIPE_PRICE_EVENT_SPECIAL=price_1SNfDnH1EcnfAMZvTQyNhbEX
STRIPE_TRIAL_DAYS=3
PUBLIC_STRIPE_PUBLISHABLE_KEY=
PUBLIC_SITE_URL=http://localhost:5173
```

Notes:
- `STRIPE_SECRET_KEY` and `PUBLIC_STRIPE_PUBLISHABLE_KEY` must be from the same Stripe account and environment (test vs. live).
- The `STRIPE_PRICE_*` values should point to **recurring** prices that include the 3-day trial.
- `STRIPE_WEBHOOK_SECRET` comes from the Stripe dashboard after registering the webhook endpoint.
- `PUBLIC_SITE_URL` is used to construct success/cancel URLs from server routes; change it to your deployed domain.

---

## Server-Side Components

### `src/lib/server/stripe.ts`
Creates a singleton Stripe SDK instance using `STRIPE_SECRET_KEY`. All server endpoints import `getStripeClient()` to avoid repeated instantiation.

### `src/lib/server/billing/plans.ts`
Provides plan metadata:
- Maps the Svelte UI plan tiers (`starter`, `pro`) to their monthly price IDs.
- Resolves the trial period (`STRIPE_TRIAL_DAYS`).
- Helps translate price IDs seen in webhook events back to internal tiers.

### `src/lib/server/subscriptions.ts`
Wrapper around Supabase to fetch a user’s subscription row. Used in server `load` functions and API handlers.

### API Routes
1. **POST `/api/billing/checkout`**
   - Requires an authenticated Supabase session.
   - Validates the requested plan.
   - Calls `stripe.checkout.sessions.create` for `mode: subscription`.
   - Passes through trial days, metadata, and existing customer ID if known.
   - Returns the Checkout session ID/URL to the client.

2. **POST `/api/billing/portal`**
   - Requires authentication and an existing Stripe customer ID.
   - Creates a Billing Portal session so customers can update payment methods, cancel, etc.
   - Returns a redirect URL.

3. **POST `/api/webhooks/stripe`**
   - Verifies signatures using `STRIPE_WEBHOOK_SECRET`.
   - Responds to:
     - `checkout.session.completed`: fetches the associated subscription and persists it.
     - `customer.subscription.created/updated/deleted`: upserts subscription status with current period end.
   - Stores `{ user_id, provider_customer_id, provider_subscription_id, plan, status, current_period_end }` in Supabase.

Security considerations:
- Signature verification protects the webhook endpoint.
- Only authenticated users can start checkout or portal sessions.
- Stripe metadata includes `supabase_user_id` and `plan_tier` to map events back to users.

---

## Database Changes
The `subscriptions` table (and RLS) was reshaped in `supabase/migrations/20251014190000_init.sql`:
- Primary identifier: `user_id` (FK to `profiles.user_id`), plus unique indexes on `user_id` and `provider_subscription_id`.
- New policy `"Users can view their subscription"` ensures each user can select their own record, nothing else.
- No automated backfill was performed; deploy the migration and seed data as needed.

---

## Frontend Flow

### Pricing Page (`src/routes/pricing/+page.svelte`)
- Loads the current subscription to highlight the active plan.
- Uses Stripe.js (via `loadStripe`) to redirect to Checkout when a paid plan is selected.
- Posts `{ plan }` to `/api/billing/checkout`.
- Displays errors for misconfiguration (missing publishable key, checkout failures) and a banner if the user cancels Checkout.
- “Enterprise” plan falls back to a `mailto:` link for now.

### Account & Settings (`src/routes/(app)/my-account/+page.svelte` and `.../settings/+page.svelte`)
- Show subscription details (plan name, status, renewal date).
- Surface a “Manage billing” button that posts to `/api/billing/portal` and redirects to Stripe’s portal.

### Success Page (`src/routes/billing/success`)
- Server load fetches the latest subscription and displays confirmation UI after a successful checkout redirect.

---

## What Has Been Done So Far
1. Wired Stripe SDK usage, plan configuration, and helper utilities.
2. Implemented end-to-end API endpoints for creating checkout sessions, serving the customer portal, and handling Stripe webhooks.
3. Updated Supabase schema and RLS to store subscriptions per user securely.
4. Replaced the fake checkout flow in the pricing UI and added billing actions in account/settings pages.
5. Documented the required environment variables and architecture changes (`README.md`, `ARCHITECTURE.md`, `.env.example`).
6. Installed Stripe client/server dependencies (`stripe`, `@stripe/stripe-js`).

---

## Testing Status
| Area | Status | Notes |
| ---- | ------ | ----- |
| Type checking (`npm run check`) | **Failing** | Existing project errors (≈141) pre-date this integration; they block lint/type validation, so no new Svelte components were type-validated yet. |
| Automated tests | Not run | No unit/e2e coverage exists for billing routes at this stage. |
| Manual checkout | Not executed | Needs valid Stripe test keys, price IDs, webhook forwarding, and a seeded user session. |
| Webhook processing | Not executed | Enforces signature verification; requires `stripe listen` or hosted endpoint. |

Because the codebase has existing Svelte typing issues, running the full pipeline was not possible. Validating real flows will require clearing those blockers first.

---

## Required Next Steps
1. **Rotate secrets**  
   The live secret key was exposed in chat logs. Immediately revoke it from the Stripe Dashboard and generate a fresh one, then update deployment environments.

2. **Create recurring prices**  
   The script now creates live monthly prices automatically (Starter `price_1SNfDq...`, Growth `price_1SNfDp...`, Event `price_1SNfDn...`). Update `.env` with the printed IDs whenever you regenerate them.

3. **Populate environment variables**  
   Update local `.env` and deployment configs with all new variables. Ensure `PUBLIC_SITE_URL` matches the domain users hit.

4. **Register the webhook endpoint**  
   - For production: add `https://<your-domain>/api/webhooks/stripe` in Stripe’s console and paste the signing secret into `STRIPE_WEBHOOK_SECRET`.
   - For local testing: run `stripe listen --forward-to http://localhost:5173/api/webhooks/stripe` and export the temporary secret.

5. **Seed/validate subscription data**  
   After running checkout in test mode, confirm records appear in `public.subscriptions` and that account/settings pages reflect the right status.

6. **Resolve existing TypeScript/Svelte errors**  
   The project’s `svelte-check` failures must be fixed to regain confidence in builds and to accurately validate new UI.

7. **Add regression tests**  
   Minimum coverage should include:
   - API route tests for checkout/portal success and failure states (mocking Stripe).
   - Webhook handler tests verifying upsert behavior for create/update/delete events.
   - Frontend component tests or Playwright scenarios for the checkout CTA and billing portal button.

8. **Harden error handling**  
   Consider surfacing more explicit messaging when Stripe is misconfigured (e.g., fallback contact form) and log metrics for webhook failures.

9. **Plan migration for organizations** *(optional but recommended)*  
   If billing should be tracked per organization instead of per-user, update the schema to reintroduce `org_id` and adjust policies accordingly.

---

## Quick Reference
- **Start checkout**: client → `/api/billing/checkout` → Stripe Checkout → redirect → `/billing/success`.
- **Manage billing**: client → `/api/billing/portal` → Stripe Billing Portal → return URL `/my-account`.
- **Status sync**: Stripe → `/api/webhooks/stripe` → Supabase `public.subscriptions`.

Keep this doc updated as you add automated tests, expand plans, or introduce metered billing.*** End Patch
