import { json } from '@sveltejs/kit';

export const POST = async ({ request, locals }) => {
	const formData = await request.formData();
	const email = String(formData.get('email') ?? '').trim();

	if (!email) {
		return json({ success: false, error: 'Email is required.' }, { status: 400 });
	}

	const { error } = await locals.supabase.auth.resend({ type: 'signup', email });

	if (error) {
		return json({ success: false, error: error.message }, { status: 400 });
	}

	return json({ success: true });
};
