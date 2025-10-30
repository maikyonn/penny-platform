<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$lib/components/Button.svelte';

	let { data } = $props();

	const pageStore = page;
const form = $derived($pageStore.form ?? null);

	let assignments = data.assignments ?? [];
let selectedAssignmentId = $state<string | null>(assignments[0]?.id ?? null);
	let messageDraft = $state('');
const messageError = $derived(() => form?.error ?? null);
const messageSuccess = $derived(() => form?.success && form?.campaignId === data.campaign.id);

	let selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null;
	const defaults = {
		total: 0,
		byStatus: {
			prospect: 0,
			invited: 0,
			accepted: 0,
			declined: 0,
			in_conversation: 0,
			contracted: 0,
			completed: 0,
		},
	};

	const statusSummary = {
		total: data.statusSummary?.total ?? defaults.total,
		byStatus: {
			...defaults.byStatus,
			...(data.statusSummary?.byStatus ?? {}),
		},
	};

$effect(() => {
	if (!assignments.length) {
		selectedAssignmentId = null;
		return;
	}

	if (!assignments.some((assignment) => assignment.id === selectedAssignmentId)) {
		selectedAssignmentId = assignments[0]?.id ?? null;
	}
});

$effect(() => {
	if (form?.success) {
		messageDraft = '';
	}
});
</script>

