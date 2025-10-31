import { error, fail, redirect } from "@sveltejs/kit";
import { Timestamp } from "firebase-admin/firestore";
import { loadUserContext } from "$lib/server/user-context";
import { seedMockInfluencersForCampaign } from "$lib/server/mock-influencers";
import type { Actions, PageServerLoad } from "./$types";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

function directionFromMessage(direction: string | undefined) {
  if (direction === "outgoing") return "brand";
  if (direction === "incoming") return "influencer";
  return "brand";
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const { firebaseUser, profile } = await loadUserContext(locals);
  if (!firebaseUser) {
    throw redirect(303, "/sign-in");
  }

  const campaignId = params.id;
  const firestore = locals.firestore;
  const campaignRef = firestore.collection("outreach_campaigns").doc(campaignId);
  const campaignSnap = await campaignRef.get();

  if (!campaignSnap.exists) {
    throw error(404, "Campaign not found");
  }

  const campaignData = campaignSnap.data() ?? {};
  if (campaignData.ownerUid !== firebaseUser.uid) {
    throw error(403, "Forbidden");
  }

  const campaign = {
    id: campaignSnap.id,
    name: (campaignData.name as string) ?? "Untitled campaign",
    status: (campaignData.status as string) ?? "draft",
    objective: (campaignData.description as string) ?? null,
    budget_cents: (campaignData.budgetCents as number) ?? null,
    currency: (campaignData.currency as string) ?? "USD",
    landing_page_url: (campaignData.landingPageUrl as string) ?? null,
    start_date: toIso(campaignData.schedule?.startAt),
    end_date: toIso(campaignData.schedule?.endAt),
    created_at: toIso(campaignData.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(campaignData.updatedAt) ?? new Date().toISOString(),
    created_by: campaignData.ownerUid as string,
  };

  const targetsSnapshot = await campaignRef.collection("targets").get();
  let targets = targetsSnapshot.docs.map((doc) => ({
    id: doc.id,
    platforms: (doc.data().platforms as string[] | undefined) ?? [],
    interests: (doc.data().interests as string[] | undefined) ?? [],
    geos: (doc.data().geos as string[] | undefined) ?? [],
    audience: (doc.data().audience as Record<string, unknown> | undefined) ?? {},
    status: (doc.data().status as string | undefined) ?? "prospect",
    influencerId: (doc.data().influencerId as string | undefined) ?? doc.id,
    matchScore: (doc.data().matchScore as number | undefined) ?? null,
    source: (doc.data().source as string | undefined) ?? "manual",
  }));

  if (!targets.length) {
    await seedMockInfluencersForCampaign(campaignId, { db: firestore });
    const refreshedTargets = await campaignRef.collection("targets").get();
    targets = refreshedTargets.docs.map((doc) => ({
      id: doc.id,
      platforms: (doc.data().platforms as string[] | undefined) ?? [],
      interests: (doc.data().interests as string[] | undefined) ?? [],
      geos: (doc.data().geos as string[] | undefined) ?? [],
      audience: (doc.data().audience as Record<string, unknown> | undefined) ?? {},
      status: (doc.data().status as string | undefined) ?? "prospect",
      influencerId: (doc.data().influencerId as string | undefined) ?? doc.id,
      matchScore: (doc.data().matchScore as number | undefined) ?? null,
      source: (doc.data().source as string | undefined) ?? "manual",
    }));
  }

  const influencerIds = Array.from(new Set(targets.map((target) => target.influencerId).filter(Boolean))) as string[];
  const influencerMap = new Map<string, { id: string; display_name: string | null; handle: string | null; platform: string | null; follower_count: number | null; engagement_rate: number | null; location: string | null }>();

  await Promise.all(
    influencerIds.map(async (influencerId) => {
      try {
        const snap = await firestore.collection("influencers").doc(influencerId).get();
        if (snap.exists) {
          const data = snap.data() ?? {};
          influencerMap.set(influencerId, {
            id: snap.id,
            display_name: (data.displayName as string) ?? null,
            handle: (data.handle as string) ?? null,
            platform: (data.platform as string) ?? null,
            follower_count: (data.followerCount as number) ?? null,
            engagement_rate: (data.engagementRate as number) ?? null,
            location: (data.location as string) ?? null,
          });
        }
      } catch (fetchError) {
        console.warn("[campaign detail] failed to load influencer", influencerId, fetchError);
      }
    }),
  );

  const threadsSnapshot = await firestore
    .collection("threads")
    .where("userId", "==", firebaseUser.uid)
    .where("campaignId", "==", campaignId)
    .get();

  const threadMessages = new Map<string, Array<{ direction: string; body: string; sent_at: string }>>();
  const threadMeta = new Map<string, { id: string; channel: string; last_message_at: string | null; messagesCount: number }>();

  await Promise.all(
    threadsSnapshot.docs.map(async (doc) => {
      const data = doc.data() ?? {};
      const influencerId = (data.influencerId as string | undefined) ?? "";
      const messagesSnapshot = await doc.ref.collection("messages").orderBy("sentAt").get();
      const messages = messagesSnapshot.docs.map((messageDoc) => {
        const messageData = messageDoc.data() ?? {};
        return {
          direction: directionFromMessage(messageData.direction as string | undefined),
          body: (messageData.bodyText as string) ?? (messageData.bodyHtml as string) ?? "",
          sent_at: toIso(messageData.sentAt) ?? new Date().toISOString(),
        };
      });
      threadMessages.set(influencerId, messages);
      threadMeta.set(influencerId, {
        id: doc.id,
        channel: (data.channel as string) ?? "email",
        last_message_at: toIso(data.lastMessageAt),
        messagesCount: (data.messagesCount as number | undefined) ?? messages.length,
      });
    }),
  );

  const assignments = targets.map((target) => {
    const influencer = target.influencerId ? influencerMap.get(target.influencerId) ?? null : null;
    const meta = target.influencerId ? threadMeta.get(target.influencerId) ?? null : null;
    const messages = target.influencerId ? threadMessages.get(target.influencerId) ?? [] : [];
    const thread = meta
      ? {
          id: meta.id,
          campaign_influencer_id: target.id,
          channel: meta.channel,
          last_message_at: meta.last_message_at,
          campaign_id: params.id,
          messagesCount: meta.messagesCount,
        }
      : null;

    return {
      id: target.id,
      status: target.status,
      source: target.source,
      match_score: target.matchScore,
      last_message_at: thread?.last_message_at ?? null,
      influencer,
      thread,
      messages,
    };
  });

  const statusSummary = assignments.reduce(
    (acc, assignment) => {
      acc.total += 1;
      const key = assignment.status as keyof typeof acc.byStatus;
      if (key in acc.byStatus) {
        acc.byStatus[key] += 1;
      }
      return acc;
    },
    {
      total: 0,
      byStatus: {
        prospect: 0,
        invited: 0,
        accepted: 0,
        declined: 0,
        in_conversation: 0,
        contracted: 0,
        completed: 0,
      },
    },
  );

  const since = new Date(Date.now() - THIRTY_DAYS_MS);
  const metrics: Array<{ metric_date: string; impressions: number; clicks: number; conversions: number; spend_cents: number }> = [];
  if (campaignData.metrics?.history) {
    for (const entry of campaignData.metrics.history as Array<Record<string, unknown>>) {
      const metricDate = entry.metric_date as string | undefined;
      if (!metricDate || new Date(metricDate) < since) continue;
      metrics.push({
        metric_date: metricDate,
        impressions: Number(entry.impressions ?? 0),
        clicks: Number(entry.clicks ?? 0),
        conversions: Number(entry.conversions ?? 0),
        spend_cents: Number(entry.spend_cents ?? 0),
      });
    }
  }

  return {
    campaign,
    profile,
    targets,
    assignments,
    metrics,
    statusSummary,
  };
};

export const actions: Actions = {
  sendMessage: async ({ request, locals, params }) => {
    const { firebaseUser } = await loadUserContext(locals);
    if (!firebaseUser) {
      throw redirect(303, "/sign-in");
    }

    const formData = await request.formData();
    const assignmentId = String(formData.get("campaign_influencer_id") ?? "").trim();
    const messageBody = String(formData.get("message") ?? "").trim();

    if (!assignmentId || !messageBody) {
      return fail(400, { error: "Write a message before sending." });
    }

    const firestore = locals.firestore;
    const campaignRef = firestore.collection("outreach_campaigns").doc(params.id);
    const targetRef = campaignRef.collection("targets").doc(assignmentId);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      return fail(404, { error: "Creator assignment not found." });
    }

    const targetData = targetSnap.data() ?? {};
    const influencerId = (targetData.influencerId as string | undefined) ?? assignmentId;

    const threadQuery = await firestore
      .collection("threads")
      .where("campaignId", "==", params.id)
      .where("userId", "==", firebaseUser.uid)
      .where("influencerId", "==", influencerId)
      .limit(1)
      .get();

    let threadRef = threadQuery.docs[0]?.ref;
    let threadData = threadQuery.docs[0]?.data() ?? null;
    const now = new Date();

    if (!threadRef) {
      threadRef = firestore.collection("threads").doc();
      await threadRef.set({
        userId: firebaseUser.uid,
        campaignId: params.id,
        influencerId,
        contactEmail: targetData.email ?? "",
        gmailThreadId: null,
        gmailLabelId: null,
        status: "open",
        channel: "email",
        lastMessageAt: now,
        messagesCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      threadData = {
        messagesCount: 0,
      };
    }

    await threadRef.collection("messages").add({
      direction: "outgoing",
      subject: null,
      bodyHtml: messageBody,
      bodyText: messageBody,
      snippet: messageBody.slice(0, 160),
      gmailMessageId: `local-${Date.now()}`,
      sentAt: now,
      createdAt: now,
    });

    await threadRef.set(
      {
        lastMessageAt: now,
        updatedAt: now,
        messagesCount: (threadData?.messagesCount as number | undefined ?? 0) + 1,
      },
      { merge: true },
    );

    await targetRef.set(
      {
        lastMessageAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    return { success: true, campaignId: params.id };
  },
};
