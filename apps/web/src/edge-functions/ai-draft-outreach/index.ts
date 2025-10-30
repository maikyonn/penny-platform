import { buildSupabaseClient, maybeHandleCors } from '../_shared/supabaseClient.ts';
import { handleAIDraftOutreach } from './handler.ts';

if (import.meta.main) {
	Deno.serve(async (req) => {
		const cors = maybeHandleCors(req);
		if (cors) return cors;

		const { client } = buildSupabaseClient(req);
		return handleAIDraftOutreach(req, { client: client as any });
	});
}
