import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from '$env/static/private';
import type { Database } from '$lib/database.types';

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getAdminSupabaseClient() {
	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
		throw new Error('Missing Supabase service role configuration');
	}

	if (!adminClient) {
		adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
	}

	return adminClient;
}
