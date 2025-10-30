// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from '../_shared/supabaseClient.ts';

type SupabaseClientLike = {
	auth: {
		getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
	};
	from: (table: string) => any;
};

type DraftPayload = {
	campaign_id: string;
	influencer_ids?: string[];
	tone?: 'friendly' | 'professional' | 'playful';
	subject_template?: string;
};

export interface AIDraftDeps {
	client: SupabaseClientLike;
}

export async function handleAIDraftOutreach(req: Request, deps: AIDraftDeps): Promise<Response> {
	if (req.method !== 'POST') {
		return json({ error: 'Method not allowed' }, 405);
	}

	try {
		const payload = (await req.json()) as DraftPayload;
		if (!payload?.campaign_id) {
			return json({ error: 'campaign_id required' }, 400);
		}

		const {
			data: { user },
			error
		} = await deps.client.auth.getUser();

		if (error || !user) {
			return json({ error: 'Unauthorized' }, 401);
		}

		const { data: campaign } = await deps.client
			.from('campaigns')
			.select('id, created_by, name')
			.eq('id', payload.campaign_id)
			.maybeSingle();

		if (!campaign || campaign.created_by !== user.id) {
			return json({ error: 'Forbidden' }, 403);
		}

		let influencerIds = payload.influencer_ids ?? [];
		if (!influencerIds.length) {
			const { data: assignments } = await deps.client
				.from('campaign_influencers')
				.select('influencer_id')
				.eq('campaign_id', campaign.id);
			influencerIds = (assignments ?? []).map((row: { influencer_id: string }) => row.influencer_id);
		}

		if (!influencerIds.length) {
			return json({ error: 'No influencers found for campaign' }, 400);
		}

		const { data: influencers } = await deps.client
			.from('influencers')
			.select('id, display_name, verticals')
			.in('id', influencerIds);

		const tone = payload.tone ?? 'friendly';
		const subjectTemplate = payload.subject_template ?? 'Quick collab idea for {{campaign}}';

		const drafts = (influencers ?? []).map((influencer: any) => ({
			campaign_id: campaign.id,
			influencer_id: influencer.id,
			created_by: user.id,
			rationale: `draft_${tone}`,
			metadata: {
				subject: subjectTemplate.replace(/\{\{\s*campaign\s*\}\}/g, campaign.name),
				body: buildBody(tone, influencer.display_name ?? 'there', campaign.name, (influencer.verticals ?? [])[0] ?? 'your audience')
			}
		}));

		if (drafts.length) {
			await deps.client.from('ai_recommendations').insert(drafts);
		}

		return json({ ok: true, count: drafts.length });
	} catch (err) {
		console.error('ai-draft-outreach error', err);
		return json({ error: 'Internal server error' }, 500);
	}
}

function buildBody(
	tone: 'friendly' | 'professional' | 'playful',
	name: string,
	campaign: string,
	niche: string
) {
	const greeting =
		tone === 'professional' ? `Hi ${name},` :
		tone === 'playful' ? `Hey ${name}!` : `Hello ${name},`;
	const pitch =
		tone === 'professional'
			? `We’re exploring a collaboration around ${campaign}. Your ${niche} content really stands out to our team.`
			: tone === 'playful'
				? `We’ve got a fun idea for ${campaign} and your ${niche} vibe feels spot on.`
				: `We’re working on ${campaign} and thought your ${niche} content could be the perfect fit.`;

	return `${greeting}\n\n${pitch}\n\nWould you be open to a quick chat?\n\nBest,\nPenny Team`;
}

function json(payload: unknown, status = 200) {
	return new Response(JSON.stringify(payload), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		status
	});
}
