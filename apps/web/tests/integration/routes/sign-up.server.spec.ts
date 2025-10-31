import { beforeEach, describe, expect, it, vi } from 'vitest';

const signUpMock = vi.hoisted(() => vi.fn());
const verifyMock = vi.hoisted(() => vi.fn());
const createSessionMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/firebase-identity', () => ({
	signUpWithEmailAndPassword: signUpMock,
	sendEmailVerification: verifyMock
}));

import { actions, load } from '../../../src/routes/sign-up/+page.server';

describe('sign-up route', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		createSessionMock.mockReset();
	});

	const baseLocals = {
		getSession: vi.fn().mockResolvedValue(null),
		createSession: createSessionMock
	};

	it('redirects when already signed in', async () => {
		const locals = {
			...baseLocals,
			getSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } })
		};

		await expect(
			load({
				locals
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/campaign' });
	});

	it('validates required fields', async () => {
		const form = new FormData();
		form.set('email', '');
		form.set('password', '');
		form.set('terms', 'on');

		const response = await actions.default({
			request: { formData: async () => form } as any,
			locals: baseLocals
		} as any);

		expect(response.status).toBe(400);
		expect(signUpMock).not.toHaveBeenCalled();
	});

	it('creates account and sends verification', async () => {
		signUpMock.mockResolvedValue({ idToken: 'new-token' });
		verifyMock.mockResolvedValue({});

		const form = new FormData();
		form.set('email', 'user@example.com');
		form.set('password', 'supersecret');
		form.set('terms', 'on');

		await expect(
			actions.default({
				request: { formData: async () => form } as any,
				locals: baseLocals
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/sign-up/confirm?email=user%40example.com' });

		expect(signUpMock).toHaveBeenCalledWith('user@example.com', 'supersecret');
		expect(createSessionMock).toHaveBeenCalledWith('new-token');
		expect(verifyMock).toHaveBeenCalledWith('new-token');
	});

	it('handles downstream identity errors', async () => {
		signUpMock.mockRejectedValue(new Error('EMAIL_EXISTS'));

		const form = new FormData();
		form.set('email', 'exists@example.com');
		form.set('password', 'supersecret');
		form.set('terms', 'on');

		const response = await actions.default({
			request: { formData: async () => form } as any,
			locals: baseLocals
		} as any);

		expect(response.status).toBe(400);
		expect(response.data.error).toContain('EMAIL_EXISTS');
	});
});
