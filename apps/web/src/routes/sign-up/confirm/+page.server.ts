import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.getSession();
	if (session) {
		throw redirect(303, '/campaign');
	}

	const email = url.searchParams.get('email');
	if (!email) {
		throw redirect(303, '/sign-up');
	}

	return { email };
};
