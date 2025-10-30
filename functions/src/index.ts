import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onMessagePublished } from "firebase-functions/v2/pubsub";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Export HTTP functions
export { gmailSend, gmailAuthorize } from "./gmail.js";
export { stripeWebhook } from "./stripe.js";
export { campaignsCreate, campaignsMatch } from "./campaigns.js";
export { aiDraftOutreach, chatbotStub, supportAiRouter } from "./ai.js";
export { reportsGenerate } from "./reports.js";
export { searchStub } from "./search.js";

// Export scheduled functions
export { billingMeter } from "./cron/billing-meter.js";
export { refreshInfluencers } from "./cron/refresh-influencers.js";

// Export Pub/Sub handlers
export { outreachSend } from "./pubsub/outreach-send.js";

// Helper function to verify Firebase ID token
export async function verifyUser(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }
  const idToken = authHeader.split(" ")[1];
  const decoded = await getAuth().verifyIdToken(idToken);
  return decoded;
}

