import { onRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { verifyUser } from "./index.js";
import { adminDb } from "./firebase.js";

const db = adminDb;

export const aiDraftOutreach = onRequest(async (req, res) => {
  try {
    const user = await verifyUser(req.headers.authorization);
    const { orgId, campaignId, influencerId, context } = req.body;

    // Stub AI response for now
    const draft = `Hi ${context.influencerName || "there"},

I hope this message finds you well! I'm reaching out on behalf of ${context.brandName || "our brand"} regarding a potential collaboration opportunity.

${context.campaignDetails || "We think you'd be a great fit for our upcoming campaign."}

Would you be interested in learning more?

Best regards,
${context.senderName || "The Team"}`;

    res.json({ success: true, draft });
  } catch (error: any) {
    console.error("AI draft error:", error);
    res.status(500).json({ error: error.message });
  }
});

export const chatbotStub = onRequest(async (req, res) => {
  try {
    const user = await verifyUser(req.headers.authorization);
    const { orgId, sessionId, message } = req.body;

    // Store user message
    if (sessionId) {
      await db.collection("organizations").doc(orgId).collection("chatSessions").doc(sessionId).collection("messages").add({
        role: "user",
        content: message,
        metadata: {},
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // Stub AI response
    const response = "I'm a chatbot stub. In production, I'll provide helpful campaign management assistance.";

    // Store assistant response
    if (sessionId) {
      await db.collection("organizations").doc(orgId).collection("chatSessions").doc(sessionId).collection("messages").add({
        role: "assistant",
        content: response,
        metadata: {},
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    res.json({ success: true, response });
  } catch (error: any) {
    console.error("Chatbot error:", error);
    res.status(500).json({ error: error.message });
  }
});

export const supportAiRouter = onRequest(async (req, res) => {
  try {
    const user = await verifyUser(req.headers.authorization);
    const { orgId, query } = req.body;

    // Simple routing stub
    const intent = query.toLowerCase().includes("billing") ? "billing" : "general";
    
    res.json({ success: true, intent, routed: true });
  } catch (error: any) {
    console.error("Support router error:", error);
    res.status(500).json({ error: error.message });
  }
});
