import { describe, expect, it } from "vitest";

import { refreshInfluencers } from "../cron/refresh-influencers";

describe("refreshInfluencers scheduler", () => {
  it("runs without error", async () => {
    await expect(refreshInfluencers.run({} as any)).resolves.toBeUndefined();
  });
});
