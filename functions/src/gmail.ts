import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { onRequest } from "firebase-functions/v2/https";
import { google } from "googleapis";
import { verifyUser } from "./index.js";
import { adminDb } from "./firebase.js";

const db = adminDb;
const secretClient = new SecretManagerServiceClient();

function getProjectId(): string {
  const projectId =
    process.env.SECRET_MANAGER_PROJECT_ID ||
    process.env.GCP_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.PROJECT_ID;

  if (!projectId) {
    throw new Error("Missing GCP project id: set SECRET_MANAGER_PROJECT_ID or GCP_PROJECT env var.");
  }

  return projectId;
}

async function ensureSecret(uid: string): Promise<string> {
  const projectId = getProjectId();
  const parent = `projects/${projectId}`;
  const secretId = `gmail-oauth-${uid}`;
  const secretName = `${parent}/secrets/${secretId}`;

  try {
    await secretClient.getSecret({ name: secretName });
  } catch (error: any) {
    if (error.code === 5) {
      await secretClient.createSecret({
        parent,
        secretId,
        secret: {
          replication: { automatic: {} },
        },
      });
    } else {
      throw error;
    }
  }

  return secretName;
}

async function storeTokens(uid: string, tokens: Record<string, unknown>) {
  if (!tokens.access_token && !tokens.refresh_token) {
    return;
  }

  if (process.env.FUNCTIONS_EMULATOR === "true") {
    // In emulator mode, skip Secret Manager but avoid persisting secrets in Firestore.
    console.warn("Skipping Secret Manager token storage in emulator mode.");
    return;
  }

  const secretName = await ensureSecret(uid);

  await secretClient.addSecretVersion({
    parent: secretName,
    payload: {
      data: Buffer.from(JSON.stringify(tokens), "utf8"),
    },
  });

  return secretName;
}

export const gmailAuthorize = onRequest(
  { secrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  async (req, res) => {
    try {
      const user = await verifyUser(req.headers.authorization);
      const { code } = req.body;

      if (!code) {
        res.status(400).json({ error: "Missing authorization code" });
        return;
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        req.body.redirectUri || "http://localhost:9200/auth/gmail/callback"
      );

      const { tokens } = await oauth2Client.getToken(code);

      const tokenSecretId = await storeTokens(user.uid, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        expiry: tokens.expiry_date,
      });

      await db
        .collection("users")
        .doc(user.uid)
        .collection("integrations")
        .doc("gmail")
        .set(
          {
            connected: true,
            emailAddress: tokens.id_token ? user.email ?? null : user.email ?? null,
            scopes: tokens.scope ? tokens.scope.split(" ") : [],
            tokenSecretId: tokenSecretId ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          { merge: true },
        );

      res.json({ success: true });
      return;
    } catch (error: any) {
      console.error("Gmail authorize error:", error);
      res.status(500).json({ error: error.message });
      return;
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
        const now = new Date();
        const threadRef = db.collection("threads").doc(threadId || `thread_${Date.now()}`);

        await threadRef.set(
          {
            userId: user.uid,
            orgId: orgId ?? null,
            campaignId: campaignId ?? null,
            influencerId: influencerId ?? null,
            contactEmail: req.body.to ?? "",
            gmailThreadId: threadId ?? null,
            status: "open",
            lastMessageAt: now,
            messagesCount: 1,
            createdAt: now,
            updatedAt: now,
          },
          { merge: true },
        );

        const messageRef = threadRef.collection("messages").doc();
        await messageRef.set({
          direction: "outgoing",
          subject,
          bodyHtml: body ?? null,
          bodyText: body ?? null,
          snippet: body ? body.slice(0, 160) : null,
          gmailMessageId: messageRef.id,
          sentAt: now,
          attachments: [],
          createdAt: now,
        });

        res.json({ success: true, messageId: messageRef.id, stubbed: true });
        return;
      }

      // Real Gmail integration would go here
      // Load tokens from Firestore, refresh if needed, send email via Gmail API

      res.json({ success: true });
      return;
    } catch (error: any) {
      console.error("Gmail send error:", error);
      res.status(500).json({ error: error.message });
      return;
    }
  }
);
