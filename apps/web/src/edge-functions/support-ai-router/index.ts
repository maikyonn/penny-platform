import { corsHeaders, buildSupabaseClient, maybeHandleCors } from '../_shared/supabaseClient.ts';
import type { TablesInsert } from '../../lib/database.types.ts';

type SupportPayload = {
  campaign_id?: string | null;
  session_id?: string;
  message: string;
};

function selectResponse(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('budget') || normalized.includes('cost')) {
    return 'I recommend framing the budget in tiers (seed, core, stretch) so each influencer knows the guardrails. Want me to draft those ranges next?';
  }

  if (normalized.includes('timeline') || normalized.includes('deadline')) {
    return "Let's anchor the launch around a clear kickoff window and a final reporting date. I can sketch the milestones once you confirm the target go-live week.";
  }

  if (normalized.includes('influencer') || normalized.includes('creator')) {
    return "Great! I'll line up a shortlist of creators that match your brief and flag any that already engaged with your brand.";
  }

  if (normalized.includes('goal') || normalized.includes('objective')) {
    return "Got it. I'll translate that goal into 2-3 measurable success metrics so the team can track progress day-to-day.";
  }

  if (normalized.includes('hello') || normalized.includes('hi')) {
    return "Hi there! Drop in your campaign context—audience, offer, or anything else—and I'll stitch together the recommended next step.";
  }

  const snippet = message.slice(0, 80).trim();
  return snippet
    ? `Thanks! I'll build on "${snippet}" and push the next recommended action to your workspace.`
    : "Appreciate it. I'll map out the next action item and check in once it's ready.";
}

denoServe();

function denoServe() {
  Deno.serve(async (req) => {
    const cors = maybeHandleCors(req);
    if (cors) return cors;

    try {
      if (req.method !== 'POST') {
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
        );
      }

      const { client } = buildSupabaseClient(req);
      const payload = (await req.json()) as SupportPayload;

      if (!payload?.message) {
        return new Response(
          JSON.stringify({ error: 'message is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      if (payload.campaign_id) {
        const { data: campaign, error: campaignError } = await client
          .from('campaigns')
          .select('id, created_by')
          .eq('id', payload.campaign_id)
          .maybeSingle();

        if (campaignError) {
          throw campaignError;
        }

        if (!campaign || campaign.created_by !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Forbidden' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          );
        }
      }

      let sessionId = payload.session_id ?? null;

      if (!sessionId) {
        const sessionInsert: TablesInsert<'chat_sessions'> = {
          campaign_id: payload.campaign_id ?? null,
          topic: 'support',
          created_by: user.id,
          owner_id: user.id,
        };

        const { data: session, error: sessionError } = await client
          .from('chat_sessions')
          .insert(sessionInsert)
          .select('id')
          .single();

        if (sessionError) {
          throw sessionError;
        }
        sessionId = session.id;
      }

      const userMessage: TablesInsert<'chat_messages'> = {
        session_id: sessionId,
        role: 'user',
        content: payload.message,
      };

      const { error: insertMessageError } = await client
        .from('chat_messages')
        .insert(userMessage);

      if (insertMessageError) {
        throw insertMessageError;
      }

      // Placeholder assistant response
      const assistantResponse = selectResponse(payload.message);

      await client.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: assistantResponse,
      });

      return new Response(
        JSON.stringify({
          session_id: sessionId,
          reply: assistantResponse,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (error) {
      console.error('support-ai-router error', error);
      return new Response(
        JSON.stringify({ error: error?.message ?? 'Unknown error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  });
}
