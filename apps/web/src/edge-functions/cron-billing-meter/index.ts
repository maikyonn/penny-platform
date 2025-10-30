import { buildSupabaseClient } from '../_shared/supabaseClient.ts';
import { handleCronBillingMeter } from './handler.ts';

if (import.meta.main) {
	Deno.serve((req) => {
		const { client } = buildSupabaseClient(req);
		return handleCronBillingMeter(req, { client });
	});
}
