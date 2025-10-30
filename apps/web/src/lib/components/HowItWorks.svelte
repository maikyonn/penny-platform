<script lang="ts">
	import Badge from './Badge.svelte';
</script>

<section class="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
	<div class="max-w-7xl mx-auto">
		<!-- Section Header -->
		<div class="text-center mb-16">
			<Badge variant="blue">EASY SETUP, INSTANT RESULTS</Badge>
			<h2 class="text-4xl sm:text-5xl font-bold mt-6 mb-4">How DIME AI Works</h2>
			<p class="text-xl text-gray-600">A Simple 3-Step Process To Connect With The Right Creators.</p>
		</div>

		<!-- Steps Grid -->
		<div class="grid lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto">
			<!-- Step Cards -->
			<div class="space-y-8">
				<!-- Step 01 -->
				<div class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
					<div class="w-14 h-14 rounded-full bg-orange-500 text-white flex items-center justify-center text-xl font-bold mb-4">
						01
					</div>
					<h3 class="text-2xl font-bold mb-3">Share your website + audience</h3>
					<p class="text-gray-600">Tell us your brand and who you're trying to reach.</p>
				</div>

				<!-- Step 02 -->
				<div class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
					<div class="w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl font-bold mb-4">
						02
					</div>
					<h3 class="text-2xl font-bold mb-3">Get Perfect Matches Instantly</h3>
					<p class="text-gray-600">We scan and deliver a curated list of creators who are the right fit — no bots, no fluff.</p>
				</div>

				<!-- Step 03 -->
				<div class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
					<div class="w-14 h-14 rounded-full bg-cyan-500 text-white flex items-center justify-center text-xl font-bold mb-4">
						03
					</div>
					<h3 class="text-2xl font-bold mb-3">Automated Outreach, Real Results</h3>
					<p class="text-gray-600">Your personalized message is automatically copied to your clipboard and ready to go. You'll wake up to real DMs and real interest from creators excited to collaborate.</p>
				</div>
			</div>

			<!-- Dashboard Preview -->
			<div class="lg:sticky lg:top-8">
				<div class="bg-black rounded-3xl p-2 shadow-2xl">
					<div class="bg-white rounded-2xl overflow-hidden">
						<!-- Header -->
						<div class="flex items-center gap-3 px-6 py-4 border-b">
							<div class="flex items-center gap-2">
					<div class="w-8 h-8 bg-[#FF6F61] rounded flex items-center justify-center font-bold">
									🛡️
								</div>
								<span class="font-bold">Dime</span>
							</div>
							<div class="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded flex-1 ml-4">
								<span>📄</span>
								<span class="text-sm font-medium">Dashboard</span>
							</div>
						</div>

						<!-- Sidebar + Content -->
						<div class="flex h-[500px]">
							<!-- Sidebar -->
							<div class="w-48 bg-gray-50 border-r p-4">
				<button class="w-full bg-[#FF6F61] hover:bg-[#ff846f] text-black font-medium px-4 py-2 rounded-lg mb-4 text-sm">
									New Campaign
								</button>
				<nav class="space-y-1 text-sm">
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
					<a href="/campaign/student-ai" class="block text-xs text-gray-700 hover:bg-gray-100 px-2 py-2 rounded">Student AI Campaign</a>
					<a href="/campaign/july-fourth" class="block text-xs text-gray-600 hover:bg-gray-100 px-2 py-2 rounded">July Fourth Campaign</a>
					<a href="/campaign/club-free-drinks" class="block text-xs text-gray-600 hover:bg-gray-100 px-2 py-2 rounded">Club Free Drinks Campaign</a>
				</div>
							</div>

							<!-- Main Content -->
							<div class="flex-1 p-6 overflow-y-auto">
								<div class="mb-4">
									<div class="flex items-center justify-between mb-4">
					<div class="bg-[#FF6F61] px-4 py-2 rounded-full">
											<span class="font-medium text-sm">Student AI campaign</span>
										</div>
									</div>
									<h3 class="text-lg font-bold mb-2">100 Profiles Found</h3>
								</div>

								<!-- Influencer List -->
								<div class="space-y-2">
									{#each [
										{ name: 'Jane Cooper', handle: '@janecooper' },
										{ name: 'Esther Howard', handle: '@estherhoward' },
										{ name: 'Cameron Williamson', handle: '@cameronwilli' },
										{ name: 'Leslie Alexander', handle: '@lesliealexander01' },
										{ name: 'Jenny Wilson', handle: '@jennywilson' },
										{ name: 'Robert Fox', handle: '@robertfox' },
										{ name: 'Jacob Jones', handle: '@jacobjones' },
										{ name: 'Brooklyn Simmons', handle: '@brooklynsimmons' },
										{ name: 'Cody Fisher', handle: '@codyfisher' }
									] as influencer}
										<div class="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
											<input type="checkbox" class="w-4 h-4" />
											<div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400"></div>
											<div class="flex-1">
												<div class="text-sm font-medium">{influencer.name}</div>
											</div>
											<a href="/" class="text-blue-600 text-xs hover:underline">{influencer.handle}</a>
										</div>
									{/each}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
