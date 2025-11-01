import { fail, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { FieldValue } from "firebase-admin/firestore";
import { loadUserContext } from "$lib/server/user-context";
import { signInWithCustomToken } from "$lib/server/firebase-identity";
import type { Actions, PageServerLoad } from "./$types";

const CHATBOT_STUB_MODE = env.CHATBOT_STUB_MODE === "1";

function getFunctionsBase(projectId: string, emulator: boolean) {
  return emulator
    ? `http://127.0.0.1:9004/${projectId}/us-central1`
    : `https://us-central1-${projectId}.cloudfunctions.net`;
}

export const load: PageServerLoad = async ({ locals }) => {
  const { firebaseUser } = await loadUserContext(locals);
  if (!firebaseUser) {
    throw redirect(303, "/sign-in");
  }

  return { firebaseUser };
};

export const actions: Actions = {
  send: async ({ request, locals }) => {
    const { firebaseUser } = await loadUserContext(locals);
    if (!firebaseUser) {
      throw redirect(303, "/sign-in");
    }

    const formData = await request.formData();
    const message = String(formData.get("message") ?? "").trim();

    if (!message) {
      return fail(400, { error: "Message cannot be empty." });
    }

    const name = String(formData.get("name") ?? "").trim() || "New Launch";
    const objective = String(formData.get("objective") ?? "").trim() || null;
    const landingPageUrl = String(formData.get("landing_page_url") ?? "").trim() || null;

    if (CHATBOT_STUB_MODE) {
      const nowIso = new Date().toISOString();
      return {
        success: true,
        conversation: [
          { role: "assistant", kind: "bubble", content: "Tell me about your campaign.", created_at: nowIso },
          { role: "user", kind: "bubble", content: message, created_at: nowIso },
          { role: "assistant", kind: "card", content: `Your campaign **${name}** is ready. Open outreach: /campaign/cmp_stub/outreach`, created_at: nowIso },
        ],
        campaign_id: "cmp_stub",
      };
    }

    const projectId = env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? "demo-penny-dev";
    const functionsBase = getFunctionsBase(projectId, env.FUNCTIONS_EMULATOR === "true");

    let idToken: string;
    try {
      const customToken = await locals.firebaseAuth.createCustomToken(firebaseUser.uid);
      const session = await signInWithCustomToken(customToken);
      idToken = session.idToken;
    } catch (tokenError) {
      console.error("[chatbot] failed to mint ID token", tokenError);
      return fail(500, { error: "Assistant is unavailable at the moment." });
    }

    const response = await fetch(`${functionsBase}/chatbotIntake`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        orgId: null,
        sessionId: `${firebaseUser.uid}-default`,
        message,
        campaign: { name, objective, landingPageUrl },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[chatbot] function error", response.status, text);
      return fail(500, { error: "Assistant could not respond. Please try again." });
    }

    const payload = await response.json() as {
      success: boolean;
      response?: string;
      campaignId?: string | null;
      search?: unknown;
    };

    const now = new Date();
    await locals.firestore
      .collection("campaign_chatbot_history")
      .doc(`${firebaseUser.uid}_default`)
      .set(
        {
          messages: FieldValue.arrayUnion(
            { role: "user", content: message, created_at: now.toISOString(), kind: "bubble" },
            { role: "assistant", content: payload.response ?? "Thanks for the details!", created_at: now.toISOString(), kind: "bubble" },
          ),
          updatedAt: now,
        },
        { merge: true },
      );

    return {
      success: true,
      conversation: [
        { role: "assistant", kind: "bubble", content: "Tell me about your campaign.", created_at: now.toISOString() },
        { role: "user", kind: "bubble", content: message, created_at: now.toISOString() },
        { role: "assistant", kind: "bubble", content: payload.response ?? "Great! I've noted that.", created_at: now.toISOString() },
      ],
      campaign_id: payload.campaignId ?? null,
      search: payload.search ?? null,
    };
  },
};
