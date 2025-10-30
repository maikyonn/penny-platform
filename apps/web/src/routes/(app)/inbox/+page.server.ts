import { fail, redirect } from '@sveltejs/kit';
import { loadUserContext } from '$lib/server/user-context';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { session, profile } = await loadUserContext(locals);
	if (!session) {
		throw redirect(303, '/sign-in');
	}

	const { data: campaigns } = await locals.supabase
		.from('campaigns')
		.select('id, name')
		.eq('created_by', session.user.id)
		.order('created_at', { ascending: false });

	const campaignList = (campaigns ?? []) as Array<any>;
	const campaignIds = campaignList.map((campaign) => campaign.id);

	const { data: threads } = campaignIds.length
		? await locals.supabase
			.from('outreach_threads')
			.select('id, channel, last_message_at, campaign_influencer_id, campaign_influencers(status, campaign_id, influencers(display_name, handle))')
			.in('campaign_influencers.campaign_id', campaignIds)
			.order('last_message_at', { ascending: false })
			.limit(20)
		: { data: [] };

	const threadList = (threads ?? []) as Array<any>;
	const threadIds = threadList.map((thread) => thread.id);

	const { data: messages } = threadIds.length
		? await locals.supabase
			.from('outreach_messages')
			.select('thread_id, direction, body, sent_at')
			.in('thread_id', threadIds)
			.order('sent_at')
		: { data: [] };

	const messageList = (messages ?? []) as Array<any>;

	const inboxThreads = threadList.map((thread) => ({
		id: thread.id,
		channel: thread.channel,
		last_message_at: thread.last_message_at,
		campaign_influencer_id: thread.campaign_influencer_id,
		status: thread.campaign_influencers?.status ?? 'prospect',
		campaign_id: thread.campaign_influencers?.campaign_id ?? null,
		influencer: thread.campaign_influencers?.influencers ?? null,
		messages: messageList.filter((message) => message.thread_id === thread.id),
	}));

	return {
		threads: inboxThreads,
		campaigns: campaignList,
		profile,
	};
};

export const actions: Actions = {
	sendMessage: async ({ request, locals }) => {
		const { session } = await loadUserContext(locals);
		if (!session) {
			throw redirect(303, '/sign-in');
		}

		const formData = await request.formData();
		const assignmentId = String(formData.get('campaign_influencer_id') ?? '').trim();
		const messageBody = String(formData.get('message') ?? '').trim();
		const channel = String(formData.get('channel') ?? '').trim() || undefined;

		if (!assignmentId || !messageBody) {
			return fail(400, { error: 'Type a message before sending.' });
		}

		const { error } = await locals.supabase.functions.invoke('outreach-send', {
			body: {
				campaign_influencer_id: assignmentId,
				message: messageBody,
				channel,
			},
			headers: {
				Authorization: `Bearer ${session.access_token}`,
			},
		});

		if (error) {
			console.error('[inbox action] outreach-send error', error);
			return fail(500, { error: 'Unable to send that message right now. Please try again.' });
		}

		return { success: true };
	},
};
