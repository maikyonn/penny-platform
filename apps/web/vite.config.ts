// IMPORTANT: Set this BEFORE any imports to prevent lightningcss native binary loading
process.env.LIGHTNINGCSS_IGNORE_NATIVE = '1';

import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig(async () => {
	const { default: tailwindcss } = await import('@tailwindcss/vite');

	return {
		plugins: [tailwindcss(), sveltekit()],
		resolve: {
			alias: {
				'svelte-motion': 'svelte-motion/src/index.js'
			}
		},
		optimizeDeps: {
			exclude: ['svelte-motion']
		},
		ssr: {
			noExternal: ['svelte-motion']
		},
		test: {
			expect: { requireAssertions: true },
			projects: [
				{
					extends: './vite.config.ts',
					test: {
						name: 'client',
						environment: 'browser',
						browser: {
							enabled: true,
							provider: 'playwright',
							instances: [{ browser: 'chromium' }]
						},
						include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
						exclude: ['src/lib/server/**'],
						setupFiles: ['./vitest-setup-client.ts']
					}
				},
				{
					extends: './vite.config.ts',
					test: {
						name: 'server',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}'],
						exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
					}
				}
			]
		}
	};
});
