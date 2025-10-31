import { describe, expect, it, vi } from "vitest";

const messageSetMock = vi.fn();

const messagesCollection = {
  doc: vi.fn(() => ({
    set: messageSetMock,
  })),
};

const threadsDoc = {
  collection: vi.fn((name: string) => {
    if (name === "messages") {
      return messagesCollection;
    }
    throw new Error(`Unexpected collection ${name}`);
  }),
};

const influencersDoc = {
  collection: vi.fn((name: string) => {
    if (name === "threads") {
      return {
        doc: vi.fn(() => threadsDoc),
      };
    }
    throw new Error(`Unexpected collection ${name}`);
  }),
};

const campaignsDoc = {
  collection: vi.fn((name: string) => {
    if (name === "influencers") {
      return {
        doc: vi.fn(() => influencersDoc),
      };
    }
    throw new Error(`Unexpected collection ${name}`);
  }),
};

const organizationsCollection = {
  doc: vi.fn(() => ({
    collection: vi.fn((name: string) => {
      if (name === "campaigns") {
        return {
          doc: vi.fn(() => campaignsDoc),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  })),
};

vi.mock("../firebase.js", () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === "organizations") {
        return organizationsCollection;
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  },
}));

import { outreachSend } from "../pubsub/outreach-send";

describe("outreachSend handler", () => {
  it("persists outreach message", async () => {
    const payload = {
      orgId: "org-1",
      campaignId: "campaign-1",
      influencerId: "influencer-1",
      threadId: "thread-1",
      subject: "Hello",
      body: "Welcome aboard",
      authorId: "user-1",
    };

    await outreachSend({
      data: {
        message: {
          data: Buffer.from(JSON.stringify(payload)),
        },
      },
    } as any);

    expect(messageSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Welcome aboard",
        direction: "brand",
        authorId: "user-1",
      }),
    );
  });
});
