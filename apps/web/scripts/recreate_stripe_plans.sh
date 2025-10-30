#!/usr/bin/env bash

# Rebuilds the Penny Platform pricing catalog in Stripe using the Stripe CLI.
# This script creates:
#   - Starter Plan (recurring $99/month with optional 3-day trial)
#   - Growth Plan (recurring $299/month)
#   - Event / Pop-Up Special (one-time $999 concierge package)
#
# Requirements:
#   1. Export STRIPE_SECRET_KEY with a test or live key before running.
#   2. Install the Stripe CLI (https://stripe.com/docs/stripe-cli) and ensure it is on PATH.
#   3. Install jq for parsing JSON responses.
#
# Usage:
#   chmod +x scripts/recreate_stripe_plans.sh
#   ./scripts/recreate_stripe_plans.sh

set -euo pipefail

if ! command -v stripe >/dev/null 2>&1; then
	printf 'Error: stripe CLI was not found on PATH. Install it from https://stripe.com/docs/stripe-cli\n' >&2
	exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
	printf 'Error: jq is required to parse Stripe CLI output. Install jq and retry.\n' >&2
	exit 1
fi

: "${STRIPE_SECRET_KEY:?Set STRIPE_SECRET_KEY before running this script}"

CURRENCY=${STRIPE_PLAN_CURRENCY:-usd}
TRIAL_DAYS=${STRIPE_STARTER_TRIAL_DAYS:-3}

log() {
	printf '\n%s\n' "$1"
}

create_subscription_plan() {
	local name=$1
	local description=$2
	local amount_cents=$3
	local tier=$4
	local include_trial=${5:-false}

	log "Creating product: ${name}"
	local product_json
	product_json=$(stripe products create \
		--name "${name}" \
		--description "${description}" \
		-d "metadata[plan_tier]=${tier}")

	local product_id
	product_id=$(jq -r '.id' <<<"${product_json}")
	printf '  ▸ Product ID: %s\n' "${product_id}"

	log "Creating recurring price for ${name}"
	local price_json
	price_json=$(stripe prices create \
		--product "${product_id}" \
		--currency "${CURRENCY}" \
		--unit-amount "${amount_cents}" \
		-d "recurring[interval]=month")

	local price_id
	price_id=$(jq -r '.id' <<<"${price_json}")
	printf '  ▸ Price ID: %s\n' "${price_id}"

	printf '\nExport these env vars after the script finishes:\n'
	printf '  export STRIPE_PRICE_%s_MONTHLY=%s\n' "$(printf '%s\n' "${tier}" | tr '[:lower:]' '[:upper:]')" "${price_id}"

	# shellcheck disable=SC2034 # make price available to caller if needed
	PLAN_PRODUCT_ID=${product_id}
	PLAN_PRICE_ID=${price_id}
}

create_event_package() {
	local name=$1
	local description=$2
	local amount_cents=$3

	log "Creating one-time product: ${name}"
	local product_json
	product_json=$(stripe products create \
		--name "${name}" \
		--description "${description}" \
		-d "metadata[plan_tier]=event_special")

	local product_id
	product_id=$(jq -r '.id' <<<"${product_json}")
	printf '  ▸ Product ID: %s\n' "${product_id}"

	log "Creating one-time price for ${name}"
	local price_json
	price_json=$(stripe prices create \
		--product "${product_id}" \
		--currency "${CURRENCY}" \
		--unit-amount "${amount_cents}")

	local price_id
	price_id=$(jq -r '.id' <<<"${price_json}")
	printf '  ▸ Price ID: %s\n' "${price_id}"

	printf '\nOptional env var for event package:\n'
	printf '  export STRIPE_PRICE_EVENT_SPECIAL=%s\n' "${price_id}"
}

log '--- Recreating Penny Starter Plan ($99/mo) ---'
create_subscription_plan \
	'Penny Starter Plan' \
	'Local activations: 300 new influencers, 1 inbox, priority trial responses.' \
	9900 \
	'starter' \
	true

log '--- Recreating Penny Growth Plan ($299/mo) ---'
create_subscription_plan \
	'Penny Growth Plan' \
	'Agencies & growing brands: 1,000 influencers, 3 inboxes, advanced analytics.' \
	29900 \
	'pro' \
	false

log '--- Recreating Event / Pop-Up Special ($999 one-time) ---'
create_event_package \
	'Penny Event / Pop-Up Special' \
	'Concierge event blast: 5,000 influencers, CRM sync, white-glove onboarding.' \
	99900

printf '\nAll plans recreated successfully. Update your .env with the printed price IDs.\n'
