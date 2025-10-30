// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from '../_shared/supabaseClient.ts';
import { ensureActiveSubscription, assertPlanAllowsFeature, UsageLimitError } from '../_shared/usageLimits.ts';

type SupabaseClientLike = {
	auth: {
		getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
	};
	from: (table: string) => any;
};

type SendItem = {
	campaign_influencer_id: string;
	to: string;
	subject: string;
	body: string;
};

type SendPayload = {
	campaign_id: string;
	items: SendItem[];
};

export interface GmailSendDeps {
	client: SupabaseClientLike;
	adminClient: SupabaseClientLike;
	env?: { gmailStub?: boolean };
}

export async function handleGmailSend(req: Request, deps: GmailSendDeps): Promise<Response> {
	if (req.method !== 'POST') {
		return json({ error: 'Method not allowed' }, 405);
	}

	try {
		const payload = (await req.json()) as SendPayload;
		if (!payload?.campaign_id || !Array.isArray(payload.items) || !payload.items.length) {
			return json({ error: 'campaign_id and items[] required' }, 400);
		}

		const {
			data: { user },
			error
		} = await deps.client.auth.getUser();

		if (error || !user) {
			return json({ error: 'Unauthorized' }, 401);
		}

		const { planLimits } = await ensureActiveSubscription(deps.adminClient as any, user.id);
		assertPlanAllowsFeature(planLimits, 'messaging');

		const { data: campaign } = await deps.client
			.from('campaigns')
			.select('id, created_by')
			.eq('id', payload.campaign_id)
			.maybeSingle();

		if (!campaign || campaign.created_by !== user.id) {
			return json({ error: 'Forbidden' }, 403);
		}

		const stubMode = deps.env?.gmailStub ?? false;
		const { data: account } = await deps.client
			.from('gmail_accounts')
			.select('email, access_token')
			.eq('user_id', user.id)
			.maybeSingle();

		let sent = 0;
		const failed: { id: string; error: string }[] = [];

		for (const item of payload.items) {
			try {
				const { data: assignment } = await deps.client
					.from('campaign_influencers')
					.select('id, campaign_id')
					.eq('id', item.campaign_influencer_id)
					.maybeSingle();

				if (!assignment || assignment.campaign_id !== campaign.id) {
					throw new Error('Assignment mismatch');
				}

				const threadId = await ensureThread(deps.client, assignment.id);

				if (stubMode || !account) {
					await storeMessage(deps.client, threadId, user.id, item.body);
					sent += 1;
					continue;
				}

				const raw = buildRaw({ from: account.email, to: item.to, subject: item.subject, body: item.body });
				const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${account.access_token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ raw })
				});

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(`gmail send failed: ${response.status} ${errorText}`);
				}

				await storeMessage(deps.client, threadId, user.id, item.body);
				sent += 1;
			} catch (err) {
				console.error('gmail-send item error', err);
				failed.push({ id: item.campaign_influencer_id, error: err instanceof Error ? err.message : 'unknown error' });
			}
		}

		return json({ ok: true, sent, failed });
	} catch (err) {
		if (err instanceof UsageLimitError) {
			return json({ error: err.message }, 403);
		}

		console.error('gmail-send error', err);
		return json({ error: 'Internal server error' }, 500);
	}
}

async function ensureThread(client: any, campaignInfluencerId: string) {
	const { data: existing } = await client
		.from('outreach_threads')
		.select('id')
		.eq('campaign_influencer_id', campaignInfluencerId)
		.eq('channel', 'email')
		.maybeSingle();

	if (existing?.id) {
		return existing.id as string;
	}

	const { data: created } = await client
		.from('outreach_threads')
		.insert({
			campaign_influencer_id: campaignInfluencerId,
			channel: 'email',
			last_message_at: new Date().toISOString()
		})
		.select('id')
		.single();

	return created.id as string;
}

async function storeMessage(client: any, threadId: string, authorId: string, body: string) {
	const now = new Date().toISOString();
	await client.from('outreach_messages').insert({
		thread_id: threadId,
		direction: 'brand',
		body,
		attachments: [],
		sent_at: now,
		author_id: authorId
	});
	await client.from('outreach_threads').update({ last_message_at: now }).eq('id', threadId);
}

function buildRaw({ from, to, subject, body }: { from: string; to: string; subject: string; body: string }) {
	const lines = [
		`From: ${from}`,
		`To: ${to}`,
		`Subject: ${subject}`,
		'MIME-Version: 1.0',
		'Content-Type: text/plain; charset="UTF-8"',
		'',
		body
	].join('\r\n');

	return base64Url(lines);
}

function base64Url(input: string) {
	const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(input)));
	return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function json(payload: unknown, status = 200) {
	return new Response(JSON.stringify(payload), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		status
	});
}
