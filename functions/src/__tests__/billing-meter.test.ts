import { describe, expect, it, vi } from "vitest";

const usageQueryMock = vi.fn();
const getOrgsMock = vi.fn();

vi.mock("../firebase.js", () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === "organizations") {
        return {
          get: getOrgsMock,
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              where: vi.fn(() => ({
                get: usageQueryMock,
              })),
            })),
          })),
        };
      }
      return {
        doc: () => ({
          collection: () => ({
            where: () => ({
              get: usageQueryMock,
            }),
          }),
        }),
      };
    }),
  },
}));

import { billingMeter } from "../cron/billing-meter";

describe("billingMeter scheduler", () => {
  it("iterates organizations and evaluates usage logs", async () => {
    getOrgsMock.mockResolvedValue({
      docs: [{ id: "org-1" }, { id: "org-2" }],
    });
    usageQueryMock.mockResolvedValue({ size: 0 });

    await billingMeter.run({} as any);

    expect(getOrgsMock).toHaveBeenCalled();
    expect(usageQueryMock).toHaveBeenCalledTimes(2);
  });
});
