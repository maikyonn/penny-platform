import { defineConfig } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
loadEnv({ path: '.env.local', override: true });
process.env.CHATBOT_STUB_MODE = process.env.CHATBOT_STUB_MODE ?? '0';

export default defineConfig({
	webServer: {
		command: 'bun run preview:local',
		port: 5193,
		reuseExistingServer: true
	},
	testDir: 'e2e'
});
