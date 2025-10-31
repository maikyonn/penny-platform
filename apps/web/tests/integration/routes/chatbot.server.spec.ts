import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadUserContextMock = vi.hoisted(() => vi.fn());
const signInWithCustomTokenMock = vi.hoisted(() => vi.fn());
const firebaseAuthMock = {
	createCustomToken: vi.fn()
};
const firestoreSetMock = vi.fn();

const envState = vi.hoisted(() => ({
	stubMode: false
}));

vi.mock('$lib/server/user-context', () => ({
	loadUserContext: loadUserContextMock
}));

vi.mock('$lib/server/firebase-identity', () => ({
	signInWithCustomToken: signInWithCustomTokenMock
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		get CHATBOT_STUB_MODE() {
			return envState.stubMode ? '1' : '0';
		},
		get FUNCTIONS_EMULATOR() {
			return '1';
		},
		GOOGLE_CLOUD_PROJECT: 'demo-penny-dev'
	}
}));

const fetchStub = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', fetchStub);

async function importModule() {
	vi.resetModules();
	return import('../../../src/routes/(app)/chatbot/+page.server');
}

beforeEach(() => {
	vi.clearAllMocks();
	envState.stubMode = false;
	loadUserContextMock.mockResolvedValue({
		firebaseUser: { uid: 'user-1' }
	});
	firebaseAuthMock.createCustomToken.mockResolvedValue('custom-token');
	signInWithCustomTokenMock.mockResolvedValue({ idToken: 'id-token' });
	fetchStub.mockReset();
});

const localsBase = {
	firestore: {
		collection: vi.fn(() => ({
			doc: vi.fn(() => ({
				set: firestoreSetMock
			}))
		}))
	},
	firebaseAuth: firebaseAuthMock
};

describe('chatbot route', () => {
	it('requires authentication for load', async () => {
		loadUserContextMock.mockResolvedValueOnce({ firebaseUser: null });
		const { load } = await importModule();

		await expect(
			load({
				locals: localsBase
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/sign-in' });
	});

	it('returns stubbed response when stub mode enabled', async () => {
		envState.stubMode = true;
		const { actions } = await importModule();

		const form = new FormData();
		form.set('message', 'Plan my launch');

		const response = await actions.send({
			request: { formData: async () => form } as any,
			locals: localsBase
		} as any);

		expect(response.success).toBe(true);
		expect(response.conversation?.length).toBeGreaterThan(1);
		expect(signInWithCustomTokenMock).not.toHaveBeenCalled();
	});

	it('calls Firebase auth and fetches assistant reply', async () => {
		envState.stubMode = false;
		const responseBody = JSON.stringify({ success: true, response: 'Let us proceed.' });
		fetchStub.mockResolvedValue(new Response(responseBody, { status: 200, headers: { 'content-type': 'application/json' } }));

		const { actions } = await importModule();

		const form = new FormData();
		form.set('message', 'Hello assistant');

		const result = await actions.send({
			request: { formData: async () => form } as any,
			locals: localsBase
		} as any);

		expect(firebaseAuthMock.createCustomToken).toHaveBeenCalledWith('user-1');
		expect(signInWithCustomTokenMock).toHaveBeenCalledWith('custom-token');
		expect(fetchStub).toHaveBeenCalled();
		expect(firestoreSetMock).toHaveBeenCalled();
		expect(result.success).toBe(true);
	});
});
