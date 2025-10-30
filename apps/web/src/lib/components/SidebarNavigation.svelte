<script lang="ts">
	import Button from '$lib/components/Button.svelte';

	interface PrimaryLink {
		label: string;
		href: string;
		variant?: 'primary' | 'secondary' | 'outline';
		class?: string;
	}

	interface SecondaryLink {
		label: string;
		href: string;
		icon: 'dashboard' | 'inbox' | 'settings' | 'account' | 'info';
	}

	const primaryLinks: PrimaryLink[] = [
		{ label: 'Create campaign', href: '/campaign' },
		{ label: 'Influencer search', href: '/influencers', variant: 'outline' },
	];

	const secondaryLinks: SecondaryLink[] = [
		{ label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
		{ label: 'Inbox', href: '/inbox', icon: 'inbox' },
		{ label: 'Settings', href: '/settings', icon: 'settings' },
		{ label: 'My account', href: '/my-account', icon: 'account' },
		{ label: 'How it works', href: '/how-it-works', icon: 'info' },
	];
</script>

<div class="flex h-full flex-1 flex-col">
	<div class="px-6 py-4 space-y-3">
		{#each primaryLinks as link}
			<Button
				class={`w-full justify-center ${link.class ?? ''}`}
				href={link.href}
				variant={link.variant ?? 'primary'}
			>
				{link.label}
			</Button>
		{/each}
	</div>

	<div class="flex-1"></div>

	<div class="px-6 pb-4 space-y-4 border-t border-gray-200">
		<nav>
			<ul class="space-y-1">
				{#each secondaryLinks as link}
					<li>
						<a
							href={link.href}
							class="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
						>
							{#if link.icon === 'dashboard'}
								<svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
								</svg>
							{:else if link.icon === 'inbox'}
								<svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5l1.5-3h15l1.5 3V18a2 2 0 01-2 2H5a2 2 0 01-2-2V7.5z" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5l9 6 9-6" />
								</svg>
							{:else if link.icon === 'settings'}
								<svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
									/>
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
							{:else if link.icon === 'account'}
								<svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
								</svg>
							{:else}
								<svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 0 0118 0z" />
								</svg>
							{/if}
							<span class="font-medium">{link.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<div class="space-y-3">
			<Button href="/pricing" class="w-full justify-center">Upgrade plan</Button>
			<form method="POST" action="/logout">
				<Button variant="outline" class="w-full justify-center" type="submit">Sign out</Button>
			</form>
		</div>
	</div>
</div>
