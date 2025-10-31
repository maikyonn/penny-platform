import { describe, expect, it, vi } from 'vitest';

const signInWithCustomTokenMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/firebase-identity', () => ({
	signInWithCustomToken: signInWithCustomTokenMock
}));

import { GET } from '../../../src/routes/api/integrations/google/oauth/callback/+server';

describe('gmail oauth callback', () => {
	const baseLocals = {
		getSession: vi.fn(),
		firebaseAuth: {
			createCustomToken: vi.fn()
		}
	};

	it('redirects when code missing', async () => {
		await expect(
			GET({
				url: new URL('http://localhost/api/integrations/google/oauth/callback'),
				locals: baseLocals,
				fetch: vi.fn()
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/my-account?google=denied' });
	});

	it('redirects to sign-in when session missing', async () => {
		const locals = {
			...baseLocals,
			getSession: vi.fn().mockResolvedValue(null)
		};

		await expect(
			GET({
				url: new URL('http://localhost/api/integrations/google/oauth/callback?code=abc'),
				locals,
				fetch: vi.fn()
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/sign-in?redirectTo=/my-account' });
	});

	it('calls gmailAuthorize and redirects on success', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		signInWithCustomTokenMock.mockResolvedValue({ idToken: 'id-token' });

		const locals = {
			getSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
			firebaseAuth: {
				createCustomToken: vi.fn().mockResolvedValue('custom-token')
			}
		};

		await expect(
			GET({
				url: new URL('http://localhost/api/integrations/google/oauth/callback?code=abc'),
				locals,
				fetch: fetchMock
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/my-account?google=connected' });

		expect(locals.firebaseAuth.createCustomToken).toHaveBeenCalledWith('user-1');
		expect(signInWithCustomTokenMock).toHaveBeenCalledWith('custom-token');
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('/gmailAuthorize'),
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({ Authorization: 'Bearer id-token' })
			})
		);
	});
});
