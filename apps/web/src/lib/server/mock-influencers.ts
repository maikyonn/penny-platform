import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "$lib/server/firebase-admin";

type MockInfluencerSeed = {
  external_id: string;
  display_name: string;
  handle: string;
  platform: string;
  follower_count: number;
  engagement_rate: number;
  location: string;
  verticals: string[];
  languages: string[];
};

type InfluencerDoc = {
  id: string;
  display_name: string | null;
  handle: string | null;
  platform: string | null;
  follower_count: number | null;
  engagement_rate: number | null;
  location: string | null;
  verticals: string[] | null;
  languages: string[] | null;
};

const MOCK_INFLUENCERS: MockInfluencerSeed[] = [
  { external_id: "mock_influencer_ava_ramos", display_name: "Ava Ramos", handle: "@ava.cooks", platform: "instagram", follower_count: 128_400, engagement_rate: 4.3, location: "Los Angeles, CA", verticals: ["food", "lifestyle", "wellness"], languages: ["en"] },
  { external_id: "mock_influencer_jasper_lee", display_name: "Jasper Lee", handle: "@jasper.codes", platform: "youtube", follower_count: 256_900, engagement_rate: 3.7, location: "Seattle, WA", verticals: ["technology", "education"], languages: ["en"] },
  { external_id: "mock_influencer_elena_ruiz", display_name: "Elena Ruiz", handle: "@elenaruizfit", platform: "tiktok", follower_count: 512_800, engagement_rate: 6.1, location: "Austin, TX", verticals: ["fitness", "wellness"], languages: ["en", "es"] },
  { external_id: "mock_influencer_mina_wong", display_name: "Mina Wong", handle: "@minawtravels", platform: "instagram", follower_count: 189_200, engagement_rate: 5.4, location: "San Francisco, CA", verticals: ["travel", "photography"], languages: ["en", "zh"] },
  { external_id: "mock_influencer_kai_thompson", display_name: "Kai Thompson", handle: "@soundbykai", platform: "youtube", follower_count: 342_100, engagement_rate: 4.8, location: "New York, NY", verticals: ["music", "producer", "tech"], languages: ["en"] },
  { external_id: "mock_influencer_lucia_gomez", display_name: "Lucía Gómez", handle: "@lucia.sipsslow", platform: "tiktok", follower_count: 402_300, engagement_rate: 7.2, location: "Miami, FL", verticals: ["beverage", "hospitality"], languages: ["en", "es"] },
  { external_id: "mock_influencer_omar_ali", display_name: "Omar Ali", handle: "@omarbuilds", platform: "instagram", follower_count: 98_500, engagement_rate: 4.9, location: "Chicago, IL", verticals: ["diy", "home_improvement", "design"], languages: ["en", "ar"] },
  { external_id: "mock_influencer_sasha_brooks", display_name: "Sasha Brooks", handle: "@brookssocial", platform: "youtube", follower_count: 221_750, engagement_rate: 3.4, location: "Denver, CO", verticals: ["social_media", "marketing"], languages: ["en"] },
  { external_id: "mock_influencer_devi_verma", display_name: "Devi Verma", handle: "@devieats", platform: "instagram", follower_count: 145_900, engagement_rate: 5.7, location: "San Jose, CA", verticals: ["food", "vegan", "wellness"], languages: ["en", "hi"] },
  { external_id: "mock_influencer_luke_nash", display_name: "Luke Nash", handle: "@lukeruns", platform: "tiktok", follower_count: 310_250, engagement_rate: 6.4, location: "Portland, OR", verticals: ["running", "fitness", "outdoors"], languages: ["en"] },
  { external_id: "mock_influencer_rachel_kim", display_name: "Rachel Kim", handle: "@rachelcreates", platform: "instagram", follower_count: 176_840, engagement_rate: 4.1, location: "Boston, MA", verticals: ["art", "diy", "home_decor"], languages: ["en", "ko"] },
  { external_id: "mock_influencer_mateo_silva", display_name: "Mateo Silva", handle: "@mateosips", platform: "youtube", follower_count: 284_670, engagement_rate: 3.9, location: "Los Angeles, CA", verticals: ["coffee", "lifestyle"], languages: ["en", "pt"] },
];

