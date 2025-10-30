<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$lib/components/Button.svelte';

	let { data } = $props();

	const pageStore = page;
	const form = $derived($pageStore.form ?? null);

	const campaigns = data.campaigns ?? [];
	const influencers = data.influencers ?? [];
	const brandLabel = data.profile?.full_name ?? 'your brand';

let searchQuery = $state('');
let platformFilter = $state('all');
let selectedCampaignId = $state<string | null>(campaigns[0]?.id ?? null);
let assignmentCampaignId = $state<string | null>(campaigns[0]?.id ?? null);
let assignmentCampaignName = $state<string | null>(campaigns[0]?.name ?? null);
let platforms = $state<string[]>([]);
let filteredInfluencers = $state(influencers);
let disableAssignments = $state<boolean>(!(campaigns[0]?.id));
let campaignFilter = $state('all');

	$effect(() => {
		assignmentCampaignId = selectedCampaignId ?? campaigns[0]?.id ?? null;
	});

	$effect(() => {
		assignmentCampaignName = assignmentCampaignId
			? campaigns.find((campaign) => campaign.id === assignmentCampaignId)?.name ?? null
			: null;
	});

	$effect(() => {
		platforms = Array.from(
			influencers.reduce((set, influencer) => {
				if (influencer.platform) set.add(influencer.platform);
				return set;
			}, new Set<string>())
		).sort();
	});

	$effect(() => {
		const normalizedSearch = searchQuery.trim().toLowerCase();
		const filtered = influencers
			.filter((influencer) => {
				const haystack = [
					influencer.display_name ?? '',
					influencer.handle ?? '',
					influencer.location ?? '',
				]
					.join(' ')
					.toLowerCase();
				const matchesSearch = normalizedSearch ? haystack.includes(normalizedSearch) : true;
				const matchesPlatform = platformFilter === 'all' || influencer.platform === platformFilter;
				return matchesSearch && matchesPlatform;
			})
			.slice(0, 50);
		filteredInfluencers = filtered;
	});

	$effect(() => {
		disableAssignments = !assignmentCampaignId;
	});

	$effect(() => {
		const nextFilter = selectedCampaignId ?? 'all';
		if (campaignFilter !== nextFilter) {
			campaignFilter = nextFilter;
		}
	});

	$effect(() => {
		const nextSelected = campaignFilter === 'all' ? null : campaignFilter;
		if (selectedCampaignId !== nextSelected) {
			selectedCampaignId = nextSelected;
		}
	});

</script>

<div class="max-w-6xl mx-auto px-6 lg:px-12 py-12 space-y-10">
		<section class="space-y-3">
			<p class="text-xs uppercase tracking-wide text-gray-500">Influencer directory</p>
			<h1 class="text-3xl font-semibold text-gray-900">Build your next creator shortlist</h1>
			<p class="text-sm text-gray-500">
				Browsing {influencers.length} creators picked for {brandLabel}. Filter by platform or keyword to narrow your list.
			</p>
		</section>

		<section class="bg-white border border-gray-200 rounded-3xl shadow-sm p-6 space-y-4">
			{#if form?.error}
				<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{form.error}
				</div>
			{/if}
			{#if form?.success}
				<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					Influencer added to the campaign pipeline.
				</div>
			{/if}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<div class="relative lg:col-span-2">
					<input
						type="search"
						bind:value={searchQuery}
						placeholder="Search name, handle, or location"
						class="w-full rounded-2xl border border-gray-200 px-5 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF6F61]"
					/>
				</div>
				<div class="lg:col-span-1">
					<select
						bind:value={platformFilter}
						class="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF6F61]"
					>
						<option value="all">All platforms</option>
						{#each platforms as platform}
							<option value={platform}>{platform}</option>
						{/each}
					</select>
				</div>
				<div class="lg:col-span-1">
					<select
						bind:value={campaignFilter}
						class="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF6F61]"
					>
						<option value="all">All campaigns</option>
						{#each campaigns as campaign}
							<option value={campaign.id}>{campaign.name}</option>
						{/each}
					</select>
				</div>
			</div>
		</section>

		<section class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
			{#if filteredInfluencers.length}
				{#each filteredInfluencers as influencer}
					<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
						<div class="flex items-start justify-between">
							<div>
								<h2 class="text-lg font-semibold text-gray-900">{influencer.display_name ?? 'Unknown'}</h2>
								<p class="text-sm text-gray-500">{influencer.handle ?? '—'}</p>
							</div>
							<span class="rounded-full bg-gray-100 px-3 py-1 text-xs capitalize text-gray-600">{influencer.platform ?? 'platform tbd'}</span>
						</div>
						<div class="grid grid-cols-2 gap-3 text-sm text-gray-600">
								<div>
									<p class="text-xs uppercase tracking-wide text-gray-500">Followers</p>
									<p class="mt-1 font-semibold text-gray-900">{influencer.follower_count?.toLocaleString() ?? '—'}</p>
								</div>
								<div>
									<p class="text-xs uppercase tracking-wide text-gray-500">Engagement</p>
									<p class="mt-1 font-semibold text-gray-900">{influencer.engagement_rate ?? '—'}%</p>
								</div>
								<div>
									<p class="text-xs uppercase tracking-wide text-gray-500">Location</p>
									<p class="mt-1">{influencer.location ?? '—'}</p>
								</div>
								<div>
									<p class="text-xs uppercase tracking-wide text-gray-500">Verticals</p>
									<p class="mt-1">{influencer.verticals?.slice(0, 3).join(', ') ?? 'General'}</p>
								</div>
							</div>
						<form method="POST" action="?/assign" class="space-y-2">
							<input type="hidden" name="campaign_id" value={assignmentCampaignId ?? ''}>
							<input type="hidden" name="influencer_id" value={influencer.id}>
							<Button
								type="submit"
								class="w-full justify-center"
								disabled={disableAssignments}
							>
				{#if assignmentCampaignId}
					Add to {assignmentCampaignName ?? 'campaign'}
				{:else}
					Select a campaign first
				{/if}
							</Button>
						</form>
						</article>
					{/each}
				{:else}
					<p class="text-sm text-gray-500">No influencers match your filters yet.</p>
				{/if}
			</section>
</div>
