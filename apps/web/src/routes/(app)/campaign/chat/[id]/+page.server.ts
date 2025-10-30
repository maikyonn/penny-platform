import { error, fail, redirect } from '@sveltejs/kit';
import { loadUserContext } from '$lib/server/user-context';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { session } = await loadUserContext(locals);
	if (!session) {
		throw redirect(303, '/sign-in');
	}

	const campaignId = params.id;

	const { data: campaign, error: campaignError } = await locals.supabase
		.from('campaigns')
		.select('id, name, created_by')
		.eq('id', campaignId)
		.maybeSingle();

	if (campaignError) {
		console.error('[campaign chat] campaignError', campaignError);
	}

	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	if (campaign.created_by !== session.user.id) {
		throw error(403, 'Forbidden');
	}

	const mockBaseUrl = process.env.MOCK_CHAT_BASE_URL ?? 'http://localhost:9000';

	const adaptConversation = (conversation: Array<{ role: string; content: string; kind?: string }>) => {
		const now = Date.now();
		return conversation.map((turn, index) => ({
			role: turn.role === 'assistant' ? 'assistant' : 'user',
			content: turn.content,
			kind: turn.kind ?? 'bubble',
			created_at: new Date(now - (conversation.length - index) * 1000).toISOString(),
		}));
	};

	try {
		const response = await fetch(`${mockBaseUrl}/conversation`, {
			headers: { accept: 'application/json' },
			cache: 'no-store',
		});

		if (response.ok) {
			const conversation = (await response.json()) as Array<{ role: string; content: string; kind?: string }>;
			return {
				campaign,
				sessionId: null,
				messages: adaptConversation(conversation),
				mockChatActive: true,
			};
		}
	} catch (mockError) {
		console.warn('[campaign chat] mock conversation unavailable, falling back to Supabase', mockError);
	}

	const { data: sessionRow } = await locals.supabase
		.from('chat_sessions')
		.select('id')
		.eq('campaign_id', campaign.id)
		.eq('topic', 'support')
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	const sessionId = sessionRow?.id ?? null;

	const { data: messages } = sessionId
		? await locals.supabase
			.from('chat_messages')
			.select('role, content, created_at')
			.eq('session_id', sessionId)
			.order('created_at')
		: { data: [] as Array<{ role: string; content: string; created_at: string }> };

	return {
		campaign,
		sessionId,
		messages: (messages ?? []).map((message) => ({
			role: message.role,
			content: message.content,
			created_at: message.created_at,
			kind: 'bubble',
		})),
		mockChatActive: false,
	};
};

export const actions: Actions = {
	send: async ({ request, locals, params }) => {
		const { session } = await loadUserContext(locals);
		if (!session) {
			throw redirect(303, '/sign-in');
		}

		const formData = await request.formData();
		const message = String(formData.get('message') ?? '').trim();

		if (!message) {
			return fail(400, { error: 'Type a message to continue the briefing.' });
		}

		const mockBaseUrl = process.env.MOCK_CHAT_BASE_URL ?? 'http://localhost:9000';

		const adaptConversation = (conversation: Array<{ role: string; content: string; kind?: string }>) => {
			const now = Date.now();
			return conversation.map((turn, index) => ({
				role: turn.role === 'assistant' ? 'assistant' : 'user',
				content: turn.content,
				kind: turn.kind ?? 'bubble',
				created_at: new Date(now - (conversation.length - index) * 1000).toISOString(),
			}));
		};

		try {
			const response = await fetch(`${mockBaseUrl}/message`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					accept: 'application/json',
				},
				body: JSON.stringify({ message }),
			});

			if (response.ok) {
				const payload = await response.json() as {
					reply: string;
					kind?: string;
					done?: boolean;
					conversation?: Array<{ role: string; content: string; kind?: string }>;
				};

				return {
					success: true,
					mockChat: true,
					done: payload.done ?? false,
					conversation: payload.conversation ? adaptConversation(payload.conversation) : null,
				};
			}
		} catch (mockError) {
			console.warn('[campaign chat] mock server invocation failed, falling back to Supabase', mockError);
		}

		const { data, error: invokeError } = await locals.supabase.functions.invoke('support-ai-router', {
			body: {
				campaign_id: params.id,
				message,
			},
			headers: {
				Authorization: `Bearer ${session.access_token}`,
			},
		});

		if (invokeError) {
			console.error('[campaign chat] support-ai-router error', invokeError);
			return fail(500, { error: 'We could not process that message. Please try again.' });
		}

		return {
			success: true,
			mockChat: false,
			session_id: data?.session_id ?? null,
		};
	},
};
