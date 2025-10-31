import { fail, redirect } from "@sveltejs/kit";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { signInWithEmailAndPassword, sendEmailSignInLink } from "$lib/server/firebase-identity";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.getSession();
	if (session) {
		throw redirect(303, url.searchParams.get("redirectTo") ?? "/campaign");
	}

	return {};
};

export const actions: Actions = {
	password: async ({ request, locals, url }) => {
		const formData = await request.formData();
		const email = String(formData.get("email") ?? "").trim();
		const password = String(formData.get("password") ?? "");
		const remember = formData.get("remember") === "on";

		if (!email || !password) {
			return fail(400, {
				action: "password",
				error: "Email and password are required.",
				values: { email },
			});
		}

		try {
			const signIn = await signInWithEmailAndPassword(email, password);
			await locals.createSession(signIn.idToken, remember);
		} catch (error) {
			return fail(400, {
				action: "password",
				error: error instanceof Error ? error.message : "Invalid credentials.",
				values: { email },
			});
		}

		throw redirect(303, url.searchParams.get("redirectTo") ?? "/campaign");
	},

	magic_link: async ({ request, locals, url }) => {
		const formData = await request.formData();
		const email = String(formData.get("email") ?? "").trim();

		if (!email) {
			return fail(400, {
				action: "magic_link",
				error: "Email is required to send a magic link.",
				values: { email },
			});
		}

		const redirectTo = url.searchParams.get("redirectTo") ?? "/campaign";
		const continueUrl = `${PUBLIC_SITE_URL}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}&email=${encodeURIComponent(email)}`;

		try {
			await sendEmailSignInLink(email, continueUrl);
		} catch (error) {
			return fail(400, {
				action: "magic_link",
				error: error instanceof Error ? error.message : "Unable to send magic link.",
				values: { email },
			});
		}

		return {
			action: "magic_link",
			success: true,
			message: "Magic link sent! Check your email to finish signing in.",
			values: { email },
		};
	},
};
