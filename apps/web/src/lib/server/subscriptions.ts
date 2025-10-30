import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';

export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];

export async function getUserSubscription(
	client: SupabaseClient<any>,
	userId: string
): Promise<SubscriptionRow | null> {
	const { data, error } = await client
		.from('subscriptions')
		.select('*')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) {
		console.error('[billing] subscription fetch failed', error);
		return null;
	}

	return data ?? null;
}
