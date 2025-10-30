import { buildSupabaseClient, maybeHandleCors } from '../_shared/supabaseClient.ts';
import { handleCampaignCreate } from './handler.ts';

if (import.meta.main) {
	Deno.serve((req) => {
		const { client, adminClient } = buildSupabaseClient(req);
		return handleCampaignCreate(req, { client, adminClient, maybeHandleCors });
	});
}
