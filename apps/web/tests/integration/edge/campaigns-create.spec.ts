import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/edge-functions/_shared/supabaseClient.ts', () => ({
	corsHeaders: {},
	maybeHandleCors: vi.fn(() => null)
}));

const { handleCampaignCreate } = await import('../../../src/edge-functions/campaigns-create/handler.ts');

describe('Edge function: campaigns-create handler', () => {
	it('rejects missing auth user', async () => {
		const response = await handleCampaignCreate(new Request('http://localhost', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Test' })
		}), {
			client: {
				auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
				from: vi.fn()
			} as any,
			adminClient: {} as any
		});

		expect(response.status).toBe(401);
	});

	it('creates profile when missing and inserts campaign', async () => {
		const profileTable = {
			select: vi.fn(() => ({
				eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) }))
			}))
		};

		const insertTargets = vi.fn(async () => ({ error: null }));
		const adminUpsert = vi.fn(async () => ({ error: null }));

		const response = await handleCampaignCreate(new Request('http://localhost', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Launch', targets: [{ geos: ['US'] }] })
		}), {
			client: {
				auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user_1', user_metadata: {} } }, error: null })) },
				from: vi.fn((table: string) => {
					if (table === 'profiles') return profileTable;
					if (table === 'campaigns') {
						return {
							insert: vi.fn(() => ({
								select: vi.fn(() => ({
									single: vi.fn(async () => ({ data: { id: 'cmp_1' }, error: null }))
								}))
							}))
						};
					}
					if (table === 'campaign_targets') {
						return { insert: insertTargets };
					}
					throw new Error(`unexpected table ${table}`);
				})
			} as any,
			adminClient: {
				from: vi.fn(() => ({ upsert: adminUpsert }))
			} as any
		});

		expect(response.status).toBe(200);
		expect(adminUpsert).toHaveBeenCalled();
		expect(insertTargets).toHaveBeenCalledTimes(1);
	});
});