<div class="max-w-6xl mx-auto px-6 lg:px-12 py-12 space-y-10">
			<section class="bg-white border border-gray-200 rounded-3xl shadow-sm p-6 md:p-8">
				<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div>
						<p class="text-xs uppercase tracking-wide text-gray-500">Campaign</p>
						<h1 class="text-3xl font-semibold text-gray-900">{data.campaign.name}</h1>
						<p class="text-sm text-gray-500 mt-2">
							Status:
							<span class="capitalize font-medium text-gray-800">{data.campaign.status.replace('_', ' ')}</span>
							· Created {new Date(data.campaign.created_at).toLocaleDateString()}
						</p>
					</div>
					<div class="flex gap-3">
						<Button variant="outline" href={`/campaign/${data.campaign.id}/edit`} class="justify-center">Edit</Button>
						<Button href={`/campaign/${data.campaign.id}/report`} class="justify-center">Generate report</Button>
					</div>
				</div>
				<div class="mt-6 grid gap-6 md:grid-cols-3 text-sm text-gray-600">
					<div>
						<p class="text-xs uppercase tracking-wide text-gray-500">Objective</p>
						<p class="mt-2 text-base text-gray-800">{data.campaign.objective ?? 'Not specified'}</p>
					</div>
					<div>
						<p class="text-xs uppercase tracking-wide text-gray-500">Budget</p>
						<p class="mt-2 text-base text-gray-800">
							{#if data.campaign.budget_cents}
								${Math.round(data.campaign.budget_cents / 100).toLocaleString()} {data.campaign.currency ?? 'USD'}
							{:else}
								Not set
							{/if}
						</p>
					</div>
					<div>
						<p class="text-xs uppercase tracking-wide text-gray-500">Timeline</p>
						<p class="mt-2 text-base text-gray-800">
							{#if data.campaign.start_date}
								{data.campaign.start_date} → {data.campaign.end_date ?? 'ongoing'}
							{:else}
								Not scheduled
							{/if}
						</p>
					</div>
				</div>
			</section>

			<section class="grid gap-6 lg:grid-cols-2">
				<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<h2 class="text-lg font-semibold text-gray-900">Targeting brief</h2>
					{#if data.targets.length}
						<div class="mt-4 space-y-3 text-sm text-gray-600">
							{#each data.targets as target}
								<div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
									<p class="text-xs uppercase tracking-wide text-gray-500">Platforms</p>
									<p class="mt-1">{target.platforms?.join(', ') ?? 'Any'}</p>
									<p class="mt-3 text-xs uppercase tracking-wide text-gray-500">Interests</p>
									<p class="mt-1">{target.interests?.join(', ') ?? 'Open'}</p>
									<p class="mt-3 text-xs uppercase tracking-wide text-gray-500">Locations</p>
									<p class="mt-1">{target.geos?.join(', ') ?? 'Global'}</p>
								</div>
							{/each}
						</div>
					{:else}
						<p class="mt-3 text-sm text-gray-500">No audience preferences captured yet.</p>
					{/if}
				</article>
				<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<h2 class="text-lg font-semibold text-gray-900">Status summary</h2>
					<ul class="mt-4 space-y-2 text-sm text-gray-600">
						<li class="flex items-center justify-between">
							<span>Total creators</span>
							<span class="font-medium text-gray-900">{statusSummary.total}</span>
						</li>
						{#each Object.entries(statusSummary.byStatus ?? {}) as [status, value]}
							<li class="flex items-center justify-between capitalize">
								<span>{status.replace('_', ' ')}</span>
								<span class="font-medium text-gray-900">{value}</span>
							</li>
						{/each}
					</ul>
				</article>
			</section>

			<section class="rounded-3xl border border-gray-200 bg-white shadow-sm">
				<header class="border-b border-gray-100 px-6 py-5">
					<h2 class="text-lg font-semibold text-gray-900">Influencer outreach</h2>
					<p class="text-sm text-gray-500">Review creator profiles and keep conversations moving.</p>
				</header>
				{#if assignments.length}
					<div class="grid gap-6 p-6 lg:grid-cols-[0.9fr,1.1fr]">
						<div class="space-y-4">
							<h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Influencer list</h3>
							<ul class="space-y-2">
								{#each assignments as assignment}
									<li>
										<button
											type="button"
											onclick={() => (selectedAssignmentId = assignment.id)}
											class={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
												assignment.id === selectedAssignmentId
													? 'border-[#FF6F61] bg-[#FFF1ED] text-gray-900 shadow-sm'
													: 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
											}`}
										>
											<span class="block font-semibold text-gray-900">{assignment.influencer?.display_name ?? 'Unknown influencer'}</span>
											<span class="text-xs text-gray-500 capitalize">{assignment.status.replace('_', ' ')}</span>
										</button>
									</li>
								{/each}
							</ul>
						</div>
						<div class="space-y-4">
			{#if selectedAssignment}
				{@const assignment = selectedAssignment}
				<div class="rounded-2xl border border-gray-100 bg-gray-50 p-5">
									<h3 class="text-base font-semibold text-gray-900">Profile</h3>
									<p class="mt-2 text-sm text-gray-600">{assignment.influencer?.handle ?? 'N/A'} · {assignment.influencer?.platform ?? 'platform tbd'}</p>
									<div class="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600">
										<div>
											<p class="text-xs uppercase tracking-wide text-gray-500">Followers</p>
											<p class="mt-1 font-semibold text-gray-900">{assignment.influencer?.follower_count?.toLocaleString() ?? '—'}</p>
										</div>
										<div>
											<p class="text-xs uppercase tracking-wide text-gray-500">Engagement</p>
											<p class="mt-1 font-semibold text-gray-900">{assignment.influencer?.engagement_rate ?? '—'}%</p>
										</div>
										<div>
											<p class="text-xs uppercase tracking-wide text-gray-500">Location</p>
											<p class="mt-1">{assignment.influencer?.location ?? '—'}</p>
										</div>
										<div>
											<p class="text-xs uppercase tracking-wide text-gray-500">Status</p>
											<p class="mt-1 capitalize">{assignment.status.replace('_', ' ')}</p>
										</div>
									</div>
								</div>

								<div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
									<h3 class="text-base font-semibold text-gray-900">Conversation</h3>
									{#if messageError()}
										{@const errorText = messageError()}
										<div class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
											{errorText}
										</div>
									{/if}
					<div class="mt-4 space-y-3 max-h-64 overflow-y-auto pr-1">
						{#if assignment.messages?.length}
											{#each assignment.messages ?? [] as message}
												<div class={`rounded-2xl px-4 py-3 text-sm ${
													message.direction === 'brand' ? 'bg-[#FFF1ED] text-gray-800' : 'bg-gray-100 text-gray-700'
												}`}>
													<p class="mb-1 text-xs uppercase tracking-wide text-gray-500">
														{message.direction === 'brand' ? 'Brand' : 'Influencer'} · {new Date(message.sent_at).toLocaleString()}
													</p>
													<p>{message.body}</p>
												</div>
											{/each}
										{:else}
											<p class="text-sm text-gray-500">No messages exchanged yet.</p>
										{/if}
					</div>
					{#if messageSuccess()}
						<div class="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
							Message sent successfully.
						</div>
					{/if}
					<form method="POST" action="?/sendMessage" class="mt-4 space-y-3">
										<input type="hidden" name="campaign_influencer_id" value={assignment.id}>
										<textarea
											name="message"
											rows="3"
											placeholder="Write a reply"
											class="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF6F61]"
											bind:value={messageDraft}
											required
										></textarea>
										<div class="flex items-center justify-between">
											<input type="hidden" name="channel" value={assignment.thread?.channel ?? 'email'}>
											<button type="button" class="text-sm text-gray-500 hover:text-gray-700">Attach file</button>
											<Button type="submit">Send</Button>
										</div>
									</form>
								</div>
							{:else}
								<p class="text-sm text-gray-500">Select a creator to view details.</p>
							{/if}
						</div>
					</div>
				{:else}
					<p class="px-6 py-8 text-sm text-gray-500">Add creators to this campaign to see them here.</p>
				{/if}
			</section>

			<section class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
				<h2 class="text-lg font-semibold text-gray-900">30-day performance</h2>
				{#if data.metrics.length}
					<div class="mt-4 overflow-x-auto">
						<table class="min-w-full text-sm text-gray-700">
							<thead class="text-xs uppercase tracking-wide text-gray-500">
								<tr>
									<th class="px-4 py-2 text-left">Date</th>
									<th class="px-4 py-2 text-right">Impressions</th>
									<th class="px-4 py-2 text-right">Clicks</th>
									<th class="px-4 py-2 text-right">Conversions</th>
									<th class="px-4 py-2 text-right">Spend ($)</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each data.metrics as metric}
									<tr>
										<td class="px-4 py-2">{metric.metric_date}</td>
										<td class="px-4 py-2 text-right">{Number(metric.impressions ?? 0).toLocaleString()}</td>
										<td class="px-4 py-2 text-right">{Number(metric.clicks ?? 0).toLocaleString()}</td>
										<td class="px-4 py-2 text-right">{Number(metric.conversions ?? 0).toLocaleString()}</td>
										<td class="px-4 py-2 text-right">{Number((metric.spend_cents ?? 0) / 100).toLocaleString()}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="mt-3 text-sm text-gray-500">No performance metrics recorded yet.</p>
				{/if}
			</section>
</div>
