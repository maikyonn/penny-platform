import { describe, expect, it, vi } from "vitest";

vi.mock("../index.js", () => ({
  verifyUser: vi.fn(async () => ({ uid: "user-1" })),
}));

import { searchStub } from "../search";

describe("searchStub", () => {
  it("returns stubbed results", async () => {
    const resJson = vi.fn();
    const res = {
      json: resJson,
      status: vi.fn().mockReturnThis(),
    };

    await searchStub(
      {
        headers: { authorization: "Bearer fake" },
        body: { query: "coffee", filters: {} },
      } as any,
      res as any,
    );

    expect(resJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        results: expect.arrayContaining([
          expect.objectContaining({ id: "inf1" }),
        ]),
      }),
    );
  });
});
