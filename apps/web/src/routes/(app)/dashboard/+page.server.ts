import { redirect } from '@sveltejs/kit';
import { loadUserContext } from '$lib/server/user-context';
import type { PageServerLoad } from './$types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async ({ locals }) => {
	const { session, profile } = await loadUserContext(locals);
	if (!session) {
		throw redirect(303, '/sign-in');
	}

	const { data: campaigns, error: campaignsError } = await locals.supabase
		.from('campaigns')
		.select('id, name, status, objective, created_at, start_date, end_date')
		.eq('created_by', session.user.id)
		.order('created_at', { ascending: false });

	if (campaignsError) {
		console.error('[dashboard] campaignsError', campaignsError);
		return {
			session,
			profile,
			campaigns: [],
			campaignCounts: { total: 0, active: 0, draft: 0, completed: 0 },
			influencerSummary: { total: 0, invited: 0, accepted: 0, in_conversation: 0, completed: 0 },
			metricsSummary: { impressions: 0, clicks: 0, conversions: 0, spend_cents: 0 },
			error: 'We could not load campaigns yet. Please try again in a moment.'
		};
	}

	const campaignList = campaigns ?? [];
	const campaignIds = campaignList.map((campaign) => campaign.id);

	const campaignCounts = {
		total: campaignList.length,
		active: campaignList.filter((campaign) => campaign.status === 'active').length,
		draft: campaignList.filter((campaign) => campaign.status === 'draft').length,
		completed: campaignList.filter((campaign) => campaign.status === 'completed').length,
	};

	const metricsSummary = { impressions: 0, clicks: 0, conversions: 0, spend_cents: 0 };

	if (campaignIds.length) {
		const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
		const { data: metrics, error: metricsError } = await locals.supabase
			.from('campaign_metrics')
			.select('campaign_id, impressions, clicks, conversions, spend_cents')
			.in('campaign_id', campaignIds)
			.gte('metric_date', since);

		if (metricsError) {
			console.error('[dashboard] metricsError', metricsError);
		} else {
			for (const row of metrics ?? []) {
				metricsSummary.impressions += Number(row.impressions ?? 0);
				metricsSummary.clicks += Number(row.clicks ?? 0);
				metricsSummary.conversions += Number(row.conversions ?? 0);
				metricsSummary.spend_cents += Number(row.spend_cents ?? 0);
			}
		}
	}

	const influencerSummary = {
		total: 0,
		invited: 0,
		accepted: 0,
		in_conversation: 0,
		completed: 0,
	};

	if (campaignIds.length) {
		const { data: influencerRows, error: influencersError } = await locals.supabase
			.from('campaign_influencers')
			.select('status')
			.in('campaign_id', campaignIds);

		if (influencersError) {
			console.error('[dashboard] influencersError', influencersError);
		} else {
			for (const row of influencerRows ?? []) {
				influencerSummary.total += 1;
				switch (row.status) {
					case 'invited':
						influencerSummary.invited += 1;
						break;
					case 'accepted':
						influencerSummary.accepted += 1;
						break;
					case 'in_conversation':
						influencerSummary.in_conversation += 1;
						break;
					case 'completed':
						influencerSummary.completed += 1;
						break;
					default:
						break;
				}
			}
		}
	}

	return {
		session,
		profile,
		campaigns: campaignList,
		campaignCounts,
		influencerSummary,
		metricsSummary,
	};
};
