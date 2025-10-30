import { redirect } from '@sveltejs/kit';
import { getUserSubscription } from '$lib/server/subscriptions';
import { loadUserContext } from '$lib/server/user-context';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { session, profile } = await loadUserContext(locals);
	if (!session) {
		throw redirect(303, '/sign-in');
	}

	const { data: profileRow } = await locals.supabase
		.from('profiles')
		.select('user_id, full_name, avatar_url, locale')
		.eq('user_id', session.user.id)
		.maybeSingle();

	const subscription = await getUserSubscription(locals.supabase, session.user.id);

	return {
		profile: profileRow ?? profile,
		subscription,
		userEmail: session.user.email,
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		const formData = await request.formData();
		const fullName = String(formData.get('full_name') ?? '').trim();
		const locale = String(formData.get('locale') ?? '').trim() || null;

		const { session, profile } = await loadUserContext(locals);
		if (!session || !profile) {
			throw redirect(303, '/sign-in');
		}

		await locals.supabase
			.from('profiles')
			.update({ full_name: fullName || profile.full_name, locale })
			.eq('user_id', profile.user_id);

		return { success: true, values: { full_name: fullName, locale } };
	},
};
