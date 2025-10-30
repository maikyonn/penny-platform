<script lang="ts">
	import Button from '$lib/components/Button.svelte';

	let { data } = $props();

	const campaigns = data.campaigns ?? [];
	const campaignCounts = data.campaignCounts ?? { total: 0, active: 0, draft: 0, completed: 0 };
	const influencerSummary = data.influencerSummary ?? { total: 0, invited: 0, accepted: 0, in_conversation: 0, completed: 0 };
	const metricsSummary = data.metricsSummary ?? { impressions: 0, clicks: 0, conversions: 0, spend_cents: 0 };
	const userDisplayName = data.profile?.full_name ?? data.session?.user?.email ?? 'there';
	const globalNotice = data.error ?? null;

	const formatCount = (value: number | null | undefined) => Number(value ?? 0).toLocaleString();
	const formatSpend = (cents: number | null | undefined) => Number((cents ?? 0) / 100).toLocaleString();

	const performanceMetrics = [
		{
			label: 'Active campaigns',
			value: campaignCounts.active,
			accent: 'bg-[#FFF1ED]',
			subtext: `${campaignCounts.total} total`,
		},
		{
			label: 'Influencers invited',
			value: influencerSummary.invited,
			accent: 'bg-[#F4F2FF]',
			subtext: `${influencerSummary.total} prospects`,
		},
		{
			label: 'In conversations',
			value: influencerSummary.in_conversation,
			accent: 'bg-[#EDF6FF]',
			subtext: `${influencerSummary.accepted} accepted`,
		},
		{
			label: 'Spend (30d)',
			value: `$${formatSpend(metricsSummary.spend_cents)}`,
			accent: 'bg-[#E8F9F1]',
			subtext: `${formatCount(metricsSummary.impressions)} impressions`,
		},
	];

	const hasMetrics = ['impressions', 'clicks', 'conversions', 'spend_cents'].some(
		(key) => Number((metricsSummary as Record<string, number | null | undefined>)[key] ?? 0) > 0
	);
</script>

