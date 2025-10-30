import type { Session } from '@supabase/supabase-js';
import { getAdminSupabaseClient } from './supabase-admin';

type UserProfile = {
	user_id: string;
	full_name: string | null;
	avatar_url: string | null;
	locale: string | null;
};

export type UserContext = {
	session: Session | null;
	profile: UserProfile | null;
};

export async function loadUserContext(locals: App.Locals): Promise<UserContext> {
	const {
		data: { user },
		error: userError,
	} = await locals.supabase.auth.getUser();

	if (userError || !user) {
		return {
			session: null,
			profile: null,
		};
	}

	const session = await locals.getSession();
	if (!session || session.user.id !== user.id) {
		return {
			session: null,
			profile: null,
		};
	}

	const userId = user.id;

	const { data: profile, error: profileError } = await locals.supabase
		.from('profiles')
		.select('user_id, full_name, avatar_url, locale')
		.eq('user_id', userId)
		.maybeSingle<UserProfile>();

	if (profileError) {
		console.error('[user-context] profile fetch error', profileError);
	}

	let ensuredProfile: UserProfile | null = profile ?? null;

	if (!ensuredProfile) {
		const admin = getAdminSupabaseClient();
		const { error: upsertError } = await admin
			.from('profiles')
			.upsert(
				{
					user_id: userId,
					full_name: session.user.user_metadata?.full_name ?? null,
					avatar_url: session.user.user_metadata?.avatar_url ?? null,
				},
				{ onConflict: 'user_id' }
			);

		if (upsertError && upsertError.code !== '23505') {
			console.error('[user-context] profile upsert error', upsertError);
		}

		const { data: refetched } = await locals.supabase
			.from('profiles')
			.select('user_id, full_name, avatar_url, locale')
			.eq('user_id', userId)
			.maybeSingle<UserProfile>();
		ensuredProfile = refetched ?? ensuredProfile;
	}

	return {
		session,
		profile: ensuredProfile
			? {
				user_id: ensuredProfile.user_id,
				full_name: ensuredProfile.full_name,
				avatar_url: ensuredProfile.avatar_url,
				locale: ensuredProfile.locale ?? null,
			}
			: null,
	};
}
