import type { Firestore } from "firebase-admin/firestore";

export type SubscriptionInfo = {
  type: string;
  status: string;
  productId?: string | null;
  priceId?: string | null;
  customerId?: string | null;
  currentPeriodEnd?: string | null;
};

export async function getUserSubscription(
  firestore: Firestore,
  userId: string,
): Promise<SubscriptionInfo | null> {
  try {
    const doc = await firestore.collection("users").doc(userId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data() ?? {};
    const plan = data.plan as SubscriptionInfo | undefined;
    if (!plan) {
      return null;
    }
    return {
      ...plan,
      customerId: plan.customerId ?? data.stripeCustomerId ?? null,
      currentPeriodEnd: data.planCurrentPeriodEnd instanceof Date
        ? data.planCurrentPeriodEnd.toISOString()
        : (data.planCurrentPeriodEnd as string | null | undefined) ?? null,
    };
  } catch (error) {
    console.error("[billing] subscription fetch failed", error);
    return null;
  }
}
