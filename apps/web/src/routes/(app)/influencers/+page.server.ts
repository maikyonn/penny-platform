import { fail, redirect } from "@sveltejs/kit";
import { Timestamp } from "firebase-admin/firestore";
import { loadUserContext } from "$lib/server/user-context";
import type { Actions, PageServerLoad } from "./$types";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

export const load: PageServerLoad = async ({ locals }) => {
  const { firebaseUser, profile } = await loadUserContext(locals);
  if (!firebaseUser) {
    throw redirect(303, "/sign-in");
  }

  const campaignsSnapshot = await locals.firestore
    .collection("outreach_campaigns")
    .where("ownerUid", "==", firebaseUser.uid)
    .orderBy("createdAt", "desc")
    .get();

  const campaigns = campaignsSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: (data.name as string) ?? "Untitled Campaign",
      status: (data.status as string) ?? "draft",
    };
  });

  const influencersSnapshot = await locals.firestore
    .collection("influencers")
    .orderBy("metrics.followers", "desc")
    .limit(50)
    .get();

  const influencers = influencersSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      display_name: (data.displayName as string) ?? (data.handle as string) ?? "Creator",
      handle: data.handle ?? null,
      platform: data.platform ?? null,
      follower_count: toNumber(data.metrics?.followers),
      engagement_rate: toNumber(data.metrics?.engagementRate),
      location: data.location ?? null,
      verticals: (data.categories as string[]) ?? [],
    };
  });

  return {
    profile,
    campaigns,
    influencers,
  };
};

export const actions: Actions = {
  assign: async ({ request, locals }) => {
    const { firebaseUser } = await loadUserContext(locals);
    if (!firebaseUser) {
      throw redirect(303, "/sign-in");
    }

    const formData = await request.formData();
    const campaignId = String(formData.get("campaign_id") ?? "").trim();
    const influencerId = String(formData.get("influencer_id") ?? "").trim();

    if (!campaignId || !influencerId) {
      return fail(400, { error: "Pick a campaign before adding an influencer." });
    }

    const campaignRef = locals.firestore.collection("outreach_campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists || campaignSnap.data()?.ownerUid !== firebaseUser.uid) {
      return fail(403, { error: "You can only add creators to your own campaigns." });
    }

    const targetRef = campaignRef.collection("targets").doc(influencerId);
    const existingSnap = await targetRef.get();

    if (existingSnap.exists) {
      return fail(400, { error: "That creator is already linked to this campaign." });
    }

    const influencerRef = locals.firestore.collection("influencers").doc(influencerId);
    const influencerSnap = await influencerRef.get();

    if (!influencerSnap.exists) {
      return fail(404, { error: "Influencer not found." });
    }

    const now = Timestamp.now();

    await targetRef.set({
      influencerId,
      campaignId,
      email: influencerSnap.data()?.emails?.[0] ?? "",
      name: influencerSnap.data()?.displayName ?? null,
      status: "pending",
      scheduledAt: null,
      sentAt: null,
      lastMessageAt: null,
      replyAt: null,
      gmailThreadId: null,
      lastGmailMessageId: null,
      messageCount: 0,
      priority: 0,
      createdAt: now,
      updatedAt: now,
    });

    await campaignRef.set(
      {
        totals: {
          pending: (campaignSnap.data()?.totals?.pending ?? 0) + 1,
        },
        updatedAt: now,
      },
      { merge: true },
    );

    return { success: true };
  },
};
