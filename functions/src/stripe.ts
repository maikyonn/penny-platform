import { onRequest } from "firebase-functions/v2/https";
import Stripe from "stripe";
import { adminDb } from "./firebase.js";

const db = adminDb;
let stripeClient: Stripe | null = null;

const stripeApiVersion: Stripe.LatestApiVersion = "2025-10-29.clover";

function getStripeClient(): Stripe | null {
  if (stripeClient) {
    return stripeClient;
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    if (process.env.FUNCTIONS_EMULATOR === "true") {
      console.warn("STRIPE_SECRET_KEY not set; stripeWebhook will run in stub mode.");
      return null;
    }

    console.error("STRIPE_SECRET_KEY environment variable is required for stripeWebhook.");
    return null;
  }

  stripeClient = new Stripe(apiKey, {
    apiVersion: stripeApiVersion,
  });

  return stripeClient;
}

export const stripeWebhook = onRequest(
  {
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    invoker: "public",
    region: "us-central1",
    maxInstances: 5,
  },
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    const stripe = getStripeClient();

    if (!stripe) {
      res.status(200).json({ received: true, stubbed: true });
      return;
    }

    if (!sig) {
      res.status(400).send("Missing stripe-signature header");
      return;
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
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = (session.metadata?.firebase_user_id as string | undefined) ?? (session.client_reference_id ?? null);

          if (userId) {
            await db.collection("users").doc(userId).set({
              stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
              plan: {
                type: (session.metadata?.plan_tier as string | undefined) ?? "starter",
                status: "active",
                priceId: session.metadata?.price_id ?? null,
                productId: session.metadata?.product_id ?? null,
                customerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
              },
              updatedAt: new Date(),
            }, { merge: true });
          }
          break;
        }

        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const userId = (subscription.metadata?.firebase_user_id as string | undefined) ?? null;

          if (userId) {
            const customerId = typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer?.id ?? null;
            const price = subscription.items.data[0]?.price;

            await db.collection("users").doc(userId).set({
              stripeCustomerId: customerId,
              plan: {
                type: (subscription.metadata?.plan_tier as string | undefined) ?? "starter",
                status: subscription.status,
                priceId: price?.id ?? null,
                productId: typeof price?.product === "string" ? price.product : price?.product?.id ?? null,
                customerId,
              },
              updatedAt: new Date(),
              planUpdatedAt: new Date(),
              planCurrentPeriodEnd: (() => {
                const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
                return periodEnd ? new Date(periodEnd * 1000) : null;
              })(),
            }, { merge: true });
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
      return;
    } catch (error: any) {
      console.error("Webhook handler error:", error);
      res.status(500).json({ error: error.message });
      return;
    }
  }
);
