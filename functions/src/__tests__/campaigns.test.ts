import { describe, expect, it, vi } from "vitest";

const memberGetMock = vi.fn();
const campaignSetMock = vi.fn();

vi.mock("../firebase.js", () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === "organizations") {
        return {
          doc: vi.fn(() => ({
            collection: vi.fn((colName: string) => {
              if (colName === "members") {
                return {
                  doc: () => ({
                    get: memberGetMock,
                  }),
                };
              }
              if (colName === "campaigns") {
                return {
                  doc: () => ({
                    set: campaignSetMock,
                    id: "cmp_123",
                  }),
                };
              }
              return { doc: () => ({ get: vi.fn() }) };
            }),
          })),
        };
      }
      return {
        doc: () => ({
          collection: () => ({
            doc: () => ({
              get: vi.fn(),
            }),
          }),
        }),
      };
    }),
  },
}));

vi.mock("../index.js", () => ({
  verifyUser: vi.fn(async () => ({ uid: "user-1" })),
}));

vi.stubGlobal("fetch", vi.fn());

import { campaignsCreate, campaignsMatch } from "../campaigns";

describe("campaign functions", () => {
  it("creates campaign when user is member", async () => {
    memberGetMock.mockResolvedValue({ exists: true });

    const resJson = vi.fn();
    await campaignsCreate(
      {
        headers: { authorization: "Bearer fake" },
        body: { orgId: "org-1", name: "Launch" },
      } as any,
      { json: resJson, status: vi.fn().mockReturnThis() } as any,
    );

    expect(campaignSetMock).toHaveBeenCalled();
    expect(resJson).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("rejects campaign match when member missing", async () => {
    memberGetMock.mockResolvedValueOnce({ exists: false });

    const resStatus = vi.fn().mockReturnThis();
    const resJson = vi.fn();

    await campaignsMatch(
      {
        headers: { authorization: "Bearer fake" },
        body: { orgId: "org-1", campaignId: "cmp", query: "coffee" },
      } as any,
      { status: resStatus, json: resJson } as any,
    );

    expect(resStatus).toHaveBeenCalledWith(403);
  });

  it("calls external search service", async () => {
    memberGetMock.mockResolvedValue({ exists: true });
    const fetchMock = fetch as unknown as vi.Mock;
    fetchMock.mockResolvedValue({
      json: async () => ({ results: [{ id: "inf1" }] }),
    });

    const resJson = vi.fn();

    await campaignsMatch(
      {
        headers: { authorization: "Bearer fake" },
        body: { orgId: "org-1", campaignId: "cmp", query: "coffee" },
      } as any,
      { status: vi.fn().mockReturnThis(), json: resJson } as any,
    );

    expect(fetchMock).toHaveBeenCalled();
    expect(resJson).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });
});
