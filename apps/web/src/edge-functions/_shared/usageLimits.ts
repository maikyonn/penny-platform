import type { Database } from '../../lib/database.types.ts';

type PlanTier = Database['public']['Enums']['plan_tier'];

type SupabaseQueryBuilder = {
	select: (columns: string, options?: Record<string, unknown>) => any;
	insert?: (values: unknown) => any;
	update?: (values: unknown) => any;
	maybeSingle?: () => Promise<{ data: any; error: any }>;
};

type SupabaseLike = {
	from: (table: string) => SupabaseQueryBuilder;
};

export type UsageMetric = 'chat' | 'search';

type PlanUsageLimits = {
	allowMessaging: boolean;
	allowChat: boolean;
	allowSearch: boolean;
	chatLimit: number | null;
	searchLimit: number | null;
};

const PLAN_USAGE_LIMITS: Record<PlanTier, PlanUsageLimits> = {
	free: {
		allowMessaging: false,
		allowChat: false,
		allowSearch: false,
		chatLimit: 0,
		searchLimit: 0
	},
	starter: {
		allowMessaging: true,
		allowChat: true,
		allowSearch: true,
		chatLimit: 25,
		searchLimit: 10
	},
	pro: {
		allowMessaging: true,
		allowChat: true,
		allowSearch: true,
		chatLimit: 250,
		searchLimit: 100
	},
	enterprise: {
		allowMessaging: true,
		allowChat: true,
		allowSearch: true,
		chatLimit: null,
		searchLimit: null
	}
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

const METRIC_TO_KEY: Record<UsageMetric, { usageMetric: string; limitKey: 'chatLimit' | 'searchLimit' }> = {
	chat: { usageMetric: 'chat_message', limitKey: 'chatLimit' },
	search: { usageMetric: 'search_request', limitKey: 'searchLimit' }
};

export class UsageLimitError extends Error {
	constructor(
		public readonly code: 'SUBSCRIPTION_REQUIRED' | 'PLAN_UPGRADE_REQUIRED' | 'USAGE_LIMIT_REACHED',
		message: string
	) {
		super(message);
		this.name = 'UsageLimitError';
	}
}

export async function ensureActiveSubscription(
	adminClient: SupabaseLike,
	userId: string
): Promise<{
	subscription: Pick<Database['public']['Tables']['subscriptions']['Row'], 'plan' | 'status' | 'current_period_end'>;
	planLimits: PlanUsageLimits;
}> {
	const { data: subscription, error } = await adminClient
		.from('subscriptions')
		.select('plan,status,current_period_end')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) {
		throw error;
	}

	const typedSubscription = subscription as
		| Pick<Database['public']['Tables']['subscriptions']['Row'], 'plan' | 'status' | 'current_period_end'>
		| null;

	if (!typedSubscription || !ACTIVE_SUBSCRIPTION_STATUSES.has((typedSubscription.status ?? '').toLowerCase())) {
		throw new UsageLimitError(
			'SUBSCRIPTION_REQUIRED',
			'An active subscription is required to perform this action.'
		);
	}

	const planLimits = PLAN_USAGE_LIMITS[typedSubscription.plan as PlanTier];

	if (!planLimits) {
		throw new UsageLimitError(
			'PLAN_UPGRADE_REQUIRED',
			'Your current subscription does not support this feature.'
		);
	}

	return { subscription: typedSubscription, planLimits };
}

export function assertPlanAllowsFeature(planLimits: PlanUsageLimits, metric: UsageMetric | 'messaging'): void {
	if (metric === 'messaging' && !planLimits.allowMessaging) {
		throw new UsageLimitError(
			'PLAN_UPGRADE_REQUIRED',
			'Your current subscription does not include messaging.'
		);
	}

	if (metric === 'chat' && !planLimits.allowChat) {
		throw new UsageLimitError(
			'PLAN_UPGRADE_REQUIRED',
			'Your current subscription does not include chat.'
		);
	}

	if (metric === 'search' && !planLimits.allowSearch) {
		throw new UsageLimitError(
			'PLAN_UPGRADE_REQUIRED',
			'Your current subscription does not include creator search.'
		);
	}
}

export async function assertUsageWithinLimit(
	adminClient: SupabaseLike,
	orgId: string,
	subscription: Pick<Database['public']['Tables']['subscriptions']['Row'], 'current_period_end'>,
	planLimits: PlanUsageLimits,
	metric: UsageMetric,
	options: { now?: () => Date } = {}
): Promise<void> {
	const limitKey = METRIC_TO_KEY[metric].limitKey;
	const limitValue = planLimits[limitKey];
	if (limitValue === null) {
		return;
	}

	const now = options.now?.() ?? new Date();
	const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
	const periodStart = computePeriodStart(now, periodEnd);

	const usageQuery = (adminClient as any)
		.from('usage_logs')
		.select('id', { count: 'exact', head: true })
		.eq('org_id', orgId)
		.eq('metric', METRIC_TO_KEY[metric].usageMetric)
		.gte('recorded_at', periodStart.toISOString());

	const { count, error } = await usageQuery;

	if (error) {
		throw error;
	}

	if (typeof count === 'number' && count >= limitValue) {
		throw new UsageLimitError(
			'USAGE_LIMIT_REACHED',
			'You have reached the limit for this feature in the current billing period.'
		);
	}
}

export async function recordUsageEvent(
	adminClient: SupabaseLike,
	orgId: string,
	metric: UsageMetric,
	options: { now?: () => Date } = {}
): Promise<void> {
	const mapper = METRIC_TO_KEY[metric];
	const now = options.now?.() ?? new Date();
	const { error } = await (adminClient as any)
		.from('usage_logs')
		.insert({
			org_id: orgId,
			metric: mapper.usageMetric,
			quantity: 1,
			recorded_at: now.toISOString()
		});

	if (error) {
		throw error;
	}
}

function computePeriodStart(now: Date, periodEnd: Date | null): Date {
	if (periodEnd && periodEnd.getTime() > now.getTime()) {
		// Assume monthly billing cycle; subtract 30 days from the current period end.
		return new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
	}
	return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}
