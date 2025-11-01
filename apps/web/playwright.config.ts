import path from 'node:path';
import { defineConfig } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

const stageInput = (process.env.APP_ENV || process.env.PROFILE || process.env.NODE_ENV || 'development').toLowerCase();
const stage = ['prod', 'production'].includes(stageInput) ? 'production' : 'development';
const envPath = path.resolve(process.cwd(), `../../env/.env.${stage}`);
loadEnv({ path: envPath, override: true });

process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.CHATBOT_STUB_MODE = process.env.CHATBOT_STUB_MODE ?? '0';

export default defineConfig({
	webServer: {
		command: 'bun run preview:local',
		port: 5193,
		reuseExistingServer: true
	},
	testDir: 'e2e'
});
