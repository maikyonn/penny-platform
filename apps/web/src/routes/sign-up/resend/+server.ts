import { json } from "@sveltejs/kit";
import { resendVerificationEmail } from "$lib/server/firebase-identity";

export const POST = async ({ request, locals }) => {
	const formData = await request.formData();
	const email = String(formData.get('email') ?? '').trim();

	if (!email) {
		return json({ success: false, error: 'Email is required.' }, { status: 400 });
	}

	try {
		await resendVerificationEmail(email);
	} catch (error) {
		return json({ success: false, error: error instanceof Error ? error.message : 'Unable to resend verification email.' }, { status: 400 });
	}

	return json({ success: true });
};
