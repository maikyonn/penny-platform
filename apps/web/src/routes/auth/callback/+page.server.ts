import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	if (!code) {
		throw redirect(303, '/');
	}

	const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
	if (error) {
		throw redirect(303, `/sign-in?error=${encodeURIComponent(error.message)}`);
	}

	throw redirect(303, '/campaign');
};
