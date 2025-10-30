import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import path from 'node:path';

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	resolve: {
		alias: {
			$components: path.resolve(__dirname, './src/lib/components'),
			$lib: path.resolve(__dirname, './src/lib'),
			$routes: path.resolve(__dirname, './src/routes'),
			'@supabase/supabase-js': path.resolve(__dirname, './tests/mocks/@supabase/supabase-js.ts'),
			'msw/node': path.resolve(__dirname, './node_modules/msw/lib/node/index.mjs')
		},
		conditions: ['node', 'browser', 'module', 'import', 'default']
	},
	test: {
		environment: 'jsdom',
		globals: true,
		dir: 'tests',
		include: ['**/*.{spec,test}.ts'],
		exclude: ['e2e/**'],
		setupFiles: [
			'./tests/setup/test-env.ts',
			'./tests/setup/pollyfills.ts',
			'./tests/setup/msw.server.ts'
		],
		pool: 'forks'
 }
});
