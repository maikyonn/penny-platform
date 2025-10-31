import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadUserContextMock = vi.hoisted(() => vi.fn());
const getUserSubscriptionMock = vi.hoisted(() => vi.fn());
const firestoreSetMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/user-context', () => ({
	loadUserContext: loadUserContextMock
}));

vi.mock('$lib/server/subscriptions', () => ({
	getUserSubscription: getUserSubscriptionMock
}));

import { actions, load } from '../../../src/routes/(app)/my-account/+page.server';

describe('my-account route', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		firestoreSetMock.mockReset();
	});

	const firestore = {
		collection: vi.fn(() => ({
			doc: vi.fn(() => ({
				set: firestoreSetMock
			}))
		}))
	};

	it('redirects when unauthenticated', async () => {
		loadUserContextMock.mockResolvedValue({ firebaseUser: null });

		await expect(
			load({
				locals: { firestore }
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/sign-in' });
	});

	it('loads subscription and profile for authenticated user', async () => {
		loadUserContextMock.mockResolvedValue({
			firebaseUser: { uid: 'user-1', email: 'user@example.com' },
			profile: { user_id: 'user-1', full_name: 'Demo', avatar_url: null, locale: 'en' },
			userDoc: { plan: { type: 'starter', status: 'active' } }
		});
		getUserSubscriptionMock.mockResolvedValue({ type: 'starter', status: 'active' });

		const result = await load({
			locals: { firestore }
		} as any);

		expect(result.userEmail).toBe('user@example.com');
		expect(result.plan).toEqual({ type: 'starter', status: 'active' });
		expect(getUserSubscriptionMock).toHaveBeenCalledWith(firestore as any, 'user-1');
	});

	it('updates profile settings', async () => {
		loadUserContextMock.mockResolvedValue({
			firebaseUser: { uid: 'user-1' },
			profile: { user_id: 'user-1', full_name: 'Demo', avatar_url: null, locale: 'en' }
		});

		const form = new FormData();
		form.set('full_name', 'New Name');
		form.set('locale', 'es');

		const response = await actions.updateProfile({
			request: { formData: async () => form } as any,
			locals: { firestore }
		} as any);

		expect(response).toEqual({ success: true, values: { full_name: 'New Name', locale: 'es' } });
		expect(firestore.collection).toHaveBeenCalledWith('users');
		expect(firestoreSetMock).toHaveBeenCalledWith(
			expect.objectContaining({
				displayName: 'New Name',
				settings: { locale: 'es' }
			}),
			{ merge: true }
		);
	});
});
