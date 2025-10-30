<script lang="ts">
	import Button from './Button.svelte';
	import Logo from './Logo.svelte';
</script>

<section class="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50">
	<div class="max-w-7xl mx-auto text-center">
		<!-- Main Headline -->
		<h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-8">
			DIME AI – <span class="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">Kickstart</span> Your<br />
			Influencer Marketing Now.
		</h1>

		<!-- Feature Pills -->
		<div class="flex flex-wrap justify-center gap-4 mb-10">
			<div class="flex items-center gap-2 text-gray-700">
				<span class="text-green-500">🤝</span>
				<span>Get creators to your store immediately</span>
			</div>
			<div class="flex items-center gap-2 text-gray-700">
				<span class="text-green-500">💬</span>
				<span>Get matched. Get replies. Get sales.</span>
			</div>
			<div class="flex items-center gap-2 text-gray-700">
				<span class="text-green-500">🤝</span>
				<span>DIME AI = Influencers now.</span>
			</div>
		</div>

		<!-- CTA Button -->
		<div class="mb-16">
			<Button size="lg" href="/sign-up">Get Started For Free</Button>
		</div>

		<!-- Dashboard Preview -->
		<div class="relative max-w-5xl mx-auto">
			<div class="bg-black rounded-t-3xl p-2 shadow-2xl">
				<div class="bg-white rounded-t-2xl overflow-hidden">
					<!-- Browser Chrome -->
					<div class="flex items-center gap-2 px-4 py-3 bg-gray-100 border-b">
						<Logo size="sm" />
						<div class="flex items-center gap-2 px-4 py-2 bg-white rounded border border-gray-200 flex-1">
							<span class="text-sm">📄</span>
							<span class="text-sm text-gray-600">Student AI Campaign</span>
						</div>
					</div>

					<!-- Dashboard Content -->
					<div class="flex">
						<!-- Sidebar -->
						<div class="w-64 bg-gray-50 border-r p-4">
							<Button size="sm" class="w-full mb-4">New Campaign</Button>
				<nav class="space-y-2 text-sm">
					<a href="/settings" class="flex items-center gap-2 text-gray-600 hover:text-black py-2">
						<span>⚙️</span> Settings
					</a>
					<a href="/account" class="flex items-center gap-2 text-gray-600 hover:text-black py-2">
						<span>👤</span> My Account
					</a>
					<a href="/learn/how-it-works" class="flex items-center gap-2 text-gray-600 hover:text-black py-2">
						<span>ℹ️</span> How it works
					</a>
				</nav>
				<div class="mt-6">
					<p class="text-xs font-semibold text-gray-500 mb-2">Campaign</p>
					<a href="/campaign/student-ai" class="block text-sm text-gray-700 hover:bg-gray-100 px-2 py-2 rounded">Student AI Campaign</a>
					<a href="/campaign/july-fourth" class="block text-sm text-gray-600 hover:bg-gray-100 px-2 py-2 rounded">July Fourth Campaign</a>
					<a href="/campaign/club-free-drinks" class="block text-sm text-gray-600 hover:bg-gray-100 px-2 py-2 rounded">Club Free Drinks Campaign</a>
				</div>
						</div>

						<!-- Main Content -->
						<div class="flex-1 p-8">
							<!-- Chat Interface -->
							<div class="space-y-6">
								<div class="flex items-start gap-3">
									<div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white">
										🤖
									</div>
									<div class="flex-1">
										<div class="bg-gray-100 rounded-2xl p-4 inline-block">
											<p class="text-sm">What's your website or landing page for this campaign?</p>
										</div>
										<div class="mt-2 bg-black text-white rounded-full px-4 py-2 inline-block text-sm">
											www.sambalkampung.id
										</div>
									</div>
								</div>

								<div class="flex items-start gap-3">
									<div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white">
										🤖
									</div>
									<div class="flex-1">
										<div class="bg-gray-100 rounded-2xl p-4 inline-block">
											<p class="text-sm">Thanks! 🔥<br />Next, what kind of influencer profiles do you want to target?</p>
											<p class="text-xs text-gray-600 mt-2">You can mention keywords, interests, or niches (e.g., foodies, skincare, fitness, tech).</p>
										</div>
										<div class="mt-2 bg-black text-white rounded-full px-4 py-2 inline-block text-sm">
											Food bloggers
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