<div class="min-h-screen bg-gray-50">
	<div class="w-full max-w-6xl mx-auto px-6 lg:px-12 py-12 space-y-12">
		<section class="text-center space-y-6">
			{#if globalNotice}
				<div class="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
					{globalNotice}
				</div>
			{/if}
			<div class="inline-flex items-center justify-center w-24 h-24 bg-white rounded-full shadow-sm">
				<span class="text-5xl">📊</span>
			</div>
			<div class="space-y-4">
				<h1 class="text-4xl md:text-5xl font-bold text-gray-900">Campaign dashboard</h1>
				<p class="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
					Welcome back, {userDisplayName}. Review your pipeline health, creator outreach, and performance trends in one place.
				</p>
				<div class="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
					<Button href="/campaign" class="justify-center bg-[#FF6F61] text-gray-900 hover:bg-[#ff846f]">
						Create campaign
					</Button>
					<Button variant="outline" href="/influencers" class="justify-center">
						Browse influencers
					</Button>
				</div>
			</div>
		</section>

		<section class="space-y-6">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="text-xs uppercase tracking-wide text-gray-500">Overview</p>
					<h2 class="text-2xl font-semibold text-gray-900">Pipeline snapshot</h2>
					<p class="text-sm text-gray-500">High-level metrics to gauge your outreach momentum.</p>
				</div>
				{#if campaigns.length}
					<Button variant="outline" href={`/campaign/${campaigns[0].id}`} class="justify-center">
						View latest campaign
					</Button>
				{/if}
			</div>

			<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{#each performanceMetrics as metric}
					<article class={`rounded-2xl border border-gray-200 bg-white shadow-sm p-5 ${metric.accent}`}>
						<p class="text-sm text-gray-500">{metric.label}</p>
						<p class="mt-3 text-3xl font-semibold text-gray-900">{metric.value}</p>
						<p class="mt-2 text-xs text-gray-500">{metric.subtext}</p>
					</article>
				{/each}
			</div>

			<div class="grid gap-6 lg:grid-cols-2">
				<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 class="text-lg font-semibold text-gray-900">Influencer pipeline</h3>
					<p class="text-sm text-gray-500 mb-4">Snapshot of where creators sit in your outreach this month.</p>
					<ul class="space-y-3 text-sm text-gray-700">
						<li class="flex items-center justify-between"><span>Total prospects</span><span class="font-semibold">{influencerSummary.total}</span></li>
						<li class="flex items-center justify-between"><span>Invited</span><span class="font-semibold">{influencerSummary.invited}</span></li>
						<li class="flex items-center justify-between"><span>In conversation</span><span class="font-semibold">{influencerSummary.in_conversation}</span></li>
						<li class="flex items-center justify-between"><span>Accepted</span><span class="font-semibold">{influencerSummary.accepted}</span></li>
						<li class="flex items-center justify-between"><span>Completed</span><span class="font-semibold">{influencerSummary.completed}</span></li>
					</ul>
				</article>
				<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 class="text-lg font-semibold text-gray-900">30-day performance</h3>
					<p class="text-sm text-gray-500 mb-4">Use this quick read before diving into deeper analytics.</p>
					{#if hasMetrics}
						<div class="grid grid-cols-2 gap-4 text-sm text-gray-700">
							<div>
								<p class="text-xs uppercase tracking-wide text-gray-500">Impressions</p>
								<p class="mt-1 text-xl font-semibold">{formatCount(metricsSummary.impressions)}</p>
							</div>
							<div>
								<p class="text-xs uppercase tracking-wide text-gray-500">Clicks</p>
								<p class="mt-1 text-xl font-semibold">{formatCount(metricsSummary.clicks)}</p>
							</div>
							<div>
								<p class="text-xs uppercase tracking-wide text-gray-500">Conversions</p>
								<p class="mt-1 text-xl font-semibold">{formatCount(metricsSummary.conversions)}</p>
							</div>
							<div>
								<p class="text-xs uppercase tracking-wide text-gray-500">Spend</p>
								<p class="mt-1 text-xl font-semibold">${formatSpend(metricsSummary.spend_cents)}</p>
							</div>
						</div>
					{:else}
						<p class="text-sm text-gray-500">No performance data yet. Launch a campaign to start collecting metrics.</p>
					{/if}
				</article>
			</div>
		</section>

		<section class="bg-white border border-gray-200 rounded-3xl shadow-sm">
			<header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-gray-100 px-6 py-5">
				<div>
					<h2 class="text-lg font-semibold text-gray-900">Campaigns</h2>
					<p class="text-sm text-gray-500">Monitor status, objectives, and timing for each initiative.</p>
				</div>
				<Button href="/campaign" class="justify-center">New campaign</Button>
			</header>
			{#if campaigns.length}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-100 text-left">
						<thead class="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
							<tr>
								<th class="px-6 py-3">Name</th>
								<th class="px-6 py-3">Status</th>
								<th class="px-6 py-3">Objective</th>
								<th class="px-6 py-3">Timeline</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 text-sm text-gray-700">
							{#each campaigns as campaign}
								<tr class="hover:bg-gray-50 transition-colors">
									<td class="px-6 py-4">
										<a href={'/campaign/' + campaign.id} class="font-medium text-gray-900 hover:underline">{campaign.name}</a>
									</td>
									<td class="px-6 py-4 capitalize">{campaign.status.replace('_', ' ')}</td>
									<td class="px-6 py-4 text-gray-600">{campaign.objective ?? '—'}</td>
									<td class="px-6 py-4 text-gray-600">
										{#if campaign.start_date}
											<span>{campaign.start_date}</span>
										{:else}
											<span>Not scheduled</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="px-6 py-12 text-center text-sm text-gray-500">
					You haven't launched a campaign yet. Create your first campaign to fill this view.
				</div>
			{/if}
		</section>
	</div>
</div>
