import { error, fail, redirect } from '@sveltejs/kit';
import { loadUserContext } from '$lib/server/user-context';
import { seedMockInfluencersForCampaign } from '$lib/server/mock-influencers';
import type { Database } from '$lib/database.types';
import type { Actions, PageServerLoad } from './$types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type CampaignRow = Database['public']['Tables']['campaigns']['Row'];
type CampaignTargetRow = Database['public']['Tables']['campaign_targets']['Row'];
type InfluencerRow = Database['public']['Tables']['influencers']['Row'];
type CampaignInfluencerRow = Pick<
	Database['public']['Tables']['campaign_influencers']['Row'],
	'id' | 'status' | 'source' | 'match_score' | 'last_message_at'
> & {
	influencers: Array<
		Pick<
			InfluencerRow,
			'id' | 'display_name' | 'handle' | 'platform' | 'follower_count' | 'engagement_rate' | 'location'
		>
	> | null;
};
type OutreachThreadRow = Database['public']['Tables']['outreach_threads']['Row'];
type OutreachMessageRow = Database['public']['Tables']['outreach_messages']['Row'];
type CampaignMetricRow = Database['public']['Tables']['campaign_metrics']['Row'];

export const load: PageServerLoad = async ({ locals, params }) => {
	const { session } = await loadUserContext(locals);
	if (!session) {
		throw redirect(303, '/sign-in');
	}

	const campaignId = params.id;

	const { data: campaignData, error: campaignError } = await locals.supabase
		.from('campaigns')
		.select('id, name, status, objective, budget_cents, currency, landing_page_url, start_date, end_date, created_at, updated_at, created_by')
		.eq('id', campaignId)
		.maybeSingle();

	const campaign = campaignData as CampaignRow | null;

	if (campaignError) {
		console.error('[campaign detail] campaignError', campaignError);
	}

	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	if (campaign.created_by !== session.user.id) {
		throw error(403, 'Forbidden');
	}

	const targetsPromise = locals.supabase
		.from('campaign_targets')
		.select('id, platforms, interests, geos, audience')
		.eq('campaign_id', campaign.id);

	const fetchAssignments = () =>
		locals.supabase
			.from('campaign_influencers')
			.select('id, status, source, match_score, last_message_at, influencers(id, display_name, handle, platform, follower_count, engagement_rate, location)')
			.eq('campaign_id', campaign.id)
			.order('created_at', { ascending: false });

	let { data: assignmentData } = await fetchAssignments();
	let assignmentList = (assignmentData ?? []) as CampaignInfluencerRow[];

	if (!assignmentList.length) {
		try {
			await seedMockInfluencersForCampaign(campaign.id, 6);
			const { data: refreshedAssignments } = await fetchAssignments();
			assignmentList = (refreshedAssignments ?? []) as CampaignInfluencerRow[];
		} catch (seedError) {
			console.error('[campaign detail] mock influencer seed error', seedError);
		}
	}

	const { data: targetsData } = await targetsPromise;
	const targets = (targetsData ?? []) as CampaignTargetRow[];

	const assignmentIds = assignmentList.map((assignment) => assignment.id);

	const { data: threadsData } = assignmentIds.length
		? await locals.supabase
			.from('outreach_threads')
			.select('id, campaign_influencer_id, channel, last_message_at')
			.in('campaign_influencer_id', assignmentIds)
		: { data: [] };

	const threadList = (threadsData ?? []) as OutreachThreadRow[];
	const threadIds = threadList.map((thread) => thread.id);

	const { data: messagesData } = threadIds.length
		? await locals.supabase
			.from('outreach_messages')
			.select('thread_id, direction, body, sent_at')
			.in('thread_id', threadIds)
			.order('sent_at')
		: { data: [] };
	const messages = (messagesData ?? []) as OutreachMessageRow[];

	const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
	const { data: metricsData } = await locals.supabase
		.from('campaign_metrics')
		.select('metric_date, impressions, clicks, conversions, spend_cents')
		.eq('campaign_id', campaign.id)
		.gte('metric_date', since)
		.order('metric_date');
	const metrics = (metricsData ?? []) as CampaignMetricRow[];

	const influencerAssignments = assignmentList.map((assignment) => {
		const thread = threadList.find((row) => row.campaign_influencer_id === assignment.id) ?? null;
		const conversation = messages
			.filter((message) => message.thread_id === thread?.id)
			.map((message) => ({
				direction: message.direction,
				body: message.body,
				sent_at: message.sent_at,
			}));

	return {
		id: assignment.id,
		status: assignment.status,
		source: assignment.source,
		match_score: assignment.match_score,
		last_message_at: assignment.last_message_at,
		influencer: assignment.influencers?.[0] ?? null,
		thread,
		messages: conversation,
	};
	});

	const statusSummary = influencerAssignments.reduce(
		(acc, assignment) => {
			acc.total += 1;
			if (assignment.status in acc.byStatus) {
				acc.byStatus[assignment.status as keyof typeof acc.byStatus] += 1;
			}
			return acc;
		},
		{
			total: 0,
			byStatus: {
				prospect: 0,
				invited: 0,
				accepted: 0,
				declined: 0,
				in_conversation: 0,
				contracted: 0,
				completed: 0,
			},
		},
	);

	return {
		campaign,
		targets,
		assignments: influencerAssignments,
		metrics,
		statusSummary,
	};
};

export const actions: Actions = {
	sendMessage: async ({ request, locals, params }) => {
		const { session } = await loadUserContext(locals);
		if (!session) {
			throw redirect(303, '/sign-in');
		}

		const formData = await request.formData();
		const assignmentId = String(formData.get('campaign_influencer_id') ?? '').trim();
		const messageBody = String(formData.get('message') ?? '').trim();
		const channel = String(formData.get('channel') ?? '').trim() || undefined;

		if (!assignmentId || !messageBody) {
			return fail(400, { error: 'Write a message before sending.' });
		}

		const { error: invokeError } = await locals.supabase.functions.invoke('outreach-send', {
			body: {
				campaign_influencer_id: assignmentId,
				message: messageBody,
				channel,
			},
			headers: {
				Authorization: `Bearer ${session.access_token}`,
			},
		});

		if (invokeError) {
			console.error('[campaign detail] outreach-send error', invokeError);
			return fail(500, { error: 'We could not send that message. Please try again.' });
		}

		return { success: true, campaignId: params.id };
	},
};
