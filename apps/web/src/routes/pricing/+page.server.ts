import { getUserSubscription } from "$lib/server/subscriptions";
import { loadUserContext } from "$lib/server/user-context";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const { firebaseUser, profile } = await loadUserContext(locals);
	const subscription = firebaseUser
		? await getUserSubscription(locals.firestore, firebaseUser.uid)
		: null;

	return {
		profile,
		subscription,
	};
};
