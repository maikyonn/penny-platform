import { buildSupabaseClient, maybeHandleCors } from '../_shared/supabaseClient.ts';
import { handleGmailSend } from './handler.ts';

if (import.meta.main) {
	Deno.serve(async (req) => {
		const cors = maybeHandleCors(req);
		if (cors) return cors;

		const { client, adminClient } = buildSupabaseClient(req);
		return handleGmailSend(req, {
			client: client as any,
			adminClient: adminClient as any,
			env: { gmailStub: Deno.env.get('GMAIL_STUB') === '1' }
		});
	});
}
