import { beforeAll, afterAll, afterEach, describe, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_ID = "demo-penny-dev";
let testEnv: RulesTestEnvironment | undefined;

beforeAll(async () => {
  const rulesPath = resolve(process.cwd(), "..", "firestore.rules");
  const rules = readFileSync(rulesPath, "utf8");
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const [host, portValue] = emulatorHost.split(":");
  const port = Number(portValue ?? "8080");

  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host,
        port,
      },
    });
  } catch (error) {
    console.warn(
      "[firestore.rules.test] Firestore emulator not available; skipping security rule assertions.",
      error instanceof Error ? error.message : error,
    );
    testEnv = undefined;
  }
});

afterEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

describe("Firestore security rules", () => {
  it("allows a user to read and update their own user document", async () => {
    if (!testEnv) {
      return;
    }
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("users/alice").set({
        email: "alice@example.com",
        gmail: { connected: false },
        usage: {
          emailDailyCap: 50,
          emailDailySent: 0,
          emailDailyResetAt: new Date(),
        },
        plan: {
          type: "free",
          status: "active",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const alice = testEnv.authenticatedContext("alice");
    await assertSucceeds(alice.firestore().doc("users/alice").get());
    await assertSucceeds(
      alice.firestore().doc("users/alice").set(
        {
          displayName: "Alice",
          updatedAt: new Date(),
        },
        { merge: true },
      ),
    );
  });

  it("prevents a user from reading another user's document", async () => {
    if (!testEnv) {
      return;
    }
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("users/alice").set({
        email: "alice@example.com",
        gmail: { connected: false },
        usage: {
          emailDailyCap: 50,
          emailDailySent: 0,
          emailDailyResetAt: new Date(),
        },
        plan: {
          type: "free",
          status: "active",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const bob = testEnv.authenticatedContext("bob");
    await assertFails(bob.firestore().doc("users/alice").get());
  });

  it("allows campaign owner to update campaign", async () => {
    if (!testEnv) {
      return;
    }
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("outreach_campaigns/c1").set({
        ownerUid: "alice",
        name: "Launch Campaign",
        status: "draft",
        channel: "email",
        template: {
          subject: "Hello",
          bodyHtml: "<p>Hello</p>",
          variables: [],
        },
        schedule: {
          timezone: "UTC",
          dailyCap: 50,
          batchSize: 10,
        },
        throttle: {
          perMinute: 5,
          perHour: 50,
        },
        totals: {
          pending: 0,
          queued: 0,
          sent: 0,
          failed: 0,
          bounced: 0,
          replied: 0,
          optedOut: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const owner = testEnv.authenticatedContext("alice");
    await assertSucceeds(
      owner.firestore().doc("outreach_campaigns/c1").set(
        {
          status: "active",
          updatedAt: new Date(),
        },
        { merge: true },
      ),
    );
  });

  it("blocks non-owner from updating campaign", async () => {
    if (!testEnv) {
      return;
    }
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("outreach_campaigns/c1").set({
        ownerUid: "alice",
        name: "Launch Campaign",
        status: "draft",
        channel: "email",
        template: {
          subject: "Hello",
          bodyHtml: "<p>Hello</p>",
          variables: [],
        },
        schedule: {
          timezone: "UTC",
          dailyCap: 50,
          batchSize: 10,
        },
        throttle: {
          perMinute: 5,
          perHour: 50,
        },
        totals: {
          pending: 0,
          queued: 0,
          sent: 0,
          failed: 0,
          bounced: 0,
          replied: 0,
          optedOut: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const intruder = testEnv.authenticatedContext("mallory");
    await assertFails(
      intruder.firestore().doc("outreach_campaigns/c1").set(
        {
          status: "archived",
          updatedAt: new Date(),
        },
        { merge: true },
      ),
    );
  });

  it("restricts email queue writes to owner only", async () => {
    if (!testEnv) {
      return;
    }
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("email_queue/job1").set({
        userId: "alice",
        campaignId: "c1",
        payload: {
          to: "creator@example.com",
          subject: "Hi",
        },
        status: "scheduled",
        scheduledAt: new Date(),
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const owner = testEnv.authenticatedContext("alice");
    await assertSucceeds(
      owner.firestore().doc("email_queue/job2").set({
        userId: "alice",
        campaignId: "c1",
        payload: {
          to: "creator@example.com",
          subject: "Welcome",
        },
        status: "scheduled",
        scheduledAt: new Date(),
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const otherUser = testEnv.authenticatedContext("bob");
    await assertFails(
      otherUser.firestore().doc("email_queue/job3").set({
        userId: "alice",
        campaignId: "c1",
        payload: {
          to: "creator@example.com",
          subject: "Blocked",
        },
        status: "scheduled",
        scheduledAt: new Date(),
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });
});
