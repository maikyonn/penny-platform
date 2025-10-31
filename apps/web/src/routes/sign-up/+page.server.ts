import { fail, redirect } from "@sveltejs/kit";
import { signUpWithEmailAndPassword, sendEmailVerification } from "$lib/server/firebase-identity";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.getSession();
	if (session) {
		throw redirect(303, '/campaign');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		const acceptTerms = formData.get('terms') === 'on';

		if (!email || !password) {
			return fail(400, {
				error: 'Email and password are required.',
				values: { email },
			});
		}

		if (password.length < 8) {
			return fail(400, {
				error: 'Password must be at least 8 characters long.',
				values: { email },
			});
		}

		if (!acceptTerms) {
			return fail(400, {
				error: 'Please accept the terms of service to continue.',
				values: { email },
			});
		}

		try {
			const result = await signUpWithEmailAndPassword(email, password);
			await locals.createSession(result.idToken);
			try {
				await sendEmailVerification(result.idToken);
			} catch (verificationError) {
				console.warn('[sign-up] email verification failed', verificationError);
			}
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Unable to create account.',
				values: { email },
			});
		}

		throw redirect(303, `/sign-up/confirm?email=${encodeURIComponent(email)}`);
	},
};
