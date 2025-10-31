import { describe, expect, it, vi } from 'vitest';

const localsBase = {
	getSession: vi.fn().mockResolvedValue(null)
};

import { load } from '../../../src/routes/sign-up/confirm/+page.server';

describe('sign-up confirm route', () => {
	it('redirects authenticated users', async () => {
		const locals = {
			getSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } })
		};

		await expect(
			load({
				locals,
				url: new URL('http://localhost/sign-up/confirm?email=user@example.com')
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/campaign' });
	});

	it('requires email parameter', async () => {
		await expect(
			load({
				locals: localsBase,
				url: new URL('http://localhost/sign-up/confirm')
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/sign-up' });
	});

	it('returns email for anonymous user', async () => {
		const result = await load({
			locals: localsBase,
			url: new URL('http://localhost/sign-up/confirm?email=user@example.com')
		} as any);

		expect(result.email).toBe('user@example.com');
	});
});
