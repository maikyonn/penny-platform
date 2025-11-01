// IMPORTANT: Set this BEFORE any imports to prevent lightningcss native binary loading
process.env.LIGHTNINGCSS_IGNORE_NATIVE = '1';

import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

const stageInput = (process.env.APP_ENV || process.env.PROFILE || process.env.NODE_ENV || 'development').toLowerCase();
const stage = ['prod', 'production'].includes(stageInput) ? 'production' : 'development';
const envPath = path.resolve(process.cwd(), `../../env/.env.${stage}`);
loadEnv({ path: envPath, override: true });

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
