import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handleSearchStub } from "../../../src/edge-functions/search-stub/handler.ts";

Deno.test('search stub enqueues job and returns snapshot', async () => {
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
					})
				};
			}
			throw new Error(`unexpected table ${table}`);
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
			throw new Error(`unexpected admin table ${table}`);
		}
	} as any;

	const enqueueResponse = await handleSearchStub(
		new Request('http://localhost/search-stub/search/', {
			method: 'POST',
			body: JSON.stringify({ query: 'coffee' })
		}),
		{ client, adminClient }
	);

	assertEquals(enqueueResponse.status, 200);
	const job = await enqueueResponse.json() as { job_id: string };
	assertEquals(profileUpserts.length, 1);
	assertEquals(profileUpserts[0].current_org, 'org_1');
	assertEquals(membershipUpserts.length, 1);
	assertEquals(membershipUpserts[0].org_id, 'org_1');
	assertEquals(usageInserts.length, 1);
	assertEquals(organizationsInserted.length, 1);

	const resultResponse = await handleSearchStub(
		new Request(`http://localhost/search-stub/search/job/${job.job_id}`),
		{ client, adminClient }
	);
	assertEquals(resultResponse.status, 200);
	const body = await resultResponse.json() as { result: { count: number } };
	assertEquals(body.result.count, 10);
});
