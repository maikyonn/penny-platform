import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyUser } from "./index";

const db = getFirestore();

export const reportsGenerate = onRequest(async (req, res) => {
  try {
    const user = await verifyUser(req.headers.authorization);
    const { orgId, campaignId, startDate, endDate } = req.body;

    // Verify user is member of org
    const memberDoc = await db.collection("organizations").doc(orgId).collection("members").doc(user.uid).get();
    if (!memberDoc.exists) {
      return res.status(403).json({ error: "Not a member of this organization" });
    }

    // Aggregate metrics
    const metricsSnapshot = await db
      .collection("organizations")
      .doc(orgId)
      .collection("campaigns")
      .doc(campaignId)
      .collection("metrics")
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get();

    const aggregated = {
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalSpendCents: 0,
    };

    metricsSnapshot.forEach((doc) => {
      const data = doc.data();
      aggregated.totalImpressions += data.impressions || 0;
      aggregated.totalClicks += data.clicks || 0;
      aggregated.totalConversions += data.conversions || 0;
      aggregated.totalSpendCents += data.spendCents || 0;
    });

    res.json({ success: true, report: aggregated });
  } catch (error: any) {
    console.error("Reports generate error:", error);
    res.status(500).json({ error: error.message });
  }
});

