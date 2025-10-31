import { describe, expect, it, vi } from 'vitest';

const loadUserContextMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/user-context', () => ({
	loadUserContext: loadUserContextMock
}));

import { actions } from '../../../src/routes/(app)/campaign/+page.server';

describe('campaign create action', () => {
	it('requires authentication', async () => {
		loadUserContextMock.mockResolvedValue({ firebaseUser: null });

		await expect(
			actions.create({
				request: { formData: async () => new FormData() } as any,
				locals: { firestore: {} }
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/sign-in' });
	});

	it('validates name field', async () => {
		loadUserContextMock.mockResolvedValue({ firebaseUser: { uid: 'user-1' } });

		const response = await actions.create({
			request: { formData: async () => new FormData() } as any,
			locals: { firestore: {} }
		} as any);

		expect(response.status).toBe(400);
		expect(response.data.error).toMatch(/Campaign name/);
	});

	it('creates campaign and redirects to detail page', async () => {
		const addDocMock = vi.fn().mockReturnValue({
			id: 'new-campaign-id',
			set: vi.fn()
		});

		const firestore = {
			collection: vi.fn(() => ({
				doc: vi.fn(() => ({
					id: 'new-campaign-id',
					set: vi.fn()
				}))
			}))
		};

		loadUserContextMock.mockResolvedValue({ firebaseUser: { uid: 'user-1' } });

		const form = new FormData();
		form.set('name', 'My Campaign');
		form.set('objective', 'Launch');

		await expect(
			actions.create({
				request: { formData: async () => form } as any,
				locals: { firestore }
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/campaign/new-campaign-id' });
	});
});
