import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/database.types';
import { expectEx as expect, test } from './fixtures';

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

async function ensureSubscriptionForUser(email: string) {
	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error('Missing Supabase configuration for tests');
	}

	const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false }
	});

	let userId: string | null = null;
	for (let attempt = 0; attempt < 10 && !userId; attempt += 1) {
		const { data, error } = await admin.auth.admin.listUsers({ email });
		if (error) throw error;
		const candidate = data?.users?.[0];
		if (candidate?.id) {
			userId = candidate.id;
			break;
		}
		await new Promise((resolve) => setTimeout(resolve, 300));
	}

	if (!userId) {
		throw new Error(`User not found for ${email}`);
	}

	const { error: upsertError } = await admin
		.from('subscriptions')
		.upsert(
			{
				user_id: userId,
				provider: 'stripe',
				provider_customer_id: userId,
				provider_subscription_id: `sub_${userId}`,
				plan: 'starter',
				status: 'active',
				current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
			},
			{ onConflict: 'user_id' }
		);

	if (upsertError) {
		throw upsertError;
	}
}

async function waitForIdle(page: any) {
	await page.waitForLoadState('networkidle');
}

async function triggerMagicLink(page: any, email: string) {
	await page.goto(`${baseUrl}/sign-in`);
	await page.locator('#magic-email').fill(email);
	await page.getByRole('button', { name: /send magic link/i }).click();
}

test('magic link sign-in and checkout happy path', async ({ page, mailpit }) => {
	const email = `e2e+${Date.now()}@example.com`;

	await page.addInitScript(({ successUrl }) => {
		(window as any).Stripe = () => ({
			redirectToCheckout: async () => {
				window.location.href = successUrl;
				return { error: null };
			}
		});
	}, { successUrl: `${baseUrl}/billing/success` });

	await page.goto(baseUrl);
	await waitForIdle(page);
	await triggerMagicLink(page, email);

	const magicLink = await mailpit.latestLinkFor(email);
	await page.goto(magicLink);
	await ensureSubscriptionForUser(email);
	await expect(page.locator('body')).toContainText(/campaign|dashboard|welcome/i);
	await page.goto(`${baseUrl}/pricing`);
	await page.route('**/api/billing/checkout', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ sessionId: 'cs_test_123', url: `${baseUrl}/billing/success` })
		});
	});

	await page.getByRole('button', { name: /starter plan|start 3-day trial/i }).first().click();
	await page.waitForURL('**/billing/success**');
	await expect(page.locator('body')).toContainText(/subscription is active/i);

	// 2) Use the chatbot stub to generate a fresh campaign and seeded influencers via the UI
	await page.goto(`${baseUrl}/chatbot`);
	await page.getByLabel('Campaign name').fill('Playwright Launch Campaign');
	await page.getByLabel('Objective').fill('Book 10 creators for our launch week');
	await page.getByLabel('Landing page').fill('https://example.com/launch');
	await page.getByLabel('First message').fill('We need foodie creators in Austin to promote our new brunch concept.');
	await page.getByRole('button', { name: /generate campaign/i }).click();
	await page.locator('text=Campaign created!').waitFor({ state: 'visible', timeout: 10000 });
	const outreachButton = page.getByRole('button', { name: /open outreach workspace/i });
	await outreachButton.waitFor({ state: 'visible', timeout: 10000 });
	const outreachHref = await outreachButton.getAttribute('href');
	console.log('Outreach href', outreachHref);
	await outreachButton.click();
	await page.waitForURL(`**${outreachHref}**`);

	// 3) Review influencer list and switch selections
	const influencerButtons = page.locator('ul >> role=button');
	await expect(influencerButtons.first()).toBeVisible();
	const influencerCount = await influencerButtons.count();
	if (influencerCount > 1) {
		await influencerButtons.nth(1).click();
		await influencerButtons.first().click();
	}

	// 4) Draft an email and send outreach (stubbed via outreach-send)
	const messageBox = page.getByPlaceholder('Write a reply');
	await messageBox.fill('Hi there! We would love to collaborate with you for our launch event.');
	await page.getByRole('button', { name: /^send$/i }).click();
	await expect(page.locator('text=Message sent successfully.')).toBeVisible();

	// Reload to pick up the new message from the database
	await page.reload();
	await expect(page.locator('text=We would love to collaborate')).toBeVisible();
});
