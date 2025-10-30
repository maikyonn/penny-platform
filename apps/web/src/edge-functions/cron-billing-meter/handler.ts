type SupabaseLike = {
	from: (table: string) => any;
};

export interface CronBillingDeps {
	client: SupabaseLike;
	random?: () => number;
	dateFactory?: () => Date;
}

export async function handleCronBillingMeter(req: Request, deps: CronBillingDeps) {
	if (req.method !== 'POST') {
		return new Response('Method not allowed', { status: 405 });
	}

	const random = deps.random ?? Math.random;
	const now = deps.dateFactory ? deps.dateFactory() : new Date();

	try {
		const { data: ownerRows, error: ownersError } = await deps.client
			.from('campaigns')
			.select('created_by', { distinct: true });

		if (ownersError) {
			throw ownersError;
		}

		const uniqueOwners = Array.from(
			new Set((ownerRows ?? []).map((row: { created_by: string | null }) => row.created_by).filter(Boolean))
		) as string[];

		const usageRows = uniqueOwners.map((userId) => ({
			user_id: userId,
			metric: 'ai_tokens',
			quantity: Math.floor(random() * 1000),
			recorded_at: now.toISOString()
		}));

		if (usageRows.length) {
			const { error: insertError } = await deps.client.from('usage_logs').insert(usageRows);
			if (insertError) {
				throw insertError;
			}
		}

		return new Response(
			JSON.stringify({ status: 'ok', rows: usageRows.length }),
			{ headers: { 'Content-Type': 'application/json' }, status: 200 }
		);
	} catch (error) {
		console.error('cron-billing-meter error', error);
		return new Response(
			JSON.stringify({ error: (error as Error)?.message ?? 'Unknown error' }),
			{ headers: { 'Content-Type': 'application/json' }, status: 500 }
		);
	}
}
