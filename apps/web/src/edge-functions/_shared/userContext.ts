type SupabaseAuthLike = {
	getUser: () => Promise<{ data: { user: { id: string; user_metadata?: Record<string, unknown> } | null }; error: unknown }>;
};

type SupabaseTableLike = {
	select: (columns: string) => any;
	insert?: (values: unknown) => any;
	update?: (values: unknown) => any;
	upsert?: (values: unknown, options?: unknown) => any;
};

type SupabaseLike = {
	auth: SupabaseAuthLike;
	from: (table: string) => SupabaseTableLike;
};

export async function ensureOrgContext(
	client: SupabaseLike,
	adminClient: SupabaseLike,
	user: { id: string; user_metadata?: Record<string, unknown> } | null
): Promise<{ userId: string; orgId: string }> {
	if (!user?.id) {
		throw new Error('Unauthorized');
	}

	const userId = user.id;

	const { data: profile, error: profileError } = await client
		.from('profiles')
		.select('user_id, current_org, full_name, avatar_url')
		.eq('user_id', userId)
		.maybeSingle();

	if (profileError) {
		throw profileError;
	}

	let orgId = profile?.current_org as string | null;

	if (!orgId) {
		const displayName = typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim().length
			? user.user_metadata.full_name.trim()
			: 'Personal Workspace';

		const { data: orgRow, error: orgError } = await (adminClient.from('organizations') as any)
			.insert({ name: displayName, plan: 'free' })
			.select('id')
			.single();

		if (orgError) {
			throw orgError;
		}

		orgId = orgRow.id as string;
	}

	if (!profile) {
		const profileBuilder = adminClient.from('profiles') as any;
		const { error: profileUpsertError } = await profileBuilder.upsert(
			{
				user_id: userId,
				full_name: user.user_metadata?.full_name ?? null,
				avatar_url: user.user_metadata?.avatar_url ?? null,
				current_org: orgId
			},
			{ onConflict: 'user_id', ignoreDuplicates: false }
		);

		if (profileUpsertError) {
			throw profileUpsertError;
		}
	} else if (!profile.current_org) {
		const { error: profileUpdateError } = await (adminClient.from('profiles') as any)
			.update({ current_org: orgId })
			.eq('user_id', userId);

		if (profileUpdateError) {
			throw profileUpdateError;
		}
	}

	const membershipBuilder = adminClient.from('org_members') as any;
	const { error: membershipError } = await membershipBuilder.upsert(
		{
			org_id: orgId,
			user_id: userId,
			role: 'owner',
			invited_by: userId
		},
		{ onConflict: 'org_id,user_id', ignoreDuplicates: true }
	);

	if (membershipError) {
		throw membershipError;
	}

	return { userId, orgId: orgId as string };
}
