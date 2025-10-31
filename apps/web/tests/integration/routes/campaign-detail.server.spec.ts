import type { Firestore } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadUserContextMock = vi.hoisted(() => vi.fn());
const seedMockInfluencersMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/user-context', () => ({
	loadUserContext: loadUserContextMock
}));

vi.mock('$lib/server/mock-influencers', () => ({
	seedMockInfluencersForCampaign: seedMockInfluencersMock
}));

import { actions, load } from '../../../src/routes/(app)/campaign/[id]/+page.server';

type CampaignFirestoreOptions = {
	campaignId?: string;
	seeded?: boolean;
};

function createCampaignFirestoreStub(options: CampaignFirestoreOptions = {}) {
	const campaignId = options.campaignId ?? 'campaign-123';
	let targetsLoaded = 0;

	const targetDoc = {
		id: 'influencer-123',
		data: () => ({
			influencerId: 'influencer-123',
			status: 'prospect',
			matchScore: 86,
			source: 'manual'
		})
	};

	const campaignData = {
		ownerUid: 'user-123',
		name: 'Launch Campaign',
		description: 'Kick-off outreach',
		status: 'active',
		schedule: { startAt: new Date('2024-01-01T00:00:00Z') },
		createdAt: new Date('2024-01-01T00:00:00Z'),
		updatedAt: new Date('2024-01-01T00:00:00Z'),
		metrics: { history: [] }
	};

	const influencerDocRef = {
		get: async () => ({
			exists: true,
			id: 'influencer-123',
			data: () => ({
				displayName: 'Casey Creator',
				handle: '@caseycreates',
				platform: 'instagram',
				followerCount: 78000,
				engagementRate: 0.064,
				location: 'Los Angeles'
			})
		})
	};

	const messagesDocs = [
		{
			id: 'message-1',
			data: () => ({
				direction: 'outgoing',
				bodyText: 'Hi there!',
				bodyHtml: '<p>Hi there!</p>',
				sentAt: new Date('2024-01-02T00:00:00Z')
			})
		}
	];

	const threadDoc = {
		id: 'thread-123',
		data: () => ({
			influencerId: 'influencer-123',
			channel: 'email',
			lastMessageAt: new Date('2024-01-02T00:00:00Z'),
			messagesCount: 1
		}),
		ref: {
			collection: (name: string) => {
				if (name !== 'messages') {
					throw new Error(`Unexpected subcollection ${name}`);
				}
				return {
					orderBy: () => ({
						get: async () => ({
							docs: messagesDocs
						})
					})
				};
			}
		}
	};

	const threadsCollection = {
		where: () => ({
			where: () => ({
				get: async () => ({
					docs: [threadDoc]
				})
			})
		})
	};

	const targetsCollection = {
		get: async () => {
			targetsLoaded += 1;
			if (!options.seeded && targetsLoaded === 1) {
				return { docs: [] };
			}
			return { docs: [targetDoc] };
		}
	};

	const campaignDocRef = {
		get: async () => ({
			exists: true,
			id: campaignId,
			data: () => campaignData
		}),
		collection: (name: string) => {
			if (name !== 'targets') {
				throw new Error(`Unexpected subcollection ${name}`);
			}
			return targetsCollection;
		}
	};

	const firestore = {
		collection: (name: string) => {
			switch (name) {
				case 'outreach_campaigns':
					return {
						doc: () => campaignDocRef
					};
				case 'influencers':
					return {
						doc: () => influencerDocRef
					};
				case 'threads':
					return threadsCollection;
				default:
					throw new Error(`Unsupported collection ${name}`);
			}
		}
	};

	return { firestore: firestore as unknown as Firestore };
}

describe('campaign detail load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns campaign assignments when targets exist', async () => {
		const { firestore } = createCampaignFirestoreStub({ seeded: true });
		loadUserContextMock.mockResolvedValue({
			firebaseUser: { uid: 'user-123' },
			profile: { user_id: 'user-123', full_name: 'Demo', avatar_url: null, locale: null }
		});
		seedMockInfluencersMock.mockResolvedValue(undefined);

		const result = await load({
			locals: { firestore } as any,
			params: { id: 'campaign-123' }
		} as any);

		expect(result.campaign.id).toBe('campaign-123');
		expect(result.assignments).toHaveLength(1);
		expect(result.assignments[0].influencer?.display_name).toBe('Casey Creator');
		expect(result.assignments[0].messages[0].direction).toBe('brand');
		expect(seedMockInfluencersMock).not.toHaveBeenCalled();
	});

	it('seeds mock influencers when campaign has no targets', async () => {
		const { firestore } = createCampaignFirestoreStub();
		loadUserContextMock.mockResolvedValue({
			firebaseUser: { uid: 'user-123' },
			profile: null
		});
		seedMockInfluencersMock.mockResolvedValue(undefined);

		const result = await load({
			locals: { firestore } as any,
			params: { id: 'campaign-456' }
		} as any);

		expect(seedMockInfluencersMock).toHaveBeenCalledTimes(1);
		expect(seedMockInfluencersMock).toHaveBeenCalledWith('campaign-456', { db: firestore });
		expect(result.targets).toHaveLength(1);
		expect(result.assignments[0].match_score).toBe(86);
	});
});

describe('campaign detail actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('stores outgoing message and creates thread when missing', async () => {
		const threadCollectionAdd = vi.fn().mockResolvedValue({});
		const threadCollectionSet = vi.fn().mockResolvedValue({});
		const targetSet = vi.fn().mockResolvedValue({});

		const firestore = {
			collection: vi.fn((name: string) => {
				if (name === 'outreach_campaigns') {
					return {
						doc: (id: string) => ({
							collection: () => ({
								doc: () => ({
									get: async () => ({
										exists: true,
										data: () => ({
											influencerId: 'influencer-1'
										})
									}),
									set: targetSet
								})
							})
						})
					};
				}
				if (name === 'threads') {
					return {
						where: () => ({
							where: () => ({
								where: () => ({
									limit: () => ({
										get: async () => ({
											docs: []
										})
									})
								})
							})
						}),
						doc: vi.fn(() => ({
							set: threadCollectionSet,
							collection: () => ({
								add: threadCollectionAdd
							})
						}))
					};
				}
				if (name === 'influencers') {
					return {
						doc: () => ({
							get: async () => ({
								exists: true,
								data: () => ({})
							})
						})
					};
				}
				throw new Error(`Unexpected collection ${name}`);
			})
		};

		loadUserContextMock.mockResolvedValue({
			firebaseUser: { uid: 'user-1' },
			profile: { user_id: 'user-1', full_name: 'Demo', avatar_url: null, locale: null }
		});
		seedMockInfluencersMock.mockResolvedValue(undefined);

		const form = new FormData();
		form.set('campaign_influencer_id', 'target-1');
		form.set('message', 'Hello!');

		const response = await actions.sendMessage({
			locals: { firestore },
			request: { formData: async () => form } as any,
			params: { id: 'campaign-1' }
		} as any);

		expect(response).toEqual({ success: true, campaignId: 'campaign-1' });
		expect(threadCollectionAdd).toHaveBeenCalledTimes(1);
		expect(threadCollectionSet).toHaveBeenCalled();
		expect(targetSet).toHaveBeenCalledTimes(1);
	});
});
