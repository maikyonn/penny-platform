<script lang="ts">
	interface Props {
	variant?: 'blue' | 'yellow';
		children?: any;
	}

	let { variant = 'blue', children }: Props = $props();

	const variantStyles = {
		blue: 'bg-blue-100 text-blue-700',
	yellow: 'bg-[#FFE5DF] text-[#B63E35]'
	};
</script>

<span class="inline-block px-4 py-2 rounded-full text-sm font-medium uppercase tracking-wide {variantStyles[variant]}">
	{@render children?.()}
</span>
