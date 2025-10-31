<script lang="ts">
	import Logo from './Logo.svelte';
	import Button from './Button.svelte';

	interface Props {
		firebaseUser?: { email: string | null } | null;
		profile?: {
			full_name?: string | null;
		} | null;
	}

	let {
		firebaseUser = null,
		profile = null
	}: Props = $props();

	const displayName = $derived(() => profile?.full_name ?? firebaseUser?.email ?? 'there');
</script>

<nav class="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between h-16">
			<!-- Logo -->
			<Logo />

			<!-- Navigation Links -->
			<div class="hidden md:flex items-center gap-8">
				<a href="/" class="text-gray-700 hover:text-black transition-colors">Home</a>
				<a href="/how-it-works" class="text-gray-700 hover:text-black transition-colors">How it works</a>
				<a href="/for-b2b" class="text-gray-700 hover:text-black transition-colors">For B2B</a>
				<a href="/pricing" class="text-gray-700 hover:text-black transition-colors">Pricing</a>
				<a href="/custom-solution" class="text-gray-700 hover:text-black transition-colors">Custom Solution</a>
			</div>

			<!-- Auth Buttons -->
			<div class="flex items-center gap-3">
		{#if firebaseUser}
			<div class="hidden sm:flex flex-col items-end text-xs text-gray-500">
				<span class="font-semibold text-gray-800">{displayName()}</span>
			</div>
					<a href="/campaign" class="text-gray-700 hover:text-black transition-colors hidden sm:inline-block">
						Dashboard
					</a>
					<form method="POST" action="/logout">
						<Button type="submit" size="sm" variant="outline">Sign out</Button>
					</form>
				{:else}
					<a href="/sign-up" class="text-gray-700 hover:text-black transition-colors hidden sm:inline-block">
						Sign up
					</a>
					<Button size="sm" href="/sign-in">Sign in</Button>
				{/if}
			</div>
		</div>
	</div>
</nav>
