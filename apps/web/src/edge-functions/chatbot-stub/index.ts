import { buildSupabaseClient, maybeHandleCors } from '../_shared/supabaseClient.ts';
import { handleChatbotStub } from './handler.ts';

if (import.meta.main) {
	Deno.serve(async (req) => {
		const cors = maybeHandleCors(req);
		if (cors) return cors;

		const { client, adminClient } = buildSupabaseClient(req);
		return handleChatbotStub(req, { client: client as any, adminClient: adminClient as any });
	});
}
