import { onRequest } from "firebase-functions/v2/https";
import { verifyUser } from "./index";

export const searchStub = onRequest(async (req, res) => {
  try {
    const user = await verifyUser(req.headers.authorization);
    const { query, filters } = req.body;

    // Stub search results
    const results = [
      {
        id: "inf1",
        displayName: "Sample Influencer",
        handle: "@sample",
        platform: "instagram",
        followerCount: 50000,
        engagementRate: 0.045,
      },
    ];

    res.json({ success: true, results });
  } catch (error: any) {
    console.error("Search stub error:", error);
    res.status(500).json({ error: error.message });
  }
});

