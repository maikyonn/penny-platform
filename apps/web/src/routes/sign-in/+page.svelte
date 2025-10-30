<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Logo from '$lib/components/Logo.svelte';

let { data } = $props();

const getForm = () => (data as { form?: any })?.form ?? null;
const getUrl = () => (data as { url?: URL })?.url ?? null;

const form = $derived(() => getForm());
const formAction = $derived(() => form()?.action ?? 'password');
const isMagicLinkAction = $derived(() => formAction() === 'magic_link');

let email = $state('');
let password = $state('');
const passwordErrorMessage = $derived(() => (!isMagicLinkAction() ? form()?.error : null) ?? getUrl()?.searchParams?.get('error') ?? null);
const magicLinkErrorMessage = $derived(() => (isMagicLinkAction() ? form()?.error ?? null : null));
const magicLinkSuccessMessage = $derived(() => (isMagicLinkAction() && form()?.success ? form()?.message ?? 'Magic link sent! Check your email to finish signing in.' : null));

$effect(() => {
	const currentForm = form();
	if (currentForm?.values?.email !== undefined) {
		email = currentForm.values.email;
	}
	if (currentForm) {
		password = '';
	}
});
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
	<div class="w-full max-w-md">
		<!-- Logo -->
		<div class="flex justify-center mb-8">
			<Logo size="lg" />
		</div>

		<!-- Sign In Card -->
		<div class="bg-white rounded-3xl shadow-xl p-8 md:p-10">
			<h1 class="text-3xl font-bold text-center mb-2">Welcome back</h1>
			<p class="text-gray-600 text-center mb-8">Sign in to your DIME AI account</p>

	{#if passwordErrorMessage()}
		<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{passwordErrorMessage()}
		</div>
	{/if}

		<form method="POST" action="?/password" class="space-y-6">
				<!-- Email Input -->
		<div>
			<label for="email" class="block text-sm font-medium text-gray-700 mb-2">
				Email address
			</label>
			<input
				id="email"
				name="email"
				type="email"
				bind:value={email}
				required
			class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF6F61] focus:border-transparent outline-none transition"
				placeholder="you@example.com"
			/>
		</div>

		<!-- Password Input -->
		<div>
			<label for="password" class="block text-sm font-medium text-gray-700 mb-2">
				Password
			</label>
			<input
				id="password"
				name="password"
				type="password"
				bind:value={password}
				required
			class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF6F61] focus:border-transparent outline-none transition"
				placeholder="Enter your password"
			/>
		</div>

				<!-- Forgot Password -->
				<div class="flex items-center justify-between">
					<label class="flex items-center">
				<input type="checkbox" class="w-4 h-4 rounded border-gray-300 text-[#FF6F61] focus:ring-[#FF6F61]" />
						<span class="ml-2 text-sm text-gray-600">Remember me</span>
					</label>
					<a href="/forgot-password" class="text-sm text-gray-600 hover:text-black transition">
						Forgot password?
					</a>
				</div>

				<!-- Sign In Button -->
			<Button type="submit" size="lg" class="w-full">
				Sign in
			</Button>
		</form>

		<!-- TODO: Expose resend messaging once backend throttling is in place. -->

		<div class="mt-10 border-t border-gray-200 pt-8">
			<h2 class="text-lg font-semibold text-gray-800 mb-3">Prefer passwordless?</h2>
			<p class="text-sm text-gray-600 mb-6">Send yourself a secure one-time sign-in link.</p>

			{#if magicLinkSuccessMessage()}
				<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{magicLinkSuccessMessage()}
				</div>
			{/if}

			{#if magicLinkErrorMessage()}
				<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{magicLinkErrorMessage()}
				</div>
			{/if}

			<form method="POST" action="?/magic_link" class="mt-6 space-y-4">
				<div>
					<label for="magic-email" class="block text-sm font-medium text-gray-700 mb-2">
						Email address
					</label>
					<input
						id="magic-email"
						name="email"
						type="email"
						bind:value={email}
						required
						class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF6F61] focus:border-transparent outline-none transition"
						placeholder="you@example.com"
					/>
				</div>

				<Button type="submit" size="lg" class="w-full" variant="secondary">
					Send magic link
				</Button>
			</form>
		</div>

		<!-- Divider -->
		<div class="relative my-6">
			<div class="absolute inset-0 flex items-center">
				<div class="w-full border-t border-gray-200"></div>
				</div>
				<div class="relative flex justify-center text-sm">
					<span class="px-4 bg-white text-gray-500">Or continue with</span>
				</div>
			</div>

			<!-- Social Sign In -->
			<div class="grid grid-cols-2 gap-3">
				<button class="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition">
					<svg class="w-5 h-5" viewBox="0 0 24 24">
						<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
						<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
						<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
						<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
					</svg>
					<span class="text-sm font-medium">Google</span>
				</button>
				<button class="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition">
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
					</svg>
					<span class="text-sm font-medium">GitHub</span>
				</button>
			</div>

			<!-- Sign Up Link -->
		<p class="text-center text-sm text-gray-600 mt-6">
			Don't have an account?
			<a href="/sign-up" class="text-black font-medium hover:underline">Create one</a>
		</p>
		</div>

		<!-- Back to Home -->
		<div class="text-center mt-6">
			<a href="/" class="text-sm text-gray-600 hover:text-black transition">
				← Back to home
			</a>
		</div>
	</div>
</div>