function pickRandom<T>(items: T[], count: number) {
  const maxCount = Math.max(1, Math.min(count, items.length));
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone.slice(0, maxCount);
}

function deterministicScore(campaignId: string, influencerId: string) {
  const seed = `${campaignId}:${influencerId}`;
  let hash = 17;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1000;
  }

  const min = 62;
  const max = 96;
  const spread = max - min + 1;
  return min + (hash % spread);
}

async function ensureMockInfluencersExist(db = adminDb): Promise<InfluencerDoc[]> {
  const influencers: InfluencerDoc[] = [];
  const now = new Date();

  await Promise.all(
    MOCK_INFLUENCERS.map(async (seed) => {
      const docRef = db.collection("influencers").doc(seed.external_id);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        await docRef.set({
          externalId: seed.external_id,
          displayName: seed.display_name,
          handle: seed.handle,
          platform: seed.platform,
          followerCount: seed.follower_count,
          engagementRate: seed.engagement_rate,
          location: seed.location,
          categories: seed.verticals,
          languages: seed.languages,
          source: "mock",
          createdAt: now,
          updatedAt: now,
        });
        influencers.push({
          id: seed.external_id,
          display_name: seed.display_name,
          handle: seed.handle,
          platform: seed.platform,
          follower_count: seed.follower_count,
          engagement_rate: seed.engagement_rate,
          location: seed.location,
          verticals: seed.verticals,
          languages: seed.languages,
        });
      } else {
        const data = snapshot.data() ?? {};
        influencers.push({
          id: snapshot.id,
          display_name: (data.displayName as string) ?? null,
          handle: (data.handle as string) ?? null,
          platform: (data.platform as string) ?? null,
          follower_count: (data.followerCount as number) ?? null,
          engagement_rate: (data.engagementRate as number) ?? null,
          location: (data.location as string) ?? null,
          verticals: (data.categories as string[]) ?? null,
          languages: (data.languages as string[]) ?? null,
        });
      }
    }),
  );

  return influencers;
}

type SeedOptions = {
  limit?: number;
  db?: FirebaseFirestore.Firestore;
};

export async function seedMockInfluencersForCampaign(
  campaignId: string,
  options?: SeedOptions,
) {
  const { limit = 6, db = adminDb } = options ?? {};
  const influencers = await ensureMockInfluencersExist(db);
  if (!influencers.length) return;

  const campaignRef = db.collection("outreach_campaigns").doc(campaignId);
  const campaignSnap = await campaignRef.get();
  if (!campaignSnap.exists) {
    console.warn("[mock-influencers] campaign not found", campaignId);
    return;
  }

  const targetsSnapshot = await campaignRef.collection("targets").get();
  const existingTargetIds = new Set<string>(targetsSnapshot.docs.map((doc) => doc.id));

  const selection = pickRandom(influencers, limit);
  const batch = db.batch();
  let writes = 0;

  selection.forEach((influencer) => {
    if (!influencer.id || existingTargetIds.has(influencer.id)) {
      return;
    }

    const targetRef = campaignRef.collection("targets").doc(influencer.id);
    const now = Timestamp.now();
    batch.set(targetRef, {
      influencerId: influencer.id,
      email: null,
      name: influencer.display_name ?? influencer.handle ?? null,
      status: "prospect",
      messageCount: 0,
      priority: 0,
      scheduledAt: null,
      sentAt: null,
      lastMessageAt: null,
      replyAt: null,
      gmailThreadId: null,
      lastGmailMessageId: null,
      customFields: {},
      createdAt: now,
      updatedAt: now,
      campaignId,
      source: "mock_seed",
      matchScore: deterministicScore(campaignId, influencer.id),
    });
    writes += 1;
  });

  if (writes > 0) {
    await batch.commit();
  }
}
