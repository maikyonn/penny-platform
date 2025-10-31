import { redirect } from "@sveltejs/kit";
import { getUserSubscription } from "$lib/server/subscriptions";
import { loadUserContext } from "$lib/server/user-context";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const { firebaseUser, profile, userDoc } = await loadUserContext(locals);
	if (!firebaseUser) {
		throw redirect(303, '/sign-in');
	}

	const subscription = await getUserSubscription(locals.firestore, firebaseUser.uid);

	return {
		profile,
		subscription,
		userEmail: firebaseUser.email,
		plan: userDoc?.plan ?? null,
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		const formData = await request.formData();
		const fullName = String(formData.get('full_name') ?? '').trim();
		const locale = String(formData.get('locale') ?? '').trim() || null;

		const { firebaseUser, profile } = await loadUserContext(locals);
		if (!firebaseUser || !profile) {
			throw redirect(303, '/sign-in');
		}

		await locals.firestore.collection('users').doc(firebaseUser.uid).set(
			{
				displayName: fullName || profile.full_name,
				settings: {
					locale,
				},
				updatedAt: new Date(),
			},
			{ merge: true },
		);

		return { success: true, values: { full_name: fullName, locale } };
	},
};
