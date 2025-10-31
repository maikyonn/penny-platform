import type { Firestore } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadUserContextMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/user-context', () => ({
	loadUserContext: loadUserContextMock
}));

import { actions, load } from '../../../src/routes/(app)/influencers/+page.server';

function createFirestoreStub(): Firestore {
	const campaignDoc = {
		id: 'campaign-1',
		data: () => ({
			name: 'Launch',
			status: 'draft',
			ownerUid: 'user-1',
			totals: { pending: 0 }
		})
	};

	const influencerDoc = {
		id: 'influencer-1',
		data: () => ({
			displayName: 'Jordan Creator',
			emails: ['creator@example.com'],
			metrics: { followers: 10000, engagementRate: 6.4 },
			categories: ['food']
		})
	};

	const firestore = {
		collection: (name: string) => {
			switch (name) {
				case 'outreach_campaigns':
					return {
						where: () => ({
							orderBy: () => ({
								get: async () => ({
									docs: [campaignDoc]
								})
							})
						}),
						doc: vi.fn(() => ({
							get: async () => ({ exists: true, data: () => campaignDoc.data() }),
							collection: vi.fn(() => ({
								doc: vi.fn(() => ({
									get: vi.fn().mockResolvedValue({ exists: false }),
									set: setMock
								}))
							})),
							set: updateCampaignMock
						}))
					};
				case 'influencers':
					return {
						orderBy: () => ({
							limit: () => ({
								get: async () => ({
									docs: [influencerDoc]
								})
							})
						}),
						doc: vi.fn(() => ({
							get: vi.fn().mockResolvedValue({ exists: true, data: () => influencerDoc.data() })
						}))
					};
				default:
					throw new Error(`Unsupported collection ${name}`);
			}
		}
	} as unknown as Firestore;

	return firestore;
}

const setMock = vi.fn();
const updateCampaignMock = vi.fn();

describe('influencers route', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		loadUserContextMock.mockResolvedValue({
			firebaseUser: { uid: 'user-1' },
			profile: { user_id: 'user-1', full_name: 'Demo', avatar_url: null, locale: null }
		});
	});

	it('loads campaigns and influencer catalog', async () => {
		const result = await load({
			locals: { firestore: createFirestoreStub() }
		} as any);

		expect(result.campaigns).toHaveLength(1);
		expect(result.influencers[0].display_name).toBe('Jordan Creator');
	});

	it('assigns influencer to campaign', async () => {
		const firestore = createFirestoreStub();

		const form = new FormData();
		form.set('campaign_id', 'campaign-1');
		form.set('influencer_id', 'influencer-1');

		const response = await actions.assign({
			locals: { firestore },
			request: { formData: async () => form } as any
		} as any);

		expect(response).toEqual({ success: true });
		expect(setMock).toHaveBeenCalled();
		expect(updateCampaignMock).toHaveBeenCalled();
	});

	it('validates missing inputs', async () => {
		const firestore = createFirestoreStub();

		const form = new FormData();
		form.set('campaign_id', '');
		form.set('influencer_id', '');

		const response = await actions.assign({
			locals: { firestore },
			request: { formData: async () => form } as any
		} as any);

		expect(response.status).toBe(400);
	});
});
