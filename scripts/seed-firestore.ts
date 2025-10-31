#!/usr/bin/env node
/**
 * Seed script for Firebase Emulator Suite
 * Run with: firebase emulators:exec "node scripts/seed-firestore.ts"
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Initialize with emulator credentials
initializeApp({
  projectId: "penny-dev",
});

const db = getFirestore();

async function seed() {
  console.log("🌱 Seeding Firestore emulator with Penny schema...");

  const userId = "demo-user-123";
  const campaignId = "demo-campaign-123";
  const influencerId = "demo-influencer-123";
  const threadId = "demo-thread-123";
  const now = new Date();

  await db.collection("users").doc(userId).set({
    email: "demo@penny.ai",
    displayName: "Demo Brand Owner",
    photoURL: null,
    stripeCustomerId: "cus_demo123",
    plan: {
      type: "starter",
      status: "active",
      priceId: null,
      productId: null,
      customerId: "cus_demo123",
    },
    usage: {
      emailDailyCap: 50,
      emailDailySent: 5,
      emailDailyResetAt: now,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("users").doc(userId).collection("integrations").doc("gmail").set({
    connected: true,
    emailAddress: "demo@penny.ai",
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    tokenSecretId: `projects/penny-dev/secrets/gmail-oauth-${userId}`,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("outreach_campaigns").doc(campaignId).set({
    ownerUid: userId,
    orgId: null,
    name: "Launch Week Demo",
    description: "Seed campaign for emulator data",
    status: "active",
    channel: "email",
    gmail: {
      useUserGmail: true,
      labelId: null,
      sendAs: null,
    },
    template: {
      subject: "Collaborate with Penny",
      bodyHtml: "<p>Hi {{name}},</p><p>We would love to partner with you!</p>",
      bodyText: "Hi there — we would love to partner with you!",
      variables: ["name"],
    },
    schedule: {
      startAt: FieldValue.serverTimestamp(),
      timezone: "UTC",
      dailyCap: 50,
      batchSize: 10,
    },
    throttle: {
      perMinute: 8,
      perHour: 80,
    },
    targetSource: null,
    totals: {
      pending: 10,
      queued: 4,
      sent: 2,
      failed: 0,
      bounced: 0,
      replied: 1,
      optedOut: 0,
    },
    landingPageUrl: "https://penny.ai/demo",
    metrics: {
      history: [
        {
          metric_date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          impressions: 1200,
          clicks: 180,
          conversions: 24,
          spend_cents: 12500,
        },
        {
          metric_date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          impressions: 1420,
          clicks: 210,
          conversions: 31,
          spend_cents: 14100,
        },
      ],
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("influencers").doc(influencerId).set({
    externalId: "ig_demo123",
    displayName: "Casey Creator",
    handle: "@caseycreates",
    email: "creator@example.com",
    platform: "instagram",
    followerCount: 78000,
    engagementRate: 0.064,
    location: "Los Angeles, CA",
    categories: ["lifestyle", "events", "food"],
    languages: ["en"],
    source: "demo_seed",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("outreach_campaigns").doc(campaignId).collection("targets").doc(influencerId).set({
    influencerId,
    email: "creator@example.com",
    name: "Casey Creator",
    status: "prospect",
    messageCount: 1,
    priority: 0,
    scheduledAt: null,
    sentAt: FieldValue.serverTimestamp(),
    lastMessageAt: FieldValue.serverTimestamp(),
    replyAt: null,
    gmailThreadId: "gm-thread-demo",
    lastGmailMessageId: "gm-msg-demo",
    customFields: {},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    campaignId,
    source: "seed_script",
    matchScore: 88,
  });

  await db.collection("threads").doc(threadId).set({
    userId,
    campaignId,
    influencerId,
    contactEmail: "creator@example.com",
    gmailThreadId: "gm-thread-demo",
    gmailLabelId: null,
    status: "open",
    channel: "email",
    lastMessageAt: FieldValue.serverTimestamp(),
    messagesCount: 1,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("threads").doc(threadId).collection("messages").doc("message-1").set({
    direction: "incoming",
    subject: "Excited to collaborate",
    bodyHtml: "<p>Thanks for reaching out! Let's talk details.</p>",
    bodyText: "Thanks for reaching out! Let's talk details.",
    snippet: "Thanks for reaching out! Let's talk details.",
    gmailMessageId: "gm-msg-demo",
    sentAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.collection("email_queue").doc("demo-job-1").set({
    userId,
    campaignId,
    targetId: influencerId,
    payload: {
      to: "creator@example.com",
      subject: "Follow-up for Launch Week",
      bodyHtml: "<p>Following up on our event collaboration.</p>",
      gmailThreadId: "gm-thread-demo",
    },
    status: "scheduled",
    scheduledAt: FieldValue.serverTimestamp(),
    lockedAt: null,
    lockedBy: null,
    attempts: 0,
    lastError: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log("✅ Seeding complete!");
  console.log(`   User ID: ${userId}`);
  console.log(`   Campaign ID: ${campaignId}`);
  console.log(`   Influencer ID: ${influencerId}`);
  console.log(`   Thread ID: ${threadId}`);
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
