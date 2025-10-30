import { redirect } from '@sveltejs/kit';
import { loadUserContext } from '$lib/server/user-context';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, profile } = await loadUserContext(locals);

	if (!session) {
		throw redirect(303, '/sign-in');
	}

	return {
		session,
		profile
	};
};
