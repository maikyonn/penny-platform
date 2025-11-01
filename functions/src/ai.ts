import { onRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import OpenAI from "openai";
import { defineSecret } from "firebase-functions/params";
import { verifyUser } from "./index.js";
import { adminDb } from "./firebase.js";
import { CampaignIntake } from "./schemas/campaignIntake.js";

const db = adminDb;
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const CHATBOT_SYSTEM_PROMPT = `
You are a campaign intake assistant for influencer marketing.
- Maintain and update an internal CampaignIntake JSON object.
- Ask for missing fields only, two at most per turn, and confirm the current intake.
- Normalize ranges and quantities to single numeric values whenever possible.
- Once the intake is complete and explicitly confirmed, call "create_campaign" once, wait for the output, then call "search_influencers".
- Use tool outputs as the source of truth for IDs, links, and statuses. Never invent values.
- Respond with concise, actionable summaries after completing actions.`;

const chatbotTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_campaign",
      description: "Persist a campaign in Firestore and return its ID.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          objective: { type: "string" },
          landingPageUrl: { type: ["string", "null"] },
          platforms: { type: "array", items: { type: "string" } },
          budgetCents: { type: ["integer", "null"] },
          currency: { type: "string" },
          startDate: { type: ["string", "null"], description: "ISO 8601 datetime" },
          endDate: { type: ["string", "null"], description: "ISO 8601 datetime" },
          niches: { type: "array", items: { type: "string" } },
          followerMin: { type: ["integer", "null"] },
          followerMax: { type: ["integer", "null"] },
          minEngagement: { type: ["number", "null"] },
          locations: { type: "array", items: { type: "string" } }
        },
        required: ["name", "objective", "platforms", "niches"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_influencers",
      description: "Trigger influencer discovery for a campaign.",
      parameters: {
        type: "object",
        properties: {
          campaignId: { type: "string" },
          query: { type: "string", description: "Optional search seed or keywords." },
          filters: {
            type: "object",
            properties: {
              platforms: { type: "array", items: { type: "string" } },
              niches: { type: "array", items: { type: "string" } },
              followerMin: { type: ["integer", "null"] },
              followerMax: { type: ["integer", "null"] },
              minEngagement: { type: ["number", "null"] },
              locations: { type: "array", items: { type: "string" } }
            }
          }
        },
        required: ["campaignId"]
      }
    }
  }
];

type ToolLoopContext = {
  orgId: string | null;
  sessionId: string;
  authHeader: string;
};

async function inferSearchUrl() {
  if (process.env.SEARCH_FUNCTION_URL) {
    return process.env.SEARCH_FUNCTION_URL;
  }
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT ??
    process.env.PROJECT_ID;
  if (!projectId) {
    throw new Error("SEARCH_FUNCTION_URL is not set and project ID is unavailable.");
  }
  return `https://us-central1-${projectId}.cloudfunctions.net/search`;
}

async function runToolLoop(
  initialMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ctx: ToolLoopContext,
  client: OpenAI
) {
  const transcript: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    ...initialMessages
  ];
  let campaignId: string | null = null;
  let lastSearchPayload: unknown = null;

  const searchUrlPromise = inferSearchUrl();

  for (let turn = 0; turn < 6; turn++) {
    const completion = await client.chat.completions.create({
      model: "gpt-5-nano",
      temperature: 0.2,
      messages: transcript,
      tools: chatbotTools,
      tool_choice: "auto"
    });

    const assistantMessage = completion.choices[0]?.message;
    if (!assistantMessage) {
      throw new Error("Assistant response missing.");
    }

    const toolCalls = assistantMessage.tool_calls ?? [];
    if (!toolCalls.length) {
      return { assistantMessage, campaignId, searchPayload: lastSearchPayload };
    }

    transcript.push(assistantMessage);

    for (const call of toolCalls) {
      const { name, arguments: argString } = call.function;
      let parsedArgs: Record<string, unknown> = {};

      if (argString) {
        try {
          parsedArgs = JSON.parse(argString);
        } catch (parseErr) {
          throw new Error(`Invalid arguments for tool ${name}: ${parseErr}`);
        }
      }

      if (name === "create_campaign") {
        const validated = CampaignIntake.pick({
          name: true,
          objective: true,
          landingPageUrl: true,
          platforms: true,
          budgetCents: true,
          currency: true,
          startDate: true,
          endDate: true,
          niches: true,
          followerMin: true,
          followerMax: true,
          minEngagement: true,
          locations: true
        }).parse(parsedArgs);

        const ref = await db.collection("outreach_campaigns").add({
          ...validated,
          orgId: ctx.orgId ?? null,
          sessionId: ctx.sessionId,
          status: "draft",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        campaignId = ref.id;

        transcript.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ok: true, campaignId: ref.id })
        });

        continue;
      }

      if (name === "search_influencers") {
        if (!campaignId && typeof parsedArgs.campaignId === "string") {
          campaignId = parsedArgs.campaignId;
        }

        const searchUrl = await searchUrlPromise;
        const response = await fetch(searchUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: ctx.authHeader
          },
          body: JSON.stringify({
            orgId: ctx.orgId,
            campaignId,
            query: parsedArgs.query ?? "",
            filters: parsedArgs.filters ?? {}
          })
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`search_influencers failed: ${response.status} ${text}`);
        }

        const payload = await response.json();
        lastSearchPayload = payload;

        transcript.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(payload)
        });

        continue;
      }

      transcript.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({
          ok: false,
          error: `Tool "${name}" is not implemented.`
        })
      });
    }
  }

  throw new Error("Tool loop exceeded safety limit.");
}

