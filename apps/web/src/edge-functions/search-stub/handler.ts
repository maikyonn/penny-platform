import { corsHeaders } from '../_shared/supabaseClient.ts';
import { ensureOrgContext } from '../_shared/userContext.ts';
import {
	ensureActiveSubscription,
	assertPlanAllowsFeature,
	assertUsageWithinLimit,
	recordUsageEvent,
	UsageLimitError
} from '../_shared/usageLimits.ts';

type JobRecord = {
	job_id: string;
	status: 'finished' | 'queued';
	result: any;
	events: { stage: string; data: any }[];
};

const jobs = new Map<string, JobRecord>();

type SupabaseClientLike = {
	auth: {
		getUser: () => Promise<{ data: { user: { id: string; user_metadata?: Record<string, unknown> } | null }; error: unknown }>;
	};
	from: (table: string) => any;
};

export interface SearchStubDeps {
	client: SupabaseClientLike;
	adminClient: SupabaseClientLike;
	now?: () => Date;
}

export async function handleSearchStub(req: Request, deps: SearchStubDeps): Promise<Response> {
	const url = new URL(req.url);
	const pathname = url.pathname.replace(/^.*\/search-stub/, '');

	if (req.method === 'GET' && (!pathname || pathname === '/')) {
		return json({ message: 'GenZ Creator Search API (stub)', version: '1.0.0' });
	}

	if (req.method === 'POST' && pathname === '/search/') {
		try {
			const {
				data: { user },
				error
			} = await deps.client.auth.getUser();
			if (error || !user) {
				return json({ error: 'Unauthorized' }, 401);
			}

			const { orgId, userId } = await ensureOrgContext(deps.client as any, deps.adminClient as any, user);
			const { subscription, planLimits } = await ensureActiveSubscription(deps.adminClient as any, userId);
			assertPlanAllowsFeature(planLimits, 'search');
			await assertUsageWithinLimit(
				deps.adminClient as any,
				orgId,
				subscription,
				planLimits,
				'search',
				{ now: deps.now }
			);

			const id = `stub:${crypto.randomUUID()}`;
			const result = buildResult();
			const events = buildEvents(result);
			jobs.set(id, { job_id: id, status: 'finished', result, events });

			await recordUsageEvent(deps.adminClient as any, orgId, 'search', { now: deps.now });

			return json({ job_id: id, queue: 'search', status: 'queued' });
		} catch (err) {
			if (err instanceof UsageLimitError) {
				const status = err.code === 'USAGE_LIMIT_REACHED' ? 429 : 403;
				return json({ error: err.message }, status);
			}

			console.error('search-stub error', err);
			return json({ error: 'Internal server error' }, 500);
		}
	}

	const jobMatch = pathname.match(/^\/search\/job\/([^/]+)(\/(stream))?$/);
	if (req.method === 'GET' && jobMatch) {
		const jobId = jobMatch[1];
		const stream = Boolean(jobMatch[3]);
		const job = jobs.get(jobId);
		if (!job) return json({ error: 'not found' }, 404);

		if (!stream) {
			return json({
				job_id: job.job_id,
				status: job.status,
				started_at: new Date().toISOString(),
				ended_at: new Date(Date.now() + 500).toISOString(),
				result: job.result,
				events: job.events
			});
		}

		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				for (const event of job.events) {
					controller.enqueue(encodeSse(event.stage, event.data));
				}
				controller.close();
			}
		});

		return new Response(body, {
			headers: {
				...corsHeaders,
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache'
			}
		});
	}

	return json({ error: 'Not found' }, 404);
}

function buildResult() {
	const results = Array.from({ length: 10 }).map((_, index) => ({
		id: 10_000 + index,
		account: `creator_${index}`,
		username: `creator_${index}`,
		display_name: `Creator ${index}`,
		profile_name: `Creator ${index}`,
		platform: ['instagram', 'tiktok', 'youtube'][index % 3],
		followers: 12_000 + index * 2_500,
		followers_formatted: `${(12 + index * 2.5).toFixed(1)}K`,
		avg_engagement: +(3 + Math.random() * 3).toFixed(1),
		business_category_name: 'Lifestyle',
		business_address: 'United States',
		biography: 'Demo bio created by stub.',
		profile_url: `https://example.com/creator_${index}`,
		business_email: `creator_${index}@example.com`,
		email_address: `creator_${index}@example.com`,
		posts: [],
		is_personal_creator: true,
		individual_vs_org_score: 2,
		generational_appeal_score: 6,
		professionalization_score: 6,
		relationship_status_score: 0,
		combined_score: 0.6,
		score_mode: 'hybrid',
		similarity_explanation: ''
	}));

	return {
		success: true,
		results,
		count: results.length,
		query: 'stubbed search',
		method: 'hybrid'
	};
}

function buildEvents(result: any) {
	return [
		{ stage: 'snapshot', data: { stage: 'snapshot', data: { events: [] } } },
		{ stage: 'SEARCH_STARTED', data: { stage: 'SEARCH_STARTED', data: { query: result.query, limit: result.count } } },
		{ stage: 'SEARCH_COMPLETED', data: { stage: 'SEARCH_COMPLETED', data: { count: result.count } } },
		{ stage: 'completed', data: { stage: 'completed', data: result } }
	];
}

function encodeSse(event: string, data: unknown) {
	const lines = [`event: ${event}`, `data: ${JSON.stringify(data)}`, ''];
	return new TextEncoder().encode(`${lines.join('\n')}\n`);
}

function json(payload: unknown, status = 200) {
	return new Response(JSON.stringify(payload), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		status
	});
}
