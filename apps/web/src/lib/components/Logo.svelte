<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg';
	}

	let { size = 'md' }: Props = $props();

	const sizeStyles = {
		sm: 'w-6 h-6',
		md: 'w-8 h-8',
		lg: 'w-12 h-12'
	};
</script>

<div class="flex items-center gap-2">
	<div class="{sizeStyles[size]} bg-[#FFD93D] rounded flex items-center justify-center font-bold text-black">
		<svg viewBox="0 0 24 24" fill="currentColor" class="w-full h-full p-1">
			<path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
		</svg>
	</div>
	<span class="font-bold text-xl">Dime</span>
</div>
