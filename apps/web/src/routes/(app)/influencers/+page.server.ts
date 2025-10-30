import { fail, redirect } from '@sveltejs/kit';
import { loadUserContext } from '$lib/server/user-context';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { session, profile } = await loadUserContext(locals);
	if (!session) {
		throw redirect(303, '/sign-in');
	}

	const [{ data: campaigns }, { data: influencers }] = await Promise.all([
		locals.supabase
			.from('campaigns')
			.select('id, name, status')
			.eq('created_by', session.user.id)
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('influencers')
			.select('id, display_name, handle, platform, follower_count, engagement_rate, location, verticals')
			.order('follower_count', { ascending: false })
			.limit(50),
	]);

	return {
		profile,
		campaigns: campaigns ?? [],
		influencers: influencers ?? [],
	};
};

export const actions: Actions = {
	assign: async ({ request, locals }) => {
		const { session } = await loadUserContext(locals);
		if (!session) {
			throw redirect(303, '/sign-in');
		}

		const formData = await request.formData();
		const campaignId = String(formData.get('campaign_id') ?? '').trim();
		const influencerId = String(formData.get('influencer_id') ?? '').trim();

		if (!campaignId || !influencerId) {
			return fail(400, { error: 'Pick a campaign before adding an influencer.' });
		}

		const { data: campaign } = await locals.supabase
			.from('campaigns')
			.select('id, created_by')
			.eq('id', campaignId)
			.maybeSingle();

		if (!campaign || campaign.created_by !== session.user.id) {
			return fail(403, { error: 'You can only add creators to your own campaigns.' });
		}

		const { data: existing } = await locals.supabase
			.from('campaign_influencers')
			.select('id')
			.eq('campaign_id', campaignId)
			.eq('influencer_id', influencerId)
			.maybeSingle();

		if (existing) {
			return fail(400, { error: 'That creator is already linked to this campaign.' });
		}

		const { error } = await locals.supabase
			.from('campaign_influencers')
			.insert({
				campaign_id: campaignId,
				influencer_id: influencerId,
				source: 'manual',
			});

		if (error) {
			console.error('[influencers action] assign error', error);
			return fail(500, { error: 'We could not add that creator just yet. Please try again.' });
		}

		return { success: true };
	},
};
