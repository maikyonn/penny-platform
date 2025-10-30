import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyUser } from "./index";
import { google } from "googleapis";

const db = getFirestore();

export const gmailAuthorize = onRequest(
  { secrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  async (req, res) => {
    try {
      const user = await verifyUser(req.headers.authorization);
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: "Missing authorization code" });
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        req.body.redirectUri || "http://localhost:9200/auth/gmail/callback"
      );

      const { tokens } = await oauth2Client.getToken(code);
      
      // Store tokens in Firestore
      await db.collection("gmailAccounts").doc(user.uid).set({
        email: user.email || "",
        token: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          scope: tokens.scope?.split(" ") || [],
          tokenType: tokens.token_type || "Bearer",
          expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }, { merge: true });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Gmail authorize error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export const gmailSend = onRequest(
  { secrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  async (req, res) => {
    try {
      const user = await verifyUser(req.headers.authorization);
      const { orgId, campaignId, influencerId, subject, body, threadId } = req.body;

      // Check if Gmail is stubbed
      const gmailStub = process.env.GMAIL_STUB === "1";

      if (gmailStub) {
        // Stub mode: just write to Firestore
        const messageRef = db
          .collection("organizations")
          .doc(orgId)
          .collection("campaigns")
          .doc(campaignId)
          .collection("influencers")
          .doc(influencerId)
          .collection("threads")
          .doc(threadId || `thread_${Date.now()}`)
          .collection("messages")
          .doc();

        await messageRef.set({
          direction: "brand",
          body,
          attachments: [],
          sentAt: new Date(),
          authorId: user.uid,
        });

        return res.json({ success: true, messageId: messageRef.id, stubbed: true });
      }

      // Real Gmail integration would go here
      // Load tokens from Firestore, refresh if needed, send email via Gmail API

      res.json({ success: true });
    } catch (error: any) {
      console.error("Gmail send error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

