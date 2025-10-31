import { STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_STARTER_MONTHLY, STRIPE_TRIAL_DAYS } from '$env/static/private';

export type PlanTier = 'starter' | 'pro' | 'special_event';

type PlanConfig = {
	tier: PlanTier;
	label: string;
	priceId: string | null;
	trialDays?: number; // trial days for subscription, not price
};

const sanitize = (value: string | undefined | null) => {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
};

const PLAN_CONFIGS: PlanConfig[] = [
	{
		tier: 'starter',
		label: 'Starter Plan',
		priceId: sanitize(STRIPE_PRICE_STARTER_MONTHLY),
		trialDays: Number(STRIPE_TRIAL_DAYS ?? '0'),
	},
	{
		tier: 'pro',
		label: 'Growth Plan',
		priceId: sanitize(STRIPE_PRICE_PRO_MONTHLY),
		trialDays: 0, // Pro tier does not include trial
	},
	{
		tier: 'special_event',
		label: 'Event / Pop-Up Special',
		priceId: null,
		trialDays: 0,
	},
];

export function getPriceIdForPlan(tier: PlanTier): string | null {
	const config = PLAN_CONFIGS.find((plan) => plan.tier === tier);
	if (!config) {
		return null;
	}
	return config.priceId ?? null;
}

export function getPlanByPriceId(priceId: string | null | undefined): PlanConfig | null {
	if (!priceId) {
		return null;
	}
	const normalized = priceId.trim();
	if (!normalized) {
		return null;
	}
	for (const config of PLAN_CONFIGS) {
		if (config.priceId && config.priceId === normalized) {
			return config;
		}
	}
	return null;
}

export function getPlanConfig(tier: PlanTier): PlanConfig | null {
	return PLAN_CONFIGS.find((plan) => plan.tier === tier) ?? null;
}

export function getPlanConfigs(): PlanConfig[] {
	return PLAN_CONFIGS.slice();
}

export function getTrialPeriodDays(tier: PlanTier): number {
	const config = PLAN_CONFIGS.find((plan) => plan.tier === tier);
	return config?.trialDays ?? 0;
}
