// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handleCronBillingMeter } from "../../../src/edge-functions/cron-billing-meter/handler.ts";

Deno.test('cron billing meter aggregates owners', async () => {
	const owners = [{ created_by: 'user_1' }, { created_by: 'user_2' }, { created_by: 'user_1' }];
	const inserted: any[] = [];

	const response = await handleCronBillingMeter(new Request('http://localhost', { method: 'POST' }), {
		client: {
			from: (table: string) => {
				if (table === 'campaigns') {
					return {
						select: async () => ({ data: owners, error: null })
					};
				}
				if (table === 'usage_logs') {
					return {
						insert: async (payload: unknown) => {
							inserted.push(payload);
							return { error: null };
						}
					};
				}
				throw new Error(`Unexpected table ${table}`);
			}
		} as any,
		random: () => 0.5,
		dateFactory: () => new Date('2025-01-01T00:00:00Z')
	});

	assertEquals(response.status, 200);
	assertEquals(inserted[0].length, 2);
	assertEquals(inserted[0][0].recorded_at, '2025-01-01T00:00:00.000Z');
});

Deno.test('cron billing meter rejects non-post', async () => {
	const res = await handleCronBillingMeter(new Request('http://localhost', { method: 'GET' }), {
		client: {} as any
	});
	assertEquals(res.status, 405);
});
