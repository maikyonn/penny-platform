<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import Button from '$lib/components/Button.svelte';

let { data } = $props();
const getForm = () => (data as { form?: any })?.form ?? null;
const form = $derived(() => getForm());
let email = $state(getForm()?.values?.email ?? '');
let password = $state('');
let termsAccepted = $state(false);

$effect(() => {
	const currentForm = getForm();
	if (currentForm?.values?.email !== undefined) {
		email = currentForm.values.email;
	}
	password = '';
	termsAccepted = false;
});
</script>

<div class="min-h-screen bg-gray-50">
	<div class="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 py-12">
		<a class="mb-10" href="/">
			<Logo size="md" />
		</a>
		<div class="w-full rounded-3xl bg-white p-8 shadow-xl md:p-10">
			<h1 class="text-3xl font-bold text-center text-gray-900">Create your account</h1>
			<p class="mt-2 text-center text-gray-600">Spin up influencer outreach in minutes.</p>

		{#if form()?.error}
			<div class="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{form()?.error}</div>
		{/if}

			<form method="POST" class="mt-6 space-y-6">
				<div>
					<label for="email" class="mb-2 block text-sm font-medium text-gray-700">Work email</label>
					<input
						id="email"
						name="email"
						autocomplete="email"
						required
						type="email"
						bind:value={email}
						placeholder="you@brand.com"
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF6F61]"
					/>
				</div>
				<div>
					<label for="password" class="mb-2 block text-sm font-medium text-gray-700">Password</label>
					<input
						id="password"
						name="password"
						autocomplete="new-password"
						required
						minlength="8"
						type="password"
						bind:value={password}
						placeholder="Minimum 8 characters"
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF6F61]"
					/>
				</div>
				<label class="flex items-start gap-3 text-sm text-gray-600">
					<input
						type="checkbox"
						name="terms"
						bind:checked={termsAccepted}
						class="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#FF6F61] focus:ring-[#FF6F61]"
					/>
					<span>
						I agree to the
						<a href="/terms" class="font-medium text-gray-900 underline">Terms of Service</a>
						and
						<a href="/privacy" class="font-medium text-gray-900 underline">Privacy Policy</a>.
					</span>
				</label>
				<Button type="submit" size="lg" class="w-full">Create account</Button>
			</form>

			<p class="mt-8 text-center text-sm text-gray-600">
				Already have an account?
				<a href="/sign-in" class="font-medium text-gray-900 underline">Sign in</a>
			</p>
		</div>
	</div>
</div>
