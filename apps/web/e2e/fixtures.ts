import { test as base, expect } from '@playwright/test';

type Fixtures = {
	mailpit: {
		latestLinkFor: (email: string) => Promise<string>;
	};
};

export const test = base.extend<Fixtures>({
	mailpit: async ({}, use) => {
		const baseUrl = process.env.MAILPIT_BASE_URL ?? 'http://127.0.0.1:54324';
	await use({
		async latestLinkFor(email: string) {
			let messageId: string | undefined;
			for (let attempt = 0; attempt < 12 && !messageId; attempt += 1) {
				const list = await fetch(
					`${baseUrl}/api/v1/messages?query=${encodeURIComponent(email)}`
				).then((res) => res.json());
				messageId = list.messages?.[0]?.ID;
				if (!messageId) {
					await new Promise((resolve) => setTimeout(resolve, 500));
				}
			}
			if (!messageId) {
				throw new Error('Magic link email not found');
			}
			const message = await fetch(`${baseUrl}/api/v1/message/${messageId}`).then((res) => res.json());
			const body = (message.HTML as string | undefined) ?? (message.Text as string | undefined) ?? '';
			const match = body.match(/https?:\/\/[^"'>\s]+/);
			if (!match) throw new Error('Magic link missing in email');
			return match[0].replace(/&amp;/g, '&');
			}
		});
	}
});

export const expectEx = expect;
