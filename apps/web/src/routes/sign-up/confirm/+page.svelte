<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import Button from '$lib/components/Button.svelte';

	let { data } = $props();
	const email = data.email;
	let resendMessage = $state<string | null>(null);
	let resendError = $state<string | null>(null);
	let isResending = $state(false);
	const infoMessage = $derived(
		`We sent a confirmation email to ${email}. Please click the link inside to activate your account.`
	);

	async function resendConfirmation() {
		resendError = null;
		resendMessage = null;
		isResending = true;
		try {
			const formData = new FormData();
			formData.set('email', email);
			const response = await fetch('/sign-up/resend', {
				method: 'POST',
				body: formData,
			});

			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.error ?? 'Unable to resend confirmation email.');
			}

			resendMessage = 'Email sent. Please check your inbox.';
		} catch (error) {
			resendError = error instanceof Error ? error.message : 'Unable to resend confirmation email.';
		} finally {
			isResending = false;
		}
	}
</script>

<div class="min-h-screen bg-gray-50">
	<div class="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-12 text-center">
		<Logo size="md" />
		<h1 class="mt-8 text-3xl font-semibold text-gray-900">Confirm your email</h1>
		<p class="mt-3 text-sm text-gray-600">{infoMessage}</p>

		<div class="mt-8 w-full max-w-sm">
			<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
				<div class="h-full w-1/2 animate-loading bg-[#FF6F61]"></div>
			</div>
			<p class="mt-3 text-xs text-gray-500">
				Keep this tab open while you verify. Once you’re confirmed, return to sign in.
			</p>
		</div>

		{#if resendMessage}
			<div class="mt-6 w-full max-w-sm rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
				{resendMessage}
			</div>
		{/if}
		{#if resendError}
			<div class="mt-6 w-full max-w-sm rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
				{resendError}
			</div>
		{/if}

		<div class="mt-8 flex flex-col gap-4 sm:flex-row">
			<Button variant="outline" href="/sign-in" class="justify-center">I've verified, sign me in</Button>
			<Button type="button" class="justify-center" onclick={resendConfirmation} disabled={isResending}>
				{isResending ? 'Sending…' : 'Resend email'}
			</Button>
		</div>

		<p class="mt-6 text-xs text-gray-500">
			Didn’t receive anything? Check your spam folder or add support@penny.ai to your contacts, then resend.
		</p>
	</div>
</div>

<style>
	@keyframes loading {
		0% {
			transform: translateX(-100%);
		}
		50% {
			transform: translateX(10%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	.animate-loading {
		animation: loading 1.5s ease-in-out infinite;
	}
</style>
