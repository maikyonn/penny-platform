<script lang="ts">
	import Button from './Button.svelte';
</script>

<section class="py-20 px-4 sm:px-6 lg:px-8 bg-white">
	<div class="max-w-7xl mx-auto">
		<div class="grid lg:grid-cols-2 gap-16 items-center">
			<!-- Text Content -->
			<div class="space-y-8">
				<h2 class="text-4xl sm:text-5xl font-bold leading-tight">
					Influencer Marketing.<br />
					Finally Automated.
				</h2>

				<p class="text-lg text-gray-600">
					DIME AI Democratizes Influencer Marketing For Brands Of All Sizes — From Local Shops To Fast Scaling Startups.
				</p>

				<Button size="lg" href="/get-started">Get Started</Button>
			</div>

			<!-- Influencer Profile Card -->
			<div class="relative">
				<div class="rounded-3xl overflow-hidden shadow-2xl">
					<!-- Background Image -->
					<div class="relative h-[500px] bg-gradient-to-br from-blue-400 to-purple-300">
						<!-- Influencer profile overlay -->
						<div class="absolute bottom-6 right-6 bg-white rounded-2xl p-4 shadow-xl flex items-center gap-3">
							<div class="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl">
								👤
							</div>
							<div>
								<div class="font-bold">Robert Downsky</div>
								<div class="text-sm text-gray-600">
									<span class="font-medium">Follower 120K</span>
									<span class="mx-2">•</span>
									<span>NYC</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
