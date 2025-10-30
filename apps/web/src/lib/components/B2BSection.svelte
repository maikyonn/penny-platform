<script lang="ts">
	import Badge from './Badge.svelte';
	import Button from './Button.svelte';
</script>

<section class="py-20 px-4 sm:px-6 lg:px-8 bg-white">
	<div class="max-w-7xl mx-auto">
		<!-- Section Header -->
		<div class="text-center mb-12">
			<Badge variant="blue">FOR B2B BRANDS</Badge>
			<h2 class="text-4xl sm:text-5xl font-bold mt-6 mb-4">Are you a b2B Business?</h2>
			<p class="text-xl text-gray-600 mb-8">DIME AI Isn't Just For Consumer Brands.</p>
			<Button href="/b2b">Check Out (X)</Button>
		</div>

		<!-- Feature Cards -->
		<div class="mt-16">
			<p class="text-center text-xl text-gray-800 mb-8 font-medium">We Provide Access To Niche Influencer Lists Including:</p>

			<div class="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
				<!-- Card 1 -->
				<div class="bg-white rounded-2xl p-8 border-2 border-orange-400 hover:shadow-lg transition-shadow">
					<h3 class="text-lg font-bold text-center">
						LinkedInfluencers Dominating B2B And AI
					</h3>
				</div>

				<!-- Card 2 -->
				<div class="bg-white rounded-2xl p-8 border-2 border-blue-500 hover:shadow-lg transition-shadow">
					<h3 class="text-lg font-bold text-center">
						Tech Creators On YouTube, Substack, And X
					</h3>
				</div>

				<!-- Card 3 -->
				<div class="bg-white rounded-2xl p-8 border-2 border-cyan-400 hover:shadow-lg transition-shadow">
					<h3 class="text-lg font-bold text-center">
						Thought Leaders In Product, Engineering, And Growth
					</h3>
				</div>
			</div>
		</div>
	</div>
</section>
