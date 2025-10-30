// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from '../_shared/supabaseClient.ts';
import { ensureOrgContext } from '../_shared/userContext.ts';
import {
	ensureActiveSubscription,
	assertPlanAllowsFeature,
	assertUsageWithinLimit,
	recordUsageEvent,
	UsageLimitError
} from '../_shared/usageLimits.ts';

type SupabaseClientLike = {
    auth: {
        getUser: () => Promise<{ data: { user: { id: string; user_metadata?: Record<string, unknown> } | null }; error: unknown }>;
        admin?: {
            getUserById: (id: string) => Promise<{
                data: { user: { id: string; user_metadata?: Record<string, unknown> } | null };
                error: unknown;
            }>;
        };
    };
    from: (table: string) => any;
};

type Payload = {
	message: string;
	campaign?: { name?: string; objective?: string; landing_page_url?: string | null };
};

type ExtendedPayload = Payload & {
	user_id?: string;
	user?: { id: string; user_metadata?: Record<string, unknown> };
};

export interface ChatbotStubDeps {
	client: SupabaseClientLike;
	adminClient: SupabaseClientLike;
	random?: () => number;
	now?: () => Date;
}

type ConversationTurn = {
	role: 'assistant' | 'user';
	content: string;
	kind?: 'bubble' | 'card' | 'typing';
};

const PROMPTS = [
	"What’s your website or landing page for this campaign?",
	"Great! What audience or niche are you targeting?",
	"What follower range are you thinking?",
	"Any geography focus?",
	"All set — creating your campaign and seeding a few creators..."
];

