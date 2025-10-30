<script lang="ts">
	interface Props {
		variant?: 'primary' | 'secondary' | 'outline';
		size?: 'sm' | 'md' | 'lg';
		href?: string;
		onclick?: () => void;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		children?: any;
		disabled?: boolean;
	}

	let {
		variant = 'primary',
		size = 'md',
		href,
		onclick,
		type = 'button',
		class: className = '',
		children,
		disabled = false
	}: Props = $props();

	const baseStyles = 'font-medium rounded-full transition-all duration-200 inline-block text-center';

	const variantStyles = {
	primary: 'bg-[#FF6F61] text-white hover:bg-[#ff846f] shadow-sm',
		secondary: 'bg-black text-white hover:bg-gray-800',
		outline: 'border-2 border-black text-black hover:bg-black hover:text-white'
	};

	const sizeStyles = {
		sm: 'px-4 py-2 text-sm',
		md: 'px-6 py-3 text-base',
		lg: 'px-8 py-4 text-lg'
	};

	const disabledStyles = disabled ? 'opacity-60 pointer-events-none' : '';
	const classes = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyles} ${className}`;
</script>

{#if href}
	<a
		{href}
		class={classes}
		role="button"
		aria-disabled={disabled ? 'true' : undefined}
		tabindex={disabled ? -1 : undefined}
	>
		{@render children?.()}
	</a>
{:else}
	<button {onclick} class={classes} type={type} disabled={disabled}>
		{@render children?.()}
	</button>
{/if}
