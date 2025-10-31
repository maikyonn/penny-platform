import { beforeEach, describe, expect, it, vi } from "vitest";

const threadSetMock = vi.fn();
const messageSetMock = vi.fn();
const userIntegrationSetMock = vi.fn();

vi.mock("../firebase.js", () => {
  return {
    adminDb: {
      collection: (name: string) => {
        if (name === "threads") {
          return {
            doc: vi.fn(() => ({
              set: threadSetMock,
              collection: () => ({
                doc: vi.fn(() => ({
                  id: "msg_123",
                  set: messageSetMock,
                })),
              }),
            })),
          };
        }
        if (name === "users") {
          return {
            doc: vi.fn(() => ({
              collection: () => ({
                doc: () => ({
                  set: userIntegrationSetMock,
                }),
              }),
            })),
          };
        }
        if (name === "campaign_chatbot_history") {
          return { doc: () => ({ set: vi.fn() }) };
        }
        return {
          doc: () => ({
            set: vi.fn(),
            collection: () => ({
              doc: () => ({
                set: vi.fn(),
              }),
            }),
          }),
        };
      },
    },
    adminAuth: {
      verifyIdToken: vi.fn(),
    },
  };
});

vi.mock("../index.js", () => ({
  verifyUser: vi.fn(async () => ({
    uid: "user-1",
    email: "user@example.com",
  })),
}));

vi.mock("@google-cloud/secret-manager", () => ({
  SecretManagerServiceClient: vi.fn(() => ({
    getSecret: vi.fn().mockRejectedValue({ code: 5 }),
    createSecret: vi.fn().mockResolvedValue({}),
    addSecretVersion: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn(() => ({
        getToken: vi.fn().mockResolvedValue({
          tokens: {
            access_token: "access",
            refresh_token: "refresh",
            scope: "gmail.send",
            token_type: "Bearer",
            expiry_date: Date.now() + 3600_000,
          },
        }),
      })),
    },
  },
}));

import { gmailAuthorize, gmailSend } from "../gmail";

describe("gmail functions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.FUNCTIONS_EMULATOR = "true";
  });

  it("stores message in Firestore when stubbed", async () => {
    process.env.GMAIL_STUB = "1";

    const req: any = {
      headers: { authorization: "Bearer fake" },
      body: {
        to: "creator@example.com",
        subject: "Hello",
        body: "Welcome!",
        campaignId: "campaign-1",
      },
    };

    const jsonMock = vi.fn();
    const res: any = {
      json: jsonMock,
      status: vi.fn().mockReturnThis(),
    };

    await gmailSend(req, res);

    expect(threadSetMock).toHaveBeenCalled();
    expect(messageSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyText: "Welcome!",
        direction: "outgoing",
      }),
    );
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, stubbed: true }),
    );
  });

  it("writes Gmail integration metadata on authorize", async () => {
    const req: any = {
      headers: { authorization: "Bearer fake" },
      body: {
        code: "auth-code",
        redirectUri: "http://localhost/callback",
      },
    };

    const jsonMock = vi.fn();
    const res: any = {
      json: jsonMock,
      status: vi.fn().mockReturnThis(),
    };

    await gmailAuthorize(req, res);

    expect(userIntegrationSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connected: true,
      }),
      { merge: true },
    );
    expect(jsonMock).toHaveBeenCalledWith({ success: true });
  });
});
