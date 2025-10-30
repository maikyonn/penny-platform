// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handleChatbotStub } from "../../../src/edge-functions/chatbot-stub/handler.ts";

Deno.test('chatbot stub creates campaign and seeds influencers', async () => {
	const insertedCampaigns: any[] = [];
	const insertedInfluencers: any[] = [];
	const insertedAssignments: any[] = [];
	const profileUpserts: any[] = [];
	const membershipUpserts: any[] = [];
	const organizationsInserted: any[] = [];
	const usageInserts: any[] = [];
	let usageCount = 0;

	const client = {
		auth: {
			getUser: async () => ({ data: { user: { id: 'user_1' } }, error: null })
		},
		from: (table: string) => {
			if (table === 'profiles') {
				return {
					select: () => ({
						eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) })
					}),
					upsert: async () => ({ error: null }),
					update: async () => ({ error: null })
				};
			}
			return {};
		}
	} as any;

	const adminClient = {
		from: (table: string) => {
			if (table === 'campaigns') {
				return {
					insert: (payload: any) => {
						insertedCampaigns.push(payload);
						return {
							select: () => ({
								single: async () => ({ data: { id: 'cmp_1', name: payload.name }, error: null })
							})
						};
					}
				};
			}
			if (table === 'subscriptions') {
				return {
					select: () => ({
						eq: () => ({ maybeSingle: async () => ({ data: { plan: 'starter', status: 'active', current_period_end: null }, error: null }) })
					})
				};
			}
			if (table === 'organizations') {
				return {
					insert: (payload: any) => {
						organizationsInserted.push(payload);
						return {
							select: () => ({ single: async () => ({ data: { id: 'org_1' }, error: null }) })
						};
					}
				};
			}
			if (table === 'usage_logs') {
				return {
					select: () => ({
						eq: () => ({
							eq: () => ({
								gte: async () => ({ data: null, count: usageCount, error: null })
							})
						})
					}),
					insert: async (payload: any) => {
						usageInserts.push(payload);
						usageCount += 1;
						return { error: null };
					}
				};
			}
			if (table === 'profiles') {
				return {
					upsert: async (payload: any) => {
						profileUpserts.push(payload);
						return { error: null };
					},
					update: async (_payload: any) => ({ error: null })
				};
			}
			if (table === 'org_members') {
				return {
					upsert: async (payload: any) => {
						membershipUpserts.push(payload);
						return { error: null };
					}
				};
			}
			if (table === 'influencers') {
				return {
					select: () => ({
						in: async () => ({ data: [], error: null })
					}),
					insert: (payload: any[]) => {
						insertedInfluencers.push(payload);
						return {
							select: () => Promise.resolve({
								data: payload.map((item, idx) => ({ id: `inf_${idx}`, external_id: item.external_id })),
								error: null
							})
						};
					}
				};
			}
			if (table === 'campaign_influencers') {
				return {
					insert: async (payload: any) => {
						insertedAssignments.push(payload);
						return { error: null };
					}
				};
			}
			return {};
		}
	} as any;

	const res = await handleChatbotStub(
		new Request('http://localhost', {
			method: 'POST',
			body: JSON.stringify({ message: 'Hello assistant' })
		}),
		{ client, adminClient, random: () => 0.5, now: () => new Date('2025-01-01T00:00:00Z') }
	);

	assertEquals(res.status, 200);
	const body = await res.json() as any;
	assertEquals(body.conversation.at(-1).kind, 'card');
	assertEquals(typeof body.conversation[0].created_at, 'string');
	assertEquals(insertedCampaigns.length, 1);
	assertEquals(insertedAssignments.length > 0, true);
	assertEquals(profileUpserts.length, 1);
	assertEquals(profileUpserts[0].current_org, 'org_1');
	assertEquals(membershipUpserts.length, 1);
	assertEquals(membershipUpserts[0].org_id, 'org_1');
	assertEquals(organizationsInserted.length, 1);
	assertEquals(usageInserts.length, 1);
});

Deno.test('chatbot stub falls back to user_id when auth context missing', async () => {
	const adminGetUserCalls: string[] = [];
	const client = {
		auth: {
			getUser: async () => ({ data: { user: null }, error: null })
		},
		from: (table: string) => {
			if (table === 'profiles') {
				return {
					select: () => ({
						eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) })
					}),
					upsert: async () => ({ error: null }),
					update: async () => ({ error: null })
				};
			}
			return {};
		}
	} as any;

	const adminClient = {
		auth: {
			getUser: async () => ({ data: { user: null }, error: null }),
			admin: {
				getUserById: async (id: string) => {
					adminGetUserCalls.push(id);
					return {
						data: { user: { id, user_metadata: { full_name: 'Test User' } } },
						error: null
					};
				}
			}
		},
	from: (table: string) => {
		if (table === 'profiles') {
			return {
				select: () => ({
					eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) })
				}),
				upsert: async () => ({ error: null }),
				update: async () => ({ error: null })
			};
		}
			if (table === 'organizations') {
				return {
					insert: () => ({
						select: () => ({ single: async () => ({ data: { id: 'org_from_admin' }, error: null }) })
					})
				};
			}
			if (table === 'subscriptions') {
				return {
					select: () => ({
						eq: () => ({ maybeSingle: async () => ({ data: { plan: 'starter', status: 'active', current_period_end: null }, error: null }) })
					})
				};
			}
			if (table === 'usage_logs') {
				return {
					select: () => ({
						eq: () => ({
							eq: () => ({
								gte: async () => ({ data: null, count: 0, error: null })
							})
						})
					}),
					insert: async () => ({ error: null })
				};
			}
			if (table === 'org_members') {
				return {
					upsert: async () => ({ error: null })
				};
			}
			if (table === 'campaigns') {
				return {
					insert: () => ({
						select: () => ({ single: async () => ({ data: { id: 'cmp_admin', name: 'Admin Campaign' }, error: null }) })
					})
				};
			}
			if (table === 'influencers') {
				return {
					select: () => ({ in: async () => ({ data: [], error: null }) }),
					insert: () => ({
						select: () => Promise.resolve({ data: [], error: null })
					})
				};
			}
			if (table === 'campaign_influencers') {
				return {
					insert: async () => ({ error: null })
				};
			}
			return {};
		}
	} as any;

	const res = await handleChatbotStub(
		new Request('http://localhost', {
			method: 'POST',
			body: JSON.stringify({ message: 'Hi there', user_id: 'user_admin' })
		}),
		{ client, adminClient, random: () => 0.2, now: () => new Date('2025-01-02T00:00:00Z') }
	);

	assertEquals(res.status, 200);
	assertEquals(adminGetUserCalls, ['user_admin']);
});
