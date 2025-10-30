import { corsHeaders, maybeHandleCors } from '../_shared/supabaseClient.ts';
import type { TablesInsert } from '../../lib/database.types.ts';

type SupabaseLike = {
	auth: {
		getUser: () => Promise<{ data: { user: { id: string; user_metadata?: Record<string, unknown> } | null }; error: unknown }>;
	};
	from: (table: string) => any;
};

type CampaignPayload = {
	name?: string;
	description?: string;
	objective?: string;
	budget_cents?: number | null;
	currency?: string | null;
	landing_page_url?: string | null;
	start_date?: string | null;
	end_date?: string | null;
	targets?: TablesInsert<'campaign_targets'>[];
};

export interface CampaignCreateDeps {
	client: SupabaseLike;
	adminClient: SupabaseLike;
	maybeHandleCors?: (req: Request) => Response | null;
}

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(payload), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		status: init.status ?? 200
	});
}

export async function handleCampaignCreate(req: Request, deps: CampaignCreateDeps) {
	const handleCors = deps.maybeHandleCors ?? maybeHandleCors;
	const cors = handleCors(req);
	if (cors) return cors;

	if (req.method !== 'POST') {
		return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
	}

	let body: CampaignPayload;

	try {
		body = (await req.json()) as CampaignPayload;
	} catch (err) {
		return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body?.name) {
		return jsonResponse({ error: 'name is required' }, { status: 400 });
	}

	const {
		data: { user },
		error: userError
	} = await deps.client.auth.getUser();

	if (userError || !user) {
		return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
	}

	const { data: profile } = await deps.client
		.from('profiles')
		.select('user_id, current_org')
		.eq('user_id', user.id)
		.maybeSingle();

	if (!profile) {
		const { error: profileInsertError } = await deps.adminClient
			.from('profiles')
			.upsert(
				{
					user_id: user.id,
					full_name: user.user_metadata?.full_name ?? null,
					avatar_url: user.user_metadata?.avatar_url ?? null
				},
				{ onConflict: 'user_id', returning: 'minimal' }
				);

		if (profileInsertError) {
			throw profileInsertError;
		}
	}

	const orgId = (profile as { current_org?: string | null } | null)?.current_org ?? user.id;

	const insertPayload: TablesInsert<'campaigns'> = {
		// Supabase generated types currently expect `user_id`; map current org/user there.
		user_id: orgId,
		created_by: user.id,
		name: body.name,
		description: body.description ?? null,
		objective: body.objective ?? null,
		budget_cents: body.budget_cents ?? null,
		currency: body.currency ?? 'USD',
		landing_page_url: body.landing_page_url ?? null,
		start_date: body.start_date ?? null,
		end_date: body.end_date ?? null
	};

	const { data: campaign, error: campaignError } = await deps.client
		.from('campaigns')
		.insert(insertPayload)
		.select('*')
		.single();

	if (campaignError) {
		throw campaignError;
	}

	if (body.targets?.length) {
		const targets = body.targets.map((target) => ({
			...target,
			campaign_id: campaign.id
		}));

		const { error: targetError } = await deps.client.from('campaign_targets').insert(targets);
		if (targetError) {
			throw targetError;
		}
	}

	return jsonResponse({ success: true, campaign });
}
