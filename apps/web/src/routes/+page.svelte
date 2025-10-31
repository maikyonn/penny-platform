<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import Hero from '$lib/components/Hero.svelte';
	import TrustedBrands from '$lib/components/TrustedBrands.svelte';
	import InfluencerPower from '$lib/components/InfluencerPower.svelte';
	import HassleSection from '$lib/components/HassleSection.svelte';
	import AutomatedSection from '$lib/components/AutomatedSection.svelte';
	import HowItWorks from '$lib/components/HowItWorks.svelte';
	import B2BSection from '$lib/components/B2BSection.svelte';
	import FinalCTA from '$lib/components/FinalCTA.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { data } = $props();
</script>

<Navbar firebaseUser={data.firebaseUser} profile={data.profile} />
<Hero />
<TrustedBrands />
<InfluencerPower />
<HassleSection />
<AutomatedSection />
<HowItWorks />
<B2BSection />
<FinalCTA />
<Footer />
