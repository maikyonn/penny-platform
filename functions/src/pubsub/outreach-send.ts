import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { adminDb } from "../firebase.js";

const db = adminDb;

export const outreachSend = onMessagePublished("outreach-send", async (event) => {
  const message = event.data.message;
  const payload = JSON.parse(message.data.toString());

  const { orgId, campaignId, influencerId, threadId, subject, body } = payload;

  try {
    // Send outreach message (via Gmail API or other channel)
    // Then write to Firestore
    
    const messageRef = db
      .collection("organizations")
      .doc(orgId)
      .collection("campaigns")
      .doc(campaignId)
      .collection("influencers")
      .doc(influencerId)
      .collection("threads")
      .doc(threadId)
      .collection("messages")
      .doc();

    await messageRef.set({
      direction: "brand",
      body,
      attachments: [],
      sentAt: new Date(),
      authorId: payload.authorId,
    });

    console.log(`Outreach message sent: ${messageRef.id}`);
  } catch (error) {
    console.error("Outreach send error:", error);
    throw error;
  }
});
