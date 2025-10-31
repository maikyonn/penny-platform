import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadUserContextMock = vi.hoisted(() => vi.fn());
const createSessionMock = vi.hoisted(() => vi.fn());
const signInWithEmailAndPasswordMock = vi.hoisted(() => vi.fn());
const sendEmailSignInLinkMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/firebase-identity', () => ({
	signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
	sendEmailSignInLink: sendEmailSignInLinkMock
}));

vi.mock('$lib/server/user-context', () => ({
	loadUserContext: loadUserContextMock
}));

import { actions, load } from '../../../src/routes/sign-in/+page.server';

describe('sign-in page server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		createSessionMock.mockReset();
		signInWithEmailAndPasswordMock.mockReset();
		sendEmailSignInLinkMock.mockReset();
	});

	const localsBase = {
		getSession: vi.fn(),
		createSession: createSessionMock
	};

	it('redirects authenticated users from load', async () => {
		const locals = {
			...localsBase,
			getSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } })
		};

		await expect(
			load({
				locals,
				url: new URL('http://localhost/sign-in?redirectTo=%2Fcampaign')
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/campaign' });
	});

	it('returns empty props when anonymous', async () => {
		const locals = {
			...localsBase,
			getSession: vi.fn().mockResolvedValue(null)
		};

		const result = await load({
			locals,
			url: new URL('http://localhost/sign-in')
		} as any);

		expect(result).toEqual({});
	});

	it('signs in with password and sets session cookie', async () => {
		signInWithEmailAndPasswordMock.mockResolvedValue({ idToken: 'token-abc' });

		const form = new FormData();
		form.set('email', 'demo@brand.com');
		form.set('password', 'hunter2');
		form.set('remember', 'on');

		await expect(
			actions.password({
				request: { formData: async () => form } as any,
				locals: localsBase,
				url: new URL('http://localhost/sign-in?redirectTo=%2Fdashboard')
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/dashboard' });

		expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith('demo@brand.com', 'hunter2');
		expect(createSessionMock).toHaveBeenCalledWith('token-abc', true);
	});

	it('fails password flow with validation errors', async () => {
		const form = new FormData();
		form.set('email', '');
		form.set('password', '');

		const response = await actions.password({
			request: { formData: async () => form } as any,
			locals: localsBase,
			url: new URL('http://localhost/sign-in')
		} as any);

		expect(response.status).toBe(400);
		expect(response.data.error).toMatch(/Email and password/);
		expect(signInWithEmailAndPasswordMock).not.toHaveBeenCalled();
	});

	it('sends magic link and returns success payload', async () => {
		sendEmailSignInLinkMock.mockResolvedValue({});

		const form = new FormData();
		form.set('email', 'demo@brand.com');

		const response = await actions.magic_link({
			request: { formData: async () => form } as any,
			locals: localsBase,
			url: new URL('http://localhost/sign-in?redirectTo=%2Finbox')
		} as any);

		expect(sendEmailSignInLinkMock).toHaveBeenCalled();
		expect(response.success).toBe(true);
		expect(response.values?.email).toBe('demo@brand.com');
	});
});
