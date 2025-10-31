import { describe, expect, it, vi } from "vitest";

const metricsForEachMock = vi.fn();
const metricsWhereMock = vi.fn(() => ({
  where: () => ({
    get: vi.fn().mockResolvedValue({ forEach: metricsForEachMock }),
  }),
}));

vi.mock("../firebase.js", () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === "organizations") {
        return {
          doc: vi.fn(() => ({
            collection: vi.fn((collectionName: string) => {
              if (collectionName === "members") {
                return {
                  doc: vi.fn(() => ({
                    get: vi.fn().mockResolvedValue({ exists: true }),
                  })),
                };
              }
              if (collectionName === "campaigns") {
                return {
                  doc: vi.fn(() => ({
                    collection: vi.fn(() => ({
                      where: metricsWhereMock,
                    })),
                  })),
                };
              }
              return {
                doc: vi.fn(() => ({
                  get: vi.fn().mockResolvedValue({ exists: true }),
                })),
              };
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

import { reportsGenerate } from "../reports";

describe("reportsGenerate", () => {
  it("aggregates metrics for campaign window", async () => {
    const resJson = vi.fn();
    const resStatus = vi.fn().mockReturnThis();
    const res = { json: resJson, status: resStatus };

    metricsForEachMock.mockImplementation((callback: any) => {
      callback({ data: () => ({ impressions: 100, clicks: 10, conversions: 2, spendCents: 500 }) });
      callback({ data: () => ({ impressions: 200, clicks: 20, conversions: 5, spendCents: 1500 }) });
    });

    await reportsGenerate(
      {
        headers: { authorization: "Bearer fake" },
        body: { orgId: "org-1", campaignId: "cmp-1", startDate: "2024-01-01", endDate: "2024-01-31" },
      } as any,
      res as any,
    );

    expect(resJson).toHaveBeenCalledWith({
      success: true,
      report: {
        totalImpressions: 300,
        totalClicks: 30,
        totalConversions: 7,
        totalSpendCents: 2000,
      },
    });
  });
});
