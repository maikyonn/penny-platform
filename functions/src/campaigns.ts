import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { verifyUser } from "./index";

const db = getFirestore();

export const campaignsCreate = onRequest(async (req, res) => {
  try {
    const user = await verifyUser(req.headers.authorization);
    const { orgId, name, description, status, objective, budgetCents, currency, landingPageUrl, startDate, endDate } = req.body;

    // Verify user is member of org
    const memberDoc = await db.collection("organizations").doc(orgId).collection("members").doc(user.uid).get();
    if (!memberDoc.exists) {
      return res.status(403).json({ error: "Not a member of this organization" });
    }

    const campaignRef = db.collection("organizations").doc(orgId).collection("campaigns").doc();
    
    await campaignRef.set({
      name,
      description: description || null,
      status: status || "draft",
      objective: objective || null,
      budgetCents: budgetCents || null,
      currency: currency || "USD",
      landingPageUrl: landingPageUrl || null,
      startDate: startDate || null,
      endDate: endDate || null,
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      archivedAt: null,
    });

    res.json({ success: true, campaignId: campaignRef.id });
  } catch (error: any) {
    console.error("Campaign create error:", error);
    res.status(500).json({ error: error.message });
  }
});

export const campaignsMatch = onRequest(async (req, res) => {
  try {
    const user = await verifyUser(req.headers.authorization);
    const { orgId, campaignId, query, filters } = req.body;

    // Verify user is member of org
    const memberDoc = await db.collection("organizations").doc(orgId).collection("members").doc(user.uid).get();
    if (!memberDoc.exists) {
      return res.status(403).json({ error: "Not a member of this organization" });
    }

    // This would call the search service
    // For now, return stubbed results
    const searchServiceUrl = process.env.SEARCH_SERVICE_URL || "http://localhost:9100";
    const response = await fetch(`${searchServiceUrl}/api/v1/search`, {
      method: "POST",
      headers: {
        "Authorization": req.headers.authorization || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, filters }),
    });

    const results = await response.json();

    res.json({ success: true, results });
  } catch (error: any) {
    console.error("Campaign match error:", error);
    res.status(500).json({ error: error.message });
  }
});

