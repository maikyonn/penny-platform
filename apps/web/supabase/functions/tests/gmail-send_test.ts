// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handleGmailSend } from "../../../src/edge-functions/gmail-send/handler.ts";

Deno.test('gmail send writes outreach messages in stub mode', async () => {
	const insertedThreads: any[] = [];
	const insertedMessages: any[] = [];

	const client = {
		auth: {
			getUser: async () => ({ data: { user: { id: 'user_1' } }, error: null })
		},
		from: (table: string) => {
			if (table === 'campaigns') {
				return {
					select: () => ({
						eq: () => ({ maybeSingle: async () => ({ data: { id: 'cmp_1', created_by: 'user_1' }, error: null }) })
					})
				};
			}
			if (table === 'gmail_accounts') {
				return {
					select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) })
				};
			}
			if (table === 'campaign_influencers') {
				return {
					select: () => ({
						eq: () => ({ maybeSingle: async () => ({ data: { id: 'ci_1', campaign_id: 'cmp_1' }, error: null }) })
					})
				};
			}
			if (table === 'outreach_threads') {
				const selector = {
					eq: () => selector,
					maybeSingle: async () => ({ data: null, error: null })
				};
				return {
					select: () => selector,
					insert: (payload: any) => {
						insertedThreads.push(payload);
						return {
							select: () => ({ single: async () => ({ data: { id: 'thread_1' }, error: null }) })
						};
					},
					update: () => ({ eq: () => ({ error: null }) })
				};
			}
			if (table === 'outreach_messages') {
				return {
					insert: async (payload: any) => {
						insertedMessages.push(payload);
						return { error: null };
					}
				};
			}
			return {
				insert: (payload: any) => {
					insertedThreads.push(payload);
					return { select: () => ({ single: async () => ({ data: payload, error: null }) }) };
				}
			};
		}
	} as any;

	const adminClient = {
		from: (table: string) => {
			if (table === 'subscriptions') {
				return {
					select: () => ({
						eq: () => ({ maybeSingle: async () => ({ data: { plan: 'starter', status: 'active', current_period_end: null }, error: null }) })
					})
				};
			}
			throw new Error(`unexpected admin table ${table}`);
		}
	} as any;

	const response = await handleGmailSend(
		new Request('http://localhost', {
			method: 'POST',
			body: JSON.stringify({
				campaign_id: 'cmp_1',
				items: [
					{ campaign_influencer_id: 'ci_1', to: 'test@example.com', subject: 'Hello', body: 'Hi there' }
				]
			})
		}),
		{ client, adminClient, env: { gmailStub: true } }
	);

	assertEquals(response.status, 200);
	assertEquals(insertedMessages.length, 1);
	assertEquals(insertedMessages[0].body, 'Hi there');
});
