#!/usr/bin/env node
/**
 * Verification script to check Firebase Emulator setup
 * Run with: node scripts/verify-firebase-setup.ts
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

console.log("🔍 Verifying Firebase Emulator setup...\n");

// Check environment variables
const checks = [
  { name: "FIRESTORE_EMULATOR_HOST", value: process.env.FIRESTORE_EMULATOR_HOST },
  { name: "FIREBASE_AUTH_EMULATOR_HOST", value: process.env.FIREBASE_AUTH_EMULATOR_HOST },
  { name: "STORAGE_EMULATOR_HOST", value: process.env.STORAGE_EMULATOR_HOST },
  { name: "GOOGLE_CLOUD_PROJECT", value: process.env.GOOGLE_CLOUD_PROJECT },
];

console.log("Environment Variables:");
checks.forEach(({ name, value }) => {
  const status = value ? "✅" : "❌";
  console.log(`  ${status} ${name}: ${value || "NOT SET"}`);
});

// Initialize Firebase Admin
try {
  initializeApp({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || "penny-dev",
  });

  const db = getFirestore();
  const auth = getAuth();

  console.log("\n✅ Firebase Admin initialized successfully");
  console.log(`   Project ID: ${process.env.GOOGLE_CLOUD_PROJECT || "penny-dev"}`);

  // Try to connect to Firestore
  try {
    const testRef = db.collection("_test").doc("connection");
    await testRef.set({ test: true, timestamp: new Date() });
    await testRef.delete();
    console.log("✅ Firestore connection verified");
  } catch (error: any) {
    console.log(`❌ Firestore connection failed: ${error.message}`);
    console.log("   Make sure emulators are running: npm run dev:emulators");
  }

  // Try to list users (should work with emulator)
  try {
    const users = await auth.listUsers();
    console.log(`✅ Auth connection verified (${users.users.length} users in emulator)`);
  } catch (error: any) {
    console.log(`❌ Auth connection failed: ${error.message}`);
  }

} catch (error: any) {
  console.error(`\n❌ Firebase initialization failed: ${error.message}`);
  process.exit(1);
}

console.log("\n✅ Setup verification complete!");
console.log("\nNext steps:");
console.log("  1. Start emulators: npm run dev:emulators");
console.log("  2. Seed test data: npm run seed");
console.log("  3. Access Emulator UI: http://localhost:9000");

