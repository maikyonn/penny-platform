import { fail, redirect } from '@sveltejs/kit';
import { CHATBOT_STUB_MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from '$env/static/private';
import { loadUserContext } from '$lib/server/user-context';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { session } = await loadUserContext(locals);
	if (!session) {
		throw redirect(303, '/sign-in');
	}

	return { session };
};

export const actions: Actions = {
	send: async ({ request, locals }) => {
		const { session } = await loadUserContext(locals);
		if (!session) {
			throw redirect(303, '/sign-in');
		}

		const formData = await request.formData();
		const message = String(formData.get('message') ?? '').trim();

		if (!message) {
			return fail(400, { error: 'Message cannot be empty.' });
		}

		const name = String(formData.get('name') ?? '').trim() || 'New Launch';
		const objective = String(formData.get('objective') ?? '').trim() || null;
		const landing_page_url = String(formData.get('landing_page_url') ?? '').trim() || null;

		if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
			console.error('[chatbot action] missing Supabase configuration');
			return fail(500, { error: 'Supabase configuration missing. Please contact support.' });
		}

		if (CHATBOT_STUB_MODE === '1') {
			const jwt = session.access_token;
			console.info('[chatbot action] stub mode active', jwt ? `jwt=${jwt.slice(0, 16)}…` : '(no jwt)');
			const nowIso = new Date().toISOString();
			return {
				success: true,
				conversation: [
					{ role: 'assistant', kind: 'bubble', content: 'Tell me about your campaign.', created_at: nowIso },
					{ role: 'user', kind: 'bubble', content: message, created_at: nowIso },
					{ role: 'assistant', kind: 'card', content: `Your campaign **${name}** is ready. Open outreach: /campaign/cmp_stub/outreach`, created_at: nowIso }
				],
				campaign_id: 'cmp_stub',
				debug: {
					jwt
				}
			};
		}

		console.info('[chatbot action] invoking edge function', {
			jwt: session.access_token?.slice(0, 16)
		});

		console.info('[chatbot action] calling supabase function', {
			jwt: session.access_token?.slice(0, 16) ?? null,
			user: session.user.id
		});

		const response = await fetch(`${SUPABASE_URL}/functions/v1/chatbot-stub`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${session.access_token}`,
				'apikey': SUPABASE_ANON_KEY,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				message,
				user_id: session.user.id,
				campaign: { name, objective, landing_page_url }
			})
		});

		if (!response.ok) {
			const text = await response.text();
			console.error('[chatbot action] chatbot-stub http error', response.status, text);
			return fail(500, { error: 'Unable to process that message. Please try again.' });
		}

		const data = (await response.json()) as Record<string, unknown> | null;

		if (!data || !('campaign_id' in data)) {
			return fail(500, { error: 'Assistant could not create a campaign. Please try again.' });
		}

		return {
			success: true,
			conversation: data.conversation ?? [],
			campaign_id: data.campaign_id
		};
	}
};
