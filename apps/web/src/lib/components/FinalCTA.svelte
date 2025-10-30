<script lang="ts">
	import Badge from './Badge.svelte';
	import Button from './Button.svelte';
</script>

<section class="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50">
	<div class="max-w-4xl mx-auto text-center">
		<!-- Header -->
		<Badge variant="blue">LEVEL UP YOUR BRAND</Badge>
		<h2 class="text-4xl sm:text-5xl font-bold mt-6 mb-6">Ready to Get Started?</h2>
		<p class="text-lg text-gray-600 mb-10">
			Hether You're A Consumer Brand, Coffee Shop, Restaurant, Bar, Tech Company, Or B2B Business —<br />
			DIME AI Will Help You Scale Your Influencer Campaigns Without Lifting A Finger.
		</p>

		<!-- CTA Button -->
		<Button size="lg" href="/get-started" class="mb-16">
			Get Started Now And Meet Your Perfect Influencers
		</Button>

		<!-- Custom Solution Card -->
		<div class="bg-[#FFF8E1] rounded-3xl p-12 relative overflow-hidden">
			<!-- Decorative lines -->
			<div class="absolute top-0 right-0 w-64 h-64 opacity-5">
				<div class="absolute inset-0" style="background: repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 10px);"></div>
			</div>

			<div class="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
				<div class="text-left flex-1">
					<h3 class="text-3xl font-bold mb-4">Need a Custom Solution?</h3>
					<p class="text-gray-700 mb-3">
						Looking For A Fully Managed Influencer Campaign? Want Real People — Not Just Software<br />
						— To Take Care Of Everything For You?
					</p>
					<p class="text-gray-700">
						Let Our Team At DIME AI Handle The Strategy, Sourcing, Outreach, And Reporting Tailored To Your Exact Goals.
					</p>
				</div>
				<Button variant="secondary" size="lg" href="/custom-solution">
					Schedule A Meeting Here!
				</Button>
			</div>
		</div>

		<!-- Tagline -->
		<div class="mt-16">
			<p class="text-2xl font-medium italic text-gray-800">
				Let's build a high-impact campaign that works.
			</p>
		</div>
	</div>
</section>
