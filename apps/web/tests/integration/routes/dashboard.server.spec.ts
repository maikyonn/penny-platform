import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it, vi } from 'vitest';

const loadUserContextMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/user-context', () => ({
	loadUserContext: loadUserContextMock
}));

import { load } from '../../../src/routes/(app)/dashboard/+page.server';

function createFirestoreStub(): Firestore {
	const campaignDocs = [
		{
			id: 'campaign-1',
			data: () => ({
				name: 'Launch',
				status: 'active',
				description: 'Launch campaign',
				createdAt: new Date('2024-01-01T00:00:00Z'),
				schedule: { startAt: new Date('2024-01-05T00:00:00Z') }
			})
		},
		{
			id: 'campaign-2',
			data: () => ({
				name: 'Follow-up',
				status: 'draft',
				description: null,
				createdAt: new Date('2024-01-10T00:00:00Z')
			})
		}
	];

	const targetsDocs = [
		{
			id: 'target-1',
			data: () => ({
				status: 'invited'
			})
		},
		{
			id: 'target-2',
			data: () => ({
				status: 'accepted'
			})
		}
	];

	return {
		collection: (name: string) => {
			if (name !== 'outreach_campaigns') {
				throw new Error(`Unsupported collection ${name}`);
			}
			return {
				where: () => ({
					orderBy: () => ({
						get: async () => ({
							docs: campaignDocs
						})
					})
				})
			};
		},
		collectionGroup: (group: string) => {
			if (group !== 'targets') {
				throw new Error(`Unsupported group ${group}`);
			}
			return {
				where: () => ({
					get: async () => ({
						forEach: (callback: (doc: any) => void) => targetsDocs.forEach(callback)
					})
				})
			};
		}
	} as unknown as Firestore;
}

describe('dashboard load', () => {
	it('aggregates campaign and influencer stats', async () => {
		loadUserContextMock.mockResolvedValue({
			firebaseUser: { uid: 'user-1' },
			profile: { user_id: 'user-1', full_name: 'Demo', avatar_url: null, locale: null }
		});

		const result = await load({
			locals: { firestore: createFirestoreStub() }
		} as any);

		expect(result.campaigns).toHaveLength(2);
		expect(result.campaignCounts.total).toBe(2);
		expect(result.campaignCounts.active).toBe(1);
		expect(result.influencerSummary.total).toBe(2);
		expect(result.influencerSummary.invited).toBe(1);
		expect(result.influencerSummary.accepted).toBe(1);
	});
});
