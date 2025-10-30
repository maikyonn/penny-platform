<section class="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50">
	<div class="max-w-7xl mx-auto">
		<div class="grid lg:grid-cols-2 gap-16 items-center">
			<!-- Phone Mockups -->
			<div class="relative">
				<div class="relative z-10">
					<!-- Main phone screens showing social media -->
					<div class="grid grid-cols-2 gap-4">
						{#each Array(4) as _, i}
							<div class="relative">
								<div class="bg-black rounded-[2.5rem] p-3 shadow-2xl">
									<div class="bg-white rounded-[2rem] overflow-hidden h-[400px] relative">
										<!-- Phone notch -->
										<div class="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-3xl"></div>

										<!-- Social media content placeholder -->
										<div class="absolute inset-0 bg-gradient-to-br from-pink-100 to-blue-100"></div>

										<!-- Icons overlay -->
										{#if i === 0}
											<div class="absolute top-8 left-4 right-4">
												<div class="flex gap-2 overflow-x-auto">
													{#each Array(5) as _}
														<div class="w-16 h-16 rounded-full bg-white/80 border-2 border-pink-400 flex-shrink-0"></div>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Matching score overlay -->
					<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
						<div class="bg-white rounded-2xl shadow-2xl p-6 text-center">
							<div class="text-5xl font-bold text-blue-600 mb-2">100%</div>
							<div class="text-sm text-gray-600 mb-3">Matching Score</div>
							<div class="space-y-1 text-xs text-left">
								<div class="flex justify-between gap-8">
									<span class="text-gray-600">Niche:</span>
									<span class="font-medium">Lifestyle</span>
								</div>
								<div class="flex justify-between gap-8">
									<span class="text-gray-600">Audience:</span>
									<span class="font-medium">18-24</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Text Content -->
			<div class="space-y-6">
				<h2 class="text-4xl sm:text-5xl font-bold leading-tight">
					Tired of the Hassle of<br />
					Finding Influencers?
				</h2>

				<div class="space-y-4 text-lg text-gray-600">
					<p>Searching For The Right Influencers Is Time Consuming.</p>
					<p>Current Tools Suggest Bot Accounts Or Irrelevant Matches — It's Frustrating.</p>
				</div>

				<p class="text-2xl font-bold text-black">DIME AI Fixes That.</p>
			</div>
		</div>
	</div>
</section>
