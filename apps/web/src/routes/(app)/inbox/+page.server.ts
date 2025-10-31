import { fail, redirect } from "@sveltejs/kit";
import { Timestamp } from "firebase-admin/firestore";
import { loadUserContext } from "$lib/server/user-context";
import type { Actions, PageServerLoad } from "./$types";

const THREAD_LIMIT = 20;

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

async function loadInfluencers(
  firestore: FirebaseFirestore.Firestore,
  ids: Set<string>,
) {
  const entries = new Map<string, { display_name: string | null; handle: string | null }>();
  const idList = Array.from(ids);

  await Promise.all(
    idList.map(async (influencerId) => {
      try {
        const snap = await firestore.collection("influencers").doc(influencerId).get();
        if (snap.exists) {
          const data = snap.data() ?? {};
          entries.set(influencerId, {
            display_name: (data.displayName as string) ?? (data.handle as string) ?? null,
            handle: (data.handle as string) ?? null,
          });
        }
      } catch (error) {
        console.warn("[inbox] failed to load influencer", influencerId, error);
      }
    }),
  );

  return entries;
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

  const campaigns = campaignsSnapshot.docs.map((doc) => ({
    id: doc.id,
    name: (doc.data().name as string) ?? "Untitled Campaign",
  }));

  const threadQuery = await locals.firestore
    .collection("threads")
    .where("userId", "==", firebaseUser.uid)
    .orderBy("lastMessageAt", "desc")
    .limit(THREAD_LIMIT)
    .get();

  const influencerIds = new Set<string>();
  threadQuery.docs.forEach((doc) => {
    const data = doc.data();
    if (data.influencerId) {
      influencerIds.add(data.influencerId as string);
    }
  });

  const influencers = await loadInfluencers(locals.firestore, influencerIds);

  const threads = await Promise.all(
    threadQuery.docs.map(async (doc) => {
      const data = doc.data();
      const messagesSnapshot = await doc.ref.collection("messages").orderBy("sentAt").get();

      const messages = messagesSnapshot.docs.map((messageDoc) => {
        const messageData = messageDoc.data();
        const direction = messageData.direction as string | undefined;
        return {
          id: messageDoc.id,
          direction: direction === "outgoing" ? "brand" : direction === "incoming" ? "influencer" : direction ?? "brand",
          body: (messageData.bodyText as string) ?? (messageData.bodyHtml as string) ?? "",
          sent_at: toIso(messageData.sentAt) ?? new Date().toISOString(),
        };
      });

      const influencerId = data.influencerId as string | undefined;
      const influencer = influencerId ? influencers.get(influencerId) ?? null : null;

      return {
        id: doc.id,
        campaign_influencer_id: doc.id,
        channel: (data.channel as string) ?? "email",
        last_message_at: toIso(data.lastMessageAt),
        campaign_id: (data.campaignId as string) ?? null,
        status: (data.status as string) ?? "open",
        influencer,
        messages,
      };
    }),
  );

  return {
    profile,
    campaigns,
    threads,
  };
};

export const actions: Actions = {
  sendMessage: async ({ request, locals }) => {
    const { firebaseUser } = await loadUserContext(locals);
    if (!firebaseUser) {
      throw redirect(303, "/sign-in");
    }

    const formData = await request.formData();
    const threadId = String(formData.get("thread_id") ?? "").trim();
    const messageBody = String(formData.get("message") ?? "").trim();

    if (!threadId || !messageBody) {
      return fail(400, { error: "Type a message before sending." });
    }

    const threadRef = locals.firestore.collection("threads").doc(threadId);
    const threadSnap = await threadRef.get();

    if (!threadSnap.exists) {
      return fail(404, { error: "Conversation not found." });
    }

    const threadData = threadSnap.data() ?? {};
    if (threadData.userId !== firebaseUser.uid) {
      return fail(403, { error: "You do not have permission to reply to this conversation." });
    }

    const now = new Date();

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
        messagesCount: (threadData.messagesCount ?? 0) + 1,
      },
      { merge: true },
    );

    return { success: true };
  },
};
