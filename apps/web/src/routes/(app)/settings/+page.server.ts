import { redirect } from "@sveltejs/kit";
import { getUserSubscription } from "$lib/server/subscriptions";
import { loadUserContext } from "$lib/server/user-context";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const { firebaseUser, profile } = await loadUserContext(locals);
	if (!firebaseUser) {
		throw redirect(303, '/sign-in');
	}

	const subscription = await getUserSubscription(locals.firestore, firebaseUser.uid);

	return {
		profile,
		subscription,
		usage: [],
	};
};
