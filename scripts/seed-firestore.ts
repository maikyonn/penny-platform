#!/usr/bin/env node
/**
 * Seed script for Firebase Emulator Suite
 * Run with: firebase emulators:exec "node scripts/seed-firestore.ts"
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Initialize with emulator credentials
initializeApp({
  projectId: "penny-dev",
});

const db = getFirestore();

async function seed() {
  console.log("🌱 Seeding Firestore emulator...");

  // Create test user
  const testUserId = "test-user-123";
  const testOrgId = "test-org-123";
  const testCampaignId = "test-campaign-123";
  const testInfluencerId = "test-influencer-123";

  // 1. Create profile
  await db.collection("profiles").doc(testUserId).set({
    fullName: "Test User",
    avatarUrl: null,
    locale: "en",
    currentOrgId: testOrgId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 2. Create organization
  await db.collection("organizations").doc(testOrgId).set({
    name: "Test Organization",
    slug: "test-org",
    plan: "starter",
    billingStatus: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    deletedAt: null,
  });

  // 3. Create org member
  await db.collection("organizations").doc(testOrgId).collection("members").doc(testUserId).set({
    role: "owner",
    invitedBy: null,
    lastActiveAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 4. Create campaign
  await db.collection("organizations").doc(testOrgId).collection("campaigns").doc(testCampaignId).set({
    name: "Test Campaign",
    description: "A test campaign for development",
    status: "draft",
    objective: "Brand awareness",
    budgetCents: 100000, // $1000
    currency: "USD",
    landingPageUrl: null,
    startDate: null,
    endDate: null,
    createdBy: testUserId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    archivedAt: null,
  });

  // 5. Create campaign targets
  await db.collection("organizations").doc(testOrgId).collection("campaigns").doc(testCampaignId).collection("targets").doc("targets").set({
    audience: {},
    geos: ["US", "CA"],
    platforms: ["instagram", "tiktok"],
    interests: ["beauty", "lifestyle"],
    createdAt: FieldValue.serverTimestamp(),
  });

  // 6. Create influencer (global catalog)
  await db.collection("influencers").doc(testInfluencerId).set({
    externalId: "ig_test123",
    displayName: "Test Influencer",
    handle: "@testinfluencer",
    email: "test@example.com",
    platform: "instagram",
    followerCount: 50000,
    engagementRate: 0.045,
    location: "Los Angeles, CA",
    languages: ["en"],
    verticals: ["beauty", "lifestyle"],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 7. Create campaign influencer (pivot)
  await db.collection("organizations").doc(testOrgId).collection("campaigns").doc(testCampaignId).collection("influencers").doc("ci-123").set({
    influencerId: testInfluencerId,
    status: "prospect",
    source: "manual",
    outreachChannel: "email",
    matchScore: 0.85,
    lastMessageAt: null,
    denorm: {
      displayName: "Test Influencer",
      handle: "@testinfluencer",
      platform: "instagram",
      followerCount: 50000,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 8. Create subscription
  await db.collection("organizations").doc(testOrgId).collection("subscription").doc("current").set({
    provider: "stripe",
    customerId: "cus_test123",
    subscriptionId: "sub_test123",
    plan: "starter",
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log("✅ Seeding complete!");
  console.log(`   User ID: ${testUserId}`);
  console.log(`   Org ID: ${testOrgId}`);
  console.log(`   Campaign ID: ${testCampaignId}`);
  console.log(`   Influencer ID: ${testInfluencerId}`);
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});

