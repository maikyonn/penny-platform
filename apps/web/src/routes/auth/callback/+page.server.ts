import { redirect } from "@sveltejs/kit";
import { signInWithEmailLink } from "$lib/server/firebase-identity";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url, locals }) => {
	const oobCode = url.searchParams.get('oobCode');
	const email = url.searchParams.get('email');
	const redirectTo = url.searchParams.get('redirectTo') ?? '/campaign';

	if (!oobCode || !email) {
		throw redirect(303, '/sign-in?error=Invalid%20sign-in%20link');
	}

	try {
		const result = await signInWithEmailLink(email, oobCode);
		await locals.createSession(result.idToken, true);
	} catch (error) {
		throw redirect(303, `/sign-in?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unable to sign in with link.')}`);
	}

	throw redirect(303, redirectTo);
};
