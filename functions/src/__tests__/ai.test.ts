import { describe, expect, it, vi } from "vitest";

vi.mock("../index.js", () => ({
  verifyUser: vi.fn(async () => ({ uid: "user-1" })),
}));

const addMock = vi.fn();

const messagesCollection = {
  add: addMock,
};

const sessionDoc = {
  collection: vi.fn((name: string) => {
    if (name === "messages") {
      return messagesCollection;
    }
    throw new Error(`Unexpected collection ${name}`);
  }),
};

const chatSessionsCollection = {
  doc: vi.fn(() => sessionDoc),
};

const orgDoc = {
  collection: vi.fn((name: string) => {
    if (name === "chatSessions") {
      return chatSessionsCollection;
    }
    throw new Error(`Unexpected collection ${name}`);
  }),
};

vi.mock("../firebase.js", () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === "organizations") {
        return {
          doc: vi.fn(() => orgDoc),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  },
}));

import { aiDraftOutreach, chatbotStub, supportAiRouter } from "../ai";

describe("AI HTTP functions", () => {
  it("returns outreach draft", async () => {
    const resJson = vi.fn();
    await aiDraftOutreach(
      {
        headers: { authorization: "Bearer fake" },
        body: {
          context: {
            influencerName: "Jordan",
            brandName: "Penny",
          },
        },
      } as any,
      { json: resJson, status: vi.fn().mockReturnThis() } as any,
    );

    expect(resJson).toHaveBeenCalled();
    const payload = resJson.mock.calls[0][0];
    expect(payload.draft).toContain("Jordan");
  });

  it("stores chatbot messages and returns stub response", async () => {
    const resJson = vi.fn();

    await chatbotStub(
      {
        headers: { authorization: "Bearer fake" },
        body: {
          orgId: "org-1",
          sessionId: "session-1",
          message: "Hello assistant",
        },
      } as any,
      { json: resJson, status: vi.fn().mockReturnThis() } as any,
    );

    expect(addMock).toHaveBeenCalled();
    expect(resJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        response: expect.stringContaining("chatbot stub"),
      }),
    );
  });

  it("routes support requests", async () => {
    const resJson = vi.fn();

    await supportAiRouter(
      {
        headers: { authorization: "Bearer fake" },
        body: { orgId: "org-1", query: "Need help with billing" },
      } as any,
      { json: resJson, status: vi.fn().mockReturnThis() } as any,
    );

    expect(resJson).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: "billing",
        routed: true,
      }),
    );
  });
});
