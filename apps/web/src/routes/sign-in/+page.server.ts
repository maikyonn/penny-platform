import { fail, redirect } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$env/static/public';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.getSession();
	if (session) {
		throw redirect(303, url.searchParams.get('redirectTo') ?? '/campaign');
	}

	return { session: null };
};

export const actions: Actions = {
	password: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		if (!email || !password) {
			return fail(400, {
				action: 'password',
				error: 'Email and password are required.',
				values: { email },
			});
		}

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
		if (error) {
			return fail(400, {
				action: 'password',
				error: error.message,
				values: { email },
			});
		}

		throw redirect(303, '/campaign');
	},

	magic_link: async ({ request, locals, url }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();

		if (!email) {
			return fail(400, {
				action: 'magic_link',
				error: 'Email is required to send a magic link.',
				values: { email },
			});
		}

		const redirectTo = url.searchParams.get('redirectTo') ?? '/campaign';

		const { error } = await locals.supabase.auth.signInWithOtp({
			email,
			options: {
				emailRedirectTo: `${PUBLIC_SITE_URL}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`
			}
		});

		if (error) {
			return fail(400, {
				action: 'magic_link',
				error: error.message,
				values: { email },
			});
		}

		return {
			action: 'magic_link',
			success: true,
			message: 'Magic link sent! Check your email to finish signing in.',
			values: { email },
		};
	},
};
