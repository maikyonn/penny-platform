import { fail, redirect } from "@sveltejs/kit";
import { loadUserContext } from "$lib/server/user-context";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const { firebaseUser } = await loadUserContext(locals);
  if (!firebaseUser) {
    throw redirect(303, "/sign-in");
  }

  return { firebaseUser };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const { firebaseUser } = await loadUserContext(locals);
    if (!firebaseUser) {
      throw redirect(303, "/sign-in");
    }

    const formData = await request.formData();
    const name = String(formData.get("name") ?? "").trim();
    const objective = String(formData.get("objective") ?? "").trim() || null;
    const landingPageUrl = String(formData.get("landing_page_url") ?? "").trim() || null;

    if (!name) {
      return fail(400, {
        error: "Campaign name is required.",
        values: { name, objective, landing_page_url: landingPageUrl },
      });
    }

    const now = new Date();
    const campaignRef = locals.firestore.collection("outreach_campaigns").doc();

    await campaignRef.set({
      ownerUid: firebaseUser.uid,
      orgId: null,
      name,
      description: objective,
      status: "draft",
      channel: "email",
      gmail: {
        useUserGmail: true,
      },
      template: {
        subject: "",
        bodyHtml: "",
        bodyText: null,
        variables: [],
      },
      schedule: {
        startAt: null,
        timezone: "UTC",
        dailyCap: 50,
        batchSize: 10,
      },
      throttle: {
        perMinute: 10,
        perHour: 100,
      },
      targetSource: null,
      totals: {
        pending: 0,
        queued: 0,
        sent: 0,
        failed: 0,
        bounced: 0,
        replied: 0,
        optedOut: 0,
      },
      landingPageUrl,
      createdAt: now,
      updatedAt: now,
    });

    throw redirect(303, `/campaign/${campaignRef.id}`);
  },
};
