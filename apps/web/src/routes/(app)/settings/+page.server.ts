import { redirect } from '@sveltejs/kit';
import { getUserSubscription } from '$lib/server/subscriptions';
import { loadUserContext } from '$lib/server/user-context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { session, profile } = await loadUserContext(locals);
	if (!session) {
		throw redirect(303, '/sign-in');
	}

	const subscription = await getUserSubscription(locals.supabase, session.user.id);

	return {
		profile,
		subscription,
		usage: [],
	};
};
