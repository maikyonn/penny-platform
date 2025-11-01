import { adminAuth } from "./firebase.js";

// Export HTTP functions
export { gmailSend, gmailAuthorize } from "./gmail.js";
export { stripeWebhook } from "./stripe.js";
export { campaignsCreate, campaignsMatch } from "./campaigns.js";
export { aiDraftOutreach, chatbotIntake, supportAiRouter } from "./ai.js";
export { reportsGenerate } from "./reports.js";
export { search } from "./search.js";

// Export scheduled functions
export { billingMeter } from "./cron/billing-meter.js";
export { refreshInfluencers } from "./cron/refresh-influencers.js";

// Export Pub/Sub handlers
export { outreachSendTopic } from "./pubsub/outreach-send.js";

// Helper function to verify Firebase ID token
export async function verifyUser(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }
  const idToken = authHeader.split(" ")[1];
  const decoded = await adminAuth.verifyIdToken(idToken);
  return decoded;
}
