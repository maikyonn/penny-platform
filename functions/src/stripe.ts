import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";

const db = getFirestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia",
});

export const stripeWebhook = onRequest(
  {
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    invoker: "public",
    region: "us-central1",
    maxInstances: 5,
  },
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      return res.status(400).send("Missing stripe-signature header");
    }

    let event: Stripe.Event;

    try {
      // For Firebase Functions v2, use req.body as Buffer or string
      const body = typeof req.body === "string" ? Buffer.from(req.body) : req.body;
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const orgId = session.metadata?.orgId;
          
          if (orgId) {
            await db.collection("organizations").doc(orgId).collection("subscription").doc("current").set({
              provider: "stripe",
              customerId: session.customer as string,
              subscriptionId: session.subscription as string,
              plan: session.metadata?.plan || "starter",
              status: "active",
              currentPeriodEnd: new Date(session.expires_at! * 1000),
              createdAt: new Date(),
            }, { merge: true });
          }
          break;
        }

        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const orgId = subscription.metadata?.orgId;
          
          if (orgId) {
            await db.collection("organizations").doc(orgId).collection("subscription").doc("current").set({
              status: subscription.status,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              updatedAt: new Date(),
            }, { merge: true });
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook handler error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

