import { error, fail, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { FieldValue } from "firebase-admin/firestore";
import { loadUserContext } from "$lib/server/user-context";
import { signInWithCustomToken } from "$lib/server/firebase-identity";
import type { Actions, PageServerLoad } from "./$types";

type ConversationTurn = {
  role: string;
  content: string;
  created_at: string;
  kind: string;
};

function formatConversation(conversation: Array<{ role: string; content: string; kind?: string }>) {
  const now = Date.now();
  return conversation.map((turn, index) => ({
    role: turn.role === "assistant" ? "assistant" : "user",
    content: turn.content,
    kind: turn.kind ?? "bubble",
    created_at: new Date(now - (conversation.length - index) * 500).toISOString(),
  }));
}

function getFunctionsBase(projectId: string, emulator: boolean) {
  return emulator
    ? `http://127.0.0.1:9004/${projectId}/us-central1`
    : `https://us-central1-${projectId}.cloudfunctions.net`;
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const { firebaseUser } = await loadUserContext(locals);
  if (!firebaseUser) {
    throw redirect(303, "/sign-in");
  }

  const campaignRef = locals.firestore.collection("outreach_campaigns").doc(params.id);
  const campaignSnap = await campaignRef.get();

  if (!campaignSnap.exists) {
    throw error(404, "Campaign not found");
  }

  const campaign = campaignSnap.data() ?? {};
  if (campaign.ownerUid !== firebaseUser.uid) {
    throw error(403, "Forbidden");
  }

  const mockBaseUrl = env.MOCK_CHAT_BASE_URL ?? "";
  if (mockBaseUrl) {
    try {
      const response = await fetch(`${mockBaseUrl}/conversation`, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (response.ok) {
        const conversation = (await response.json()) as Array<{ role: string; content: string; kind?: string }>;
        return {
          campaign: { id: campaignSnap.id, name: campaign.name },
          sessionId: null,
          messages: formatConversation(conversation),
          mockChatActive: true,
        };
      }
    } catch (mockError) {
      console.warn("[campaign chat] mock server unavailable", mockError);
    }
  }

  const chatDoc = locals.firestore
    .collection("campaign_chat_sessions")
    .doc(`${firebaseUser.uid}_${params.id}`);
  const chatSnap = await chatDoc.get();
  const messages = (chatSnap.data()?.messages as ConversationTurn[] | undefined) ?? [];

  return {
    campaign: { id: campaignSnap.id, name: campaign.name },
    sessionId: chatDoc.id,
    messages,
    mockChatActive: Boolean(mockBaseUrl),
  };
};

export const actions: Actions = {
  send: async ({ request, locals, params }) => {
    const { firebaseUser } = await loadUserContext(locals);
    if (!firebaseUser) {
      throw redirect(303, "/sign-in");
    }

    const formData = await request.formData();
    const message = String(formData.get("message") ?? "").trim();

    if (!message) {
      return fail(400, { error: "Type a message to continue the briefing." });
    }

    const mockBaseUrl = env.MOCK_CHAT_BASE_URL ?? "";
    if (mockBaseUrl) {
      try {
        const response = await fetch(`${mockBaseUrl}/message`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ message }),
        });

        if (response.ok) {
          const payload = await response.json() as {
            reply: string;
            kind?: string;
            done?: boolean;
            conversation?: Array<{ role: string; content: string; kind?: string }>;
          };

          return {
            success: true,
            mockChat: true,
            done: payload.done ?? false,
            conversation: payload.conversation ? formatConversation(payload.conversation) : null,
          };
        }
      } catch (mockError) {
        console.warn("[campaign chat] mock server invocation failed", mockError);
      }
    }

    const projectId = env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? "demo-penny-dev";
    const functionsBase = getFunctionsBase(projectId, env.FUNCTIONS_EMULATOR === "true");

    let idToken: string;
    try {
      const customToken = await locals.firebaseAuth.createCustomToken(firebaseUser.uid);
      const session = await signInWithCustomToken(customToken);
      idToken = session.idToken;
    } catch (tokenError) {
      console.error("[campaign chat] failed to mint ID token", tokenError);
      return fail(500, { error: "Unable to contact assistant right now." });
    }

    const response = await fetch(`${functionsBase}/supportAiRouter`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        orgId: null,
        query: message,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[campaign chat] supportAiRouter error", response.status, text);
      return fail(500, { error: "Assistant could not process the message." });
    }

    const chatDoc = locals.firestore
      .collection("campaign_chat_sessions")
      .doc(`${firebaseUser.uid}_${params.id}`);

    const nowIso = new Date().toISOString();
    await chatDoc.set(
      {
        messages: FieldValue.arrayUnion(
          { role: "user", content: message, created_at: nowIso, kind: "bubble" },
          { role: "assistant", content: "I'll route this request for you.", created_at: nowIso, kind: "bubble" },
        ),
        updatedAt: new Date(),
      },
      { merge: true },
    );

    return {
      success: true,
      mockChat: false,
      session_id: chatDoc.id,
    };
  },
};
