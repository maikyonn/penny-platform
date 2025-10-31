import type { Firestore } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadUserContextMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/user-context', () => ({
	loadUserContext: loadUserContextMock
}));

import { actions, load } from '../../../src/routes/(app)/inbox/+page.server';

function createInboxFirestoreStub() {
	const campaignsSnapshot = {
		docs: [
			{
				id: 'campaign-1',
				data: () => ({
					name: 'Launch'
				})
			}
		]
	};

	const messageDocs = [
		{
			id: 'message-1',
			data: () => ({
				direction: 'incoming',
				bodyText: 'Interested!',
				bodyHtml: '<p>Interested!</p>',
				sentAt: new Date('2024-01-03T12:00:00Z')
			})
		}
	];

	const threadDoc = {
		id: 'thread-1',
		data: () => ({
			influencerId: 'influencer-1',
			channel: 'email',
			lastMessageAt: new Date('2024-01-03T12:00:00Z'),
			campaignId: 'campaign-1',
			status: 'open',
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
							docs: messageDocs
						})
					})
				};
			}
		}
	};

	const influencersCollection = {
		doc: (id: string) => ({
			get: async () => ({
				exists: id === 'influencer-1',
				data: () => ({
					displayName: 'Jordan Creator',
					handle: '@jordanevents'
				})
			})
		})
	};

	const threadsCollection = {
		where: () => ({
			orderBy: () => ({
				limit: () => ({
					get: async () => ({
						docs: [threadDoc]
					})
				})
			})
		})
	};

	const campaignsCollection = {
		where: () => ({
			orderBy: () => ({
				get: async () => campaignsSnapshot
			})
		})
	};

	function collection(name: string) {
		switch (name) {
			case 'outreach_campaigns':
				return campaignsCollection;
			case 'threads':
				return threadsCollection;
			case 'influencers':
				return influencersCollection;
			default:
				throw new Error(`Unsupported collection ${name}`);
		}
	}

	const firestore = {
		collection
	};

	return {
		firestore: firestore as unknown as Firestore
	};
}

const threadAddSpy = vi.fn().mockResolvedValue(undefined);
const threadSetSpy = vi.fn().mockResolvedValue(undefined);

describe('inbox page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		threadAddSpy.mockClear();
		threadSetSpy.mockClear();
	});

	it('returns campaigns and normalized threads', async () => {
		const { firestore } = createInboxFirestoreStub();
		loadUserContextMock.mockResolvedValue({
			firebaseUser: { uid: 'user-1' },
			profile: { user_id: 'user-1', full_name: 'Demo', avatar_url: null, locale: null }
		});

		const result = await load({
			locals: { firestore } as any
		} as any);

		expect(result.campaigns).toHaveLength(1);
		expect(result.campaigns[0].name).toBe('Launch');
		expect(result.threads).toHaveLength(1);
		expect(result.threads[0].messages[0].direction).toBe('influencer');
		expect(result.threads[0].influencer?.display_name).toBe('Jordan Creator');
	});
});

describe('inbox sendMessage action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		threadAddSpy.mockClear();
		threadSetSpy.mockClear();
	});

	it('stores outgoing message and bumps counters', async () => {
		loadUserContextMock.mockResolvedValue({
			firebaseUser: { uid: 'user-1' },
			profile: null
		});

		const firestore = {
			collection: (name: string) => {
				if (name !== 'threads') {
					throw new Error(`Unexpected collection ${name}`);
				}
				return {
					doc: (id: string) => {
						if (id !== 'thread-1') {
							throw new Error(`Unexpected thread id ${id}`);
						}
						return {
							get: async () => ({
								exists: true,
								data: () => ({
									userId: 'user-1',
									messagesCount: 2
								})
							}),
							collection: () => ({
								add: threadAddSpy
							}),
							set: threadSetSpy
						};
					}
				};
			}
		};

		const form = new FormData();
		form.set('thread_id', 'thread-1');
		form.set('message', 'Follow-up message');

		const response = await actions.sendMessage({
			request: {
				formData: async () => form
			} as any,
			locals: { firestore } as any
		} as any);

		expect(response).toEqual({ success: true });
		expect(threadAddSpy).toHaveBeenCalledTimes(1);
		const payload = threadAddSpy.mock.calls[0][0];
		expect(payload.direction).toBe('outgoing');
		expect(payload.bodyText).toBe('Follow-up message');
		expect(threadSetSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				messagesCount: 3
			}),
			{ merge: true }
		);
	});
});
