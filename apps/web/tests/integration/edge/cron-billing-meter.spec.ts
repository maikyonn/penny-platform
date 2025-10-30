import { describe, expect, it, vi } from 'vitest';
import { handleCronBillingMeter } from '../../../src/edge-functions/cron-billing-meter/handler.ts';

describe('Edge function: cron-billing-meter handler', () => {
	it('aggregates unique owners and inserts usage logs', async () => {
		const usageInsert = vi.fn(async () => ({ error: null }));
		const response = await handleCronBillingMeter(new Request('http://localhost', { method: 'POST' }), {
			client: {
				from: vi.fn((table: string) => {
					if (table === 'campaigns') {
						return {
							select: vi.fn(async () => ({ data: [{ created_by: 'a' }, { created_by: 'b' }, { created_by: 'a' }], error: null }))
						};
					}
					if (table === 'usage_logs') {
						return { insert: usageInsert };
					}
					throw new Error(`unexpected table ${table}`);
				})
			} as any,
			random: () => 0.75,
			dateFactory: () => new Date('2025-01-01T00:00:00Z')
		});

		expect(response.status).toBe(200);
		expect(usageInsert).toHaveBeenCalledWith([
			{
				user_id: 'a',
				metric: 'ai_tokens',
				quantity: Math.floor(0.75 * 1000),
				recorded_at: '2025-01-01T00:00:00.000Z'
			},
			{
				user_id: 'b',
				metric: 'ai_tokens',
				quantity: Math.floor(0.75 * 1000),
				recorded_at: '2025-01-01T00:00:00.000Z'
			}
		]);
	});

	it('rejects non-post methods', async () => {
		const res = await handleCronBillingMeter(new Request('http://localhost', { method: 'GET' }), {
			client: {} as any
		});
		expect(res.status).toBe(405);
	});
});
