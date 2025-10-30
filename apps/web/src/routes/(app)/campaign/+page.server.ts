import { fail, redirect } from '@sveltejs/kit';
import { loadUserContext } from '$lib/server/user-context';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { session } = await loadUserContext(locals);
	if (!session) {
		throw redirect(303, '/sign-in');
	}

	return { session };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const { session } = await loadUserContext(locals);
		if (!session) {
			throw redirect(303, '/sign-in');
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const objective = String(formData.get('objective') ?? '').trim() || null;
		const landingPageUrl = String(formData.get('landing_page_url') ?? '').trim() || null;

		if (!name) {
			return fail(400, {
				error: 'Campaign name is required.',
				values: { name, objective, landing_page_url: landingPageUrl }
			});
		}

		const { data, error: createError } = await locals.supabase.functions.invoke('campaigns-create', {
			body: {
				name,
				objective,
				landing_page_url: landingPageUrl,
			},
			headers: {
				Authorization: `Bearer ${session.access_token}`,
			},
		});

		if (createError) {
			console.error('[campaign action] campaigns-create error', createError);
			return fail(500, {
				error: 'We could not create that campaign just yet. Try again in a moment.',
				values: { name, objective, landing_page_url: landingPageUrl }
			});
		}

		const newCampaignId = data?.campaign?.id;
		if (newCampaignId) {
			throw redirect(303, `/campaign/${newCampaignId}`);
		}

		return {
			success: true,
			campaign: data?.campaign ?? null,
		};
	},
};
