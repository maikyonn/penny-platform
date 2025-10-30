import 'whatwg-url';
import '@testing-library/svelte/vitest';
import '@testing-library/jest-dom/vitest';

const { config } = await import('dotenv');
config({ path: '.env.local', override: false });

if (!process.env.NODE_ENV) {
	process.env.NODE_ENV = 'test';
}
