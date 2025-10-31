import { onSchedule } from "firebase-functions/v2/scheduler";
import { adminDb } from "../firebase.js";

const db = adminDb;

export const billingMeter = onSchedule("every 1 hours", async (event) => {
  // Aggregate usage logs and update billing meters
  const orgsSnapshot = await db.collection("organizations").get();
  
  for (const orgDoc of orgsSnapshot.docs) {
    const orgId = orgDoc.id;
    
    // Aggregate usage logs from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const logsSnapshot = await db
      .collection("organizations")
      .doc(orgId)
      .collection("usageLogs")
      .where("recordedAt", ">=", oneHourAgo)
      .get();

    // Process logs (implementation depends on your billing logic)
    console.log(`Processed ${logsSnapshot.size} usage logs for org ${orgId}`);
  }
});
