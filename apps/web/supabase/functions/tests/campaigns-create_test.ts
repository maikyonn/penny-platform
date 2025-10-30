// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handleCampaignCreate } from "../../../src/edge-functions/campaigns-create/handler.ts";

function createAuth(user: any) {
	return {
		getUser: async () => ({ data: { user }, error: null })
	};
}

function createProfilesTable(withProfile: boolean) {
	return {
		select: () => ({
			eq: () => ({ maybeSingle: async () => ({ data: withProfile ? { user_id: 'user_123' } : null, error: null }) })
		})
	};
}

function createCampaignTable() {
	return {
		insert: (_payload: unknown) => ({
			select: () => ({
				single: async () => ({ data: { id: 'cmp_123', name: 'Launch' }, error: null })
			})
		})
	};
}

Deno.test('campaigns-create validates payload', async () => {
	const response = await handleCampaignCreate(new Request('http://localhost', { method: 'POST', body: '{}' }), {
		client: {
			auth: createAuth({ id: 'user_123', user_metadata: {} }),
			from: () => createProfilesTable(true)
		} as any,
		adminClient: {} as any
	});

	assertEquals(response.status, 400);
});

Deno.test('campaigns-create creates campaign and targets', async () => {
	const profileTable = createProfilesTable(false);
	const upsertSpy: any[] = [];
	const insertTargets: any[] = [];

	const response = await handleCampaignCreate(
		new Request('http://localhost', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Launch', targets: [{ geos: ['US'] }] })
		}),
		{
			client: {
				auth: createAuth({ id: 'user_123', user_metadata: {} }),
				from: (table: string) => {
					if (table === 'profiles') return profileTable;
					if (table === 'campaigns') return createCampaignTable();
					if (table === 'campaign_targets') {
						return {
							insert: async (payload: unknown) => {
								insertTargets.push(payload);
								return { error: null };
							}
						};
					}
					throw new Error(`unexpected table ${table}`);
				}
			} as any,
			adminClient: {
				from: () => ({
					upsert: async (payload: unknown) => {
						upsertSpy.push(payload);
						return { error: null };
					}
				})
			} as any
		}
	);

	assertEquals(response.status, 200);
	assertEquals(upsertSpy.length, 1);
	assertEquals(insertTargets.length, 1);
});
