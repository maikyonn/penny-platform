import { redirect } from "@sveltejs/kit";
import { Timestamp } from "firebase-admin/firestore";
import { loadUserContext } from "$lib/server/user-context";
import type { PageServerLoad } from "./$types";

type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  created_at: string | null;
  start_date: string | null;
  end_date: string | null;
};

type InfluencerSummary = {
  total: number;
  invited: number;
  accepted: number;
  in_conversation: number;
  completed: number;
};

function toIso(input: unknown): string | null {
  if (!input) return null;
  if (input instanceof Date) return input.toISOString();
  if (input instanceof Timestamp) return input.toDate().toISOString();
  return null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export const load: PageServerLoad = async ({ locals }) => {
  const { firebaseUser, profile } = await loadUserContext(locals);

  if (!firebaseUser) {
    throw redirect(303, "/sign-in");
  }

  const firestore = locals.firestore;

  const campaignsSnapshot = await firestore
    .collection("outreach_campaigns")
    .where("ownerUid", "==", firebaseUser.uid)
    .orderBy("createdAt", "desc")
    .get();

  const campaignList: CampaignSummary[] = campaignsSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: (data.name as string) ?? "Untitled Campaign",
      status: (data.status as string) ?? "draft",
      objective: (data.description as string) ?? null,
      created_at: toIso(data.createdAt),
      start_date: toIso(data.schedule?.startAt ?? null),
      end_date: toIso(data.schedule?.endAt ?? null),
    };
  });

  const campaignCounts = {
    total: campaignList.length,
    active: campaignList.filter((campaign) => campaign.status === "active").length,
    draft: campaignList.filter((campaign) => campaign.status === "draft").length,
    completed: campaignList.filter((campaign) => campaign.status === "completed").length,
  };

  const influencerSummary: InfluencerSummary = {
    total: 0,
    invited: 0,
    accepted: 0,
    in_conversation: 0,
    completed: 0,
  };

  const campaignIds = campaignList.map((campaign) => campaign.id);

  if (campaignIds.length) {
    for (const batch of chunk(campaignIds, 10)) {
      const targetsSnapshot = await firestore
        .collectionGroup("targets")
        .where("campaignId", "in", batch)
        .get();

      targetsSnapshot.forEach((doc) => {
        const status = doc.data().status as string | undefined;
        influencerSummary.total += 1;
        switch (status) {
          case "invited":
            influencerSummary.invited += 1;
            break;
          case "accepted":
            influencerSummary.accepted += 1;
            break;
          case "in_conversation":
            influencerSummary.in_conversation += 1;
            break;
          case "completed":
            influencerSummary.completed += 1;
            break;
          default:
            break;
        }
      });
    }
  }

  const metricsSummary = {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend_cents: 0,
  };

  return {
    firebaseUser,
    profile,
    campaigns: campaignList,
    campaignCounts,
    influencerSummary,
    metricsSummary,
  };
};