export async function handleChatbotStub(req: Request, deps: ChatbotStubDeps): Promise<Response> {
	if (req.method !== 'POST') {
		return json({ error: 'Method not allowed' }, 405);
	}

	try {
		const payload = (await req.json()) as ExtendedPayload;
		const random = deps.random ?? Math.random;
		const nowFactory = deps.now ?? (() => new Date());
		console.log('chatbot-stub invoked');

		let effectiveUser = payload.user ?? null;

		if (!effectiveUser?.id && typeof payload.user_id === 'string' && payload.user_id.length) {
			console.log('chatbot-stub attempting admin lookup for user_id', payload.user_id);
			const { data, error } = (await deps.adminClient.auth?.admin?.getUserById?.(payload.user_id)) ?? {
				data: { user: null },
				error: null
			};

            if (!error && data?.user) {
                effectiveUser = data.user as typeof effectiveUser;
            }
        }

		if (!effectiveUser?.id) {
			console.log('chatbot-stub calling client.auth.getUser');
			const {
				data: { user },
				error
			} = await deps.client.auth.getUser();
			if (error || !user) {
				return json({ error: 'Unauthorized' }, 401);
			}
			console.log('chatbot-stub retrieved user from token', user.id);
			effectiveUser = user;
		}

		console.log('chatbot-stub ensuring org context for user', effectiveUser.id);
		const { orgId, userId } = await ensureOrgContext(
			deps.client as any,
			deps.adminClient as any,
			effectiveUser
		);

		console.log('chatbot-stub user context', { userId, orgId });

		console.log('chatbot-stub ensuring active subscription');
		const { subscription, planLimits } = await ensureActiveSubscription(deps.adminClient as any, userId);
		assertPlanAllowsFeature(planLimits, 'chat');
		await assertUsageWithinLimit(
			deps.adminClient as any,
			orgId,
			subscription,
			planLimits,
			'chat',
			{ now: nowFactory }
		);
		console.log('chatbot-stub usage ok', { userId, plan: subscription.plan });

		const turns: ConversationTurn[] = [
			{ role: 'assistant', content: PROMPTS[0], kind: 'bubble' },
			{ role: 'user', content: payload.message ?? '', kind: 'bubble' },
			{ role: 'assistant', content: PROMPTS[1], kind: 'bubble' },
			{ role: 'assistant', content: PROMPTS[4], kind: 'typing' }
		];

		const name = payload.campaign?.name?.trim() || 'New Launch';
		const objective = payload.campaign?.objective?.trim() || null;
		const landingPage = payload.campaign?.landing_page_url?.trim() || null;

		const { data: campaign, error: campaignError } = await deps.adminClient
			.from('campaigns')
			.insert({
				name,
				description: objective,
				objective,
				landing_page_url: landingPage,
				status: 'draft',
				created_by: userId,
				org_id: orgId
			})
			.select('id, name')
			.single();

		if (campaignError || !campaign) {
			throw campaignError ?? new Error('Failed to create campaign');
		}

		const seeds = [
			{ external_id: 'mock_ava', display_name: 'Ava Ramos', handle: '@ava.cooks', platform: 'instagram' },
			{ external_id: 'mock_jasper', display_name: 'Jasper Lee', handle: '@jasper.codes', platform: 'youtube' },
			{ external_id: 'mock_elena', display_name: 'Elena Ruiz', handle: '@elenaruizfit', platform: 'tiktok' },
			{ external_id: 'mock_mina', display_name: 'Mina Wong', handle: '@minawtravels', platform: 'instagram' }
		];

		const { data: existing } = await deps.adminClient
			.from('influencers')
			.select('id, external_id')
			.in('external_id', seeds.map((seed) => seed.external_id));

		const existingMap = new Map<string, string>();
		for (const row of existing ?? []) {
			if (row.external_id) {
				existingMap.set(row.external_id, row.id);
			}
		}

		const pending = seeds
			.filter((seed) => !existingMap.has(seed.external_id))
			.map((seed) => ({
				external_id: seed.external_id,
				display_name: seed.display_name,
				handle: seed.handle,
				platform: seed.platform,
				follower_count: Math.floor(random() * 200_000) + 50_000,
				engagement_rate: Math.round((random() * 6 + 2) * 10) / 10,
				location: 'United States',
				verticals: ['lifestyle'],
				languages: ['en'],
				created_at: nowFactory().toISOString(),
				updated_at: nowFactory().toISOString()
			}));

		if (pending.length) {
			const { data: inserted } = await deps.adminClient
				.from('influencers')
				.insert(pending)
				.select('id, external_id');

			for (const row of inserted ?? []) {
				if (row.external_id) {
					existingMap.set(row.external_id, row.id);
				}
			}
		}

		const influencerIds = seeds
			.map((seed) => existingMap.get(seed.external_id))
			.filter((id): id is string => Boolean(id));

		if (influencerIds.length) {
			await deps.adminClient.from('campaign_influencers').insert(
				influencerIds.map((id) => ({
					campaign_id: campaign.id,
					influencer_id: id,
					status: 'prospect',
					source: 'chatbot_seed',
					match_score: Math.floor(random() * 15 + 70)
				}))
			);
		}

		turns.push({
			role: 'assistant',
			kind: 'card',
			content: `Your campaign **${campaign.name}** is ready. Open outreach: /campaign/${campaign.id}/outreach`
		});

		const baseTime = nowFactory();
		const conversation = turns.map((turn, idx) => ({
			...turn,
			created_at: new Date(baseTime.getTime() + idx * 1000).toISOString()
		}));

		await recordUsageEvent(deps.adminClient as any, orgId, 'chat', { now: nowFactory });

		console.log('chatbot-stub completed', { userId, campaignId: campaign.id });
		return json({ conversation, campaign_id: campaign.id });
	} catch (err) {
		if (err instanceof UsageLimitError) {
			const status = err.code === 'USAGE_LIMIT_REACHED' ? 429 : 403;
			return json({ error: err.message }, status);
		}

		console.error('chatbot-stub error', err);
		return json({ error: 'Internal server error' }, 500);
	}
}

function json(payload: unknown, status = 200) {
	return new Response(JSON.stringify(payload), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		status
	});
}
