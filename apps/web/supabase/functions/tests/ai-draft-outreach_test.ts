// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handleAIDraftOutreach } from "../../../src/edge-functions/ai-draft-outreach/handler.ts";

Deno.test('ai draft outreach stores recommendations', async () => {
	const insertedDrafts: any[] = [];

	const client = {
		auth: {
			getUser: async () => ({ data: { user: { id: 'user_1' } }, error: null })
		},
		from: (table: string) => {
			if (table === 'campaigns') {
				return {
					select: () => ({
						eq: (_column: string, _value: string) => ({
							maybeSingle: async () => ({ data: { id: 'cmp_1', created_by: 'user_1', name: 'Launch' }, error: null })
						})
					})
				};
			}
			if (table === 'campaign_influencers') {
				return {
					select: () => ({
						eq: (_column: string, _value: string) => Promise.resolve({ data: [{ influencer_id: 'inf_1' }], error: null })
					})
				};
			}
			if (table === 'influencers') {
				return {
					select: () => ({
						in: async () => ({ data: [{ id: 'inf_1', display_name: 'Creator 1', verticals: ['tech'] }], error: null })
					})
				};
			}
			if (table === 'ai_recommendations') {
				return {
					insert: async (payload: any[]) => {
						insertedDrafts.push(...payload);
						return { error: null };
					}
				};
			}
			return {};
		}
	} as any;

	const response = await handleAIDraftOutreach(
		new Request('http://localhost', {
			method: 'POST',
			body: JSON.stringify({ campaign_id: 'cmp_1', tone: 'friendly' })
		}),
		{ client }
	);

	assertEquals(response.status, 200);
	assertEquals(insertedDrafts.length, 1);
	assertEquals(insertedDrafts[0].campaign_id, 'cmp_1');
	assertEquals(typeof insertedDrafts[0].metadata.subject, 'string');
});