export const aiDraftOutreach = onRequest(async (req, res) => {
  try {
    const user = await verifyUser(req.headers.authorization);
    const { orgId, campaignId, influencerId, context } = req.body;

    // Stub AI response for now
    const draft = `Hi ${context.influencerName || "there"},

I hope this message finds you well! I'm reaching out on behalf of ${
      context.brandName || "our brand"
    } regarding a potential collaboration opportunity.

${context.campaignDetails || "We think you'd be a great fit for our upcoming campaign."}

Would you be interested in learning more?

Best regards,
${context.senderName || "The Team"}`;

    res.json({ success: true, draft });
  } catch (error: any) {
    console.error("AI draft error:", error);
    res.status(500).json({ error: error.message });
  }
});

export const chatbotIntake = onRequest({ secrets: [OPENAI_API_KEY] }, async (req, res) => {
  try {
    const user = await verifyUser(req.headers.authorization);
    const { orgId, sessionId, message } = req.body ?? {};

    const trimmedMessage = typeof message === "string" ? message.trim() : "";
    if (!trimmedMessage) {
      res.status(400).json({ error: "Message is required." });
      return;
    }

    const orgKey = orgId ?? "_public";
    const sessionKey =
      typeof sessionId === "string" && sessionId.length > 0
        ? sessionId
        : `${user.uid}-default`;
    const authHeader = req.headers.authorization ?? "";

    const sessionMessagesRef = db
      .collection("organizations")
      .doc(orgKey)
      .collection("chatSessions")
      .doc(sessionKey)
      .collection("messages");

    const historySnapshot = await sessionMessagesRef
      .orderBy("createdAt", "asc")
      .limit(50)
      .get();

    const historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      historySnapshot.docs
        .map((doc) => doc.data() as { role?: string; content?: string })
        .filter(
          (doc) => doc.role === "assistant" || doc.role === "user"
        )
        .map((doc) => ({
          role: doc.role as "assistant" | "user",
          content: doc.content ?? ""
        }));

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: CHATBOT_SYSTEM_PROMPT },
      ...historyMessages,
      { role: "user", content: trimmedMessage }
    ];

    const apiKey = OPENAI_API_KEY.value() || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("OPENAI_API_KEY is not configured; skipping chatbot response.");
      res.status(503).json({ error: "AI service not configured." });
      return;
    }
    const openai = new OpenAI({ apiKey });

    const { assistantMessage, campaignId, searchPayload } = await runToolLoop(
      messages,
      {
        orgId,
        sessionId: sessionKey,
        authHeader
      },
      openai
    );

    await sessionMessagesRef.add({
      role: "user",
      content: trimmedMessage,
      metadata: {},
      createdAt: FieldValue.serverTimestamp()
    });

    await sessionMessagesRef.add({
      role: "assistant",
      content: assistantMessage.content ?? "",
      metadata: {},
      createdAt: FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      response: assistantMessage.content ?? "",
      campaignId: campaignId ?? null,
      search: searchPayload ?? null
    });
    return;
  } catch (error: any) {
    console.error("chatbotIntake error:", error);
    res.status(500).json({ error: error.message });
    return;
  }
});

export const supportAiRouter = onRequest(async (req, res) => {
  try {
    await verifyUser(req.headers.authorization);
    const { query } = req.body;

    const intent = query.toLowerCase().includes("billing") ? "billing" : "general";

    res.json({ success: true, intent, routed: true });
  } catch (error: any) {
    console.error("Support router error:", error);
    res.status(500).json({ error: error.message });
  }
});
