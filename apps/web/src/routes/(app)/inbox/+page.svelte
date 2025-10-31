<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$lib/components/Button.svelte';

	let { data } = $props();

	const pageStore = page;
	const form = $derived($pageStore.form ?? null);
	const threads = data.threads ?? [];
	let filterStatus = $state<'all' | 'invited' | 'in_conversation' | 'accepted'>('all');
	let searchTerm = $state('');
	let messageDraft = $state('');
	let selectedThreadId = $state<string | null>(threads[0]?.id ?? null);

	const messageError = $derived(form?.error ?? null);
	const filteredThreads = $derived(threads
		.filter((thread) => {
			const matchesStatus = filterStatus === 'all' || thread.status === filterStatus;
			const haystack = [thread.influencer?.display_name ?? '', thread.influencer?.handle ?? '']
				.join(' ')
				.toLowerCase();
			const matchesSearch = searchTerm
				? haystack.includes(searchTerm.toLowerCase())
				: true;
			return matchesStatus && matchesSearch;
		}));
	const selectedThread = $derived(filteredThreads.find((thread) => thread.id === selectedThreadId) ?? filteredThreads[0] ?? null);
	const disableComposer = $derived(!selectedThread);

	$effect(() => {
		if (selectedThread && selectedThread.id !== selectedThreadId) {
			selectedThreadId = selectedThread.id;
		}
	});

	$effect(() => {
		if (form?.success) {
			messageDraft = '';
		}
	});

</script>

<div class="max-w-6xl mx-auto px-6 lg:px-12 py-12 space-y-8">
		<header class="flex flex-col gap-2">
			<p class="text-xs uppercase tracking-wide text-gray-500">Inbox</p>
			<h1 class="text-3xl font-semibold text-gray-900">Creator conversations</h1>
			<p class="text-sm text-gray-500">Review replies, follow-ups, and next steps in one place.</p>
		</header>

		<section class="grid gap-6 lg:grid-cols-[320px,1fr]">
			<aside class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
				<div class="flex flex-col gap-3">
					<Button class="w-full justify-center" href="/campaign">Back to campaigns</Button>
					<Button variant="outline" class="w-full justify-center" href="/support">Contact support</Button>
				</div>

				<div class="space-y-3">
					<div class="relative">
						<input
							type="search"
							bind:value={searchTerm}
							placeholder="Search creator"
							class="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6F61] focus:border-transparent"
						/>
					</div>
					<select
						bind:value={filterStatus}
						class="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6F61] focus:border-transparent"
					>
						<option value="all">All statuses</option>
						<option value="invited">Invited</option>
						<option value="in_conversation">In conversation</option>
						<option value="accepted">Accepted</option>
					</select>
				</div>

				<div class="max-h-[28rem] overflow-y-auto -mx-2 px-2">
					{#if filteredThreads.length}
						<ul class="space-y-2">
							{#each filteredThreads as thread}
								<li>
									<button
										type="button"
										onclick={() => (selectedThreadId = thread.id)}
										class={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
											selectedThreadId === thread.id
												? 'border-[#FF6F61] bg-[#FFF1ED] text-gray-900 shadow-sm'
												: 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
										}`}
									>
										<span class="block font-semibold text-gray-900">{thread.influencer?.display_name ?? 'Unknown creator'}</span>
										<span class="text-xs text-gray-500">{thread.influencer?.handle ?? '—'} · {thread.channel}</span>
										<span class="text-xs text-gray-400">
											Last message {thread.last_message_at ? new Date(thread.last_message_at).toLocaleString() : '—'}
										</span>
									</button>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
							No conversations yet. Reach out to creators from the campaign view.
						</p>
					{/if}
				</div>
			</aside>

			<article class="rounded-3xl border border-gray-200 bg-white shadow-sm">
				{#if selectedThread}
					<header class="flex flex-col gap-3 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p class="text-sm font-semibold text-gray-900">{selectedThread.influencer?.display_name ?? 'Unknown creator'}</p>
							<p class="text-xs text-gray-500">{selectedThread.influencer?.handle ?? '—'} · {selectedThread.channel}</p>
						</div>
						<Button variant="outline" href={`/campaign/${selectedThread.campaign_id ?? ''}`}>View campaign</Button>
					</header>

					<div class="max-h-[32rem] overflow-y-auto px-6 py-6 space-y-4">
						{#if selectedThread.messages.length}
							{#each selectedThread.messages as message}
								<div class={`rounded-2xl px-4 py-3 text-sm ${
									message.direction === 'brand'
										? 'bg-[#FFF1ED] text-gray-800'
										: message.direction === 'assistant'
										? 'bg-gray-200 text-gray-700'
										: 'bg-white border border-gray-200 text-gray-800'
								}`}>
									<p class="text-xs uppercase tracking-wide text-gray-500 mb-1">
										{message.direction === 'brand' ? 'You' : 'Influencer'} · {new Date(message.sent_at).toLocaleString()}
									</p>
									<p>{message.body}</p>
								</div>
							{/each}
						{:else}
							<p class="text-sm text-gray-500">No messages exchanged yet.</p>
						{/if}
					</div>

					<footer class="border-t border-gray-100 px-6 py-4">
						{#if messageError}
							<div class="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
								{messageError}
							</div>
						{/if}
		<form method="POST" action="?/sendMessage" class="space-y-3">
			<input type="hidden" name="thread_id" value={selectedThread.id}>
							<input type="hidden" name="channel" value={selectedThread.channel}>
							<textarea
								rows="3"
								name="message"
								class="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6F61] focus:border-transparent"
								placeholder="Write a reply"
								bind:value={messageDraft}
								required
								disabled={disableComposer}
							></textarea>
							<div class="flex items-center justify-between">
								<button type="button" class="text-sm text-gray-500 hover:text-gray-700" disabled={disableComposer}>Attach file</button>
								<Button type="submit" disabled={disableComposer}>Send</Button>
							</div>
						</form>
					</footer>
				{:else}
					<div class="flex flex-col items-center justify-center px-6 py-20 text-center text-sm text-gray-500">
						<p>Select a thread on the left to view messages.</p>
					</div>
				{/if}
			</article>
		</section>
</div>
