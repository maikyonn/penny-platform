import { onRequest } from "firebase-functions/v2/https";
import { verifyUser } from "./index.js";
import { adminDb } from "./firebase.js";

const db = adminDb;

type SearchFilters = {
  platforms?: string[];
  niches?: string[];
  followerMin?: number | null;
  followerMax?: number | null;
  minEngagement?: number | null;
  locations?: string[];
};

export const search = onRequest(async (req, res) => {
  try {
    await verifyUser(req.headers.authorization);
    const { query, filters }: { query?: string; filters?: SearchFilters } = req.body ?? {};

    let baseQuery: FirebaseFirestore.Query = db.collection("influencers");

    if (filters?.platforms?.length === 1) {
      baseQuery = baseQuery.where("platform", "==", filters.platforms[0]);
    }
    if (filters?.locations?.length === 1) {
      baseQuery = baseQuery.where("location", "==", filters.locations[0]);
    }
    if (filters?.niches?.length === 1) {
      baseQuery = baseQuery.where("categories", "array-contains", filters.niches[0]);
    }
    if (filters?.followerMin != null) {
      baseQuery = baseQuery.where("metrics.followers", ">=", Number(filters.followerMin));
    }
    if (filters?.followerMax != null) {
      baseQuery = baseQuery.where("metrics.followers", "<=", Number(filters.followerMax));
    }
    if (filters?.minEngagement != null) {
      baseQuery = baseQuery.where("metrics.engagementRate", ">=", Number(filters.minEngagement));
    }

    const snapshot = await baseQuery.orderBy("metrics.followers", "desc").limit(50).get();

    const normalized = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        displayName: data.displayName ?? data.handle ?? "Creator",
        handle: data.handle ?? null,
        platform: data.platform ?? null,
        followerCount: data.metrics?.followers ?? 0,
        engagementRate: data.metrics?.engagementRate ?? null,
        location: data.location ?? null,
        categories: data.categories ?? [],
        queryMatch: query ?? null
      };
    });

    res.json({
      success: true,
      results: normalized
    });
  } catch (error: any) {
    console.error("Search error:", error);
    res.status(500).json({ error: error.message });
  }
});
