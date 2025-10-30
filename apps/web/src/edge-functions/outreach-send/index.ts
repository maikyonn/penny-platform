import { corsHeaders, buildSupabaseClient, maybeHandleCors } from '../_shared/supabaseClient.ts';
import { ensureActiveSubscription, assertPlanAllowsFeature, UsageLimitError } from '../_shared/usageLimits.ts';

type OutreachPayload = {
  campaign_influencer_id: string;
  message: string;
  channel?: 'email' | 'dm' | 'sms' | 'whatsapp' | 'other';
  attachments?: string[];
};

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

      const { client, adminClient } = buildSupabaseClient(req);
      const payload = (await req.json()) as OutreachPayload;

      if (!payload?.campaign_influencer_id || !payload?.message) {
        return new Response(
          JSON.stringify({ error: 'campaign_influencer_id and message are required' }),
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

      const { planLimits } = await ensureActiveSubscription(adminClient as any, user.id);
      assertPlanAllowsFeature(planLimits, 'messaging');

      const { data: campaignInfluencer, error: ciError } = await client
        .from('campaign_influencers')
        .select('id, campaign_id, outreach_channel, campaigns!inner(created_by)')
        .eq('id', payload.campaign_influencer_id)
        .single();

      if (ciError || !campaignInfluencer) {
        return new Response(
          JSON.stringify({ error: 'Campaign influencer not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      if (campaignInfluencer.campaigns?.created_by !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      const channel =
        payload.channel ?? (campaignInfluencer.outreach_channel as OutreachPayload['channel']) ?? 'email';

      // Ensure a thread exists
      const { data: thread } = await client
        .from('outreach_threads')
        .select('*')
        .eq('campaign_influencer_id', campaignInfluencer.id)
        .eq('channel', channel)
        .maybeSingle();

      let threadId = thread?.id;

      if (!threadId) {
        const { data: insertedThread, error: newThreadError } = await client
          .from('outreach_threads')
          .insert({
            campaign_influencer_id: campaignInfluencer.id,
            channel,
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (newThreadError) {
          throw newThreadError;
        }
        threadId = insertedThread.id;
      }

      const nowIso = new Date().toISOString();

      const { data: message, error: messageError } = await client
        .from('outreach_messages')
        .insert({
          thread_id: threadId,
          direction: 'brand',
          body: payload.message,
          attachments: payload.attachments ?? [],
          sent_at: nowIso,
          author_id: user.id,
        })
        .select('*')
        .single();

      if (messageError) {
        throw messageError;
      }

      await client
        .from('outreach_threads')
        .update({ last_message_at: nowIso })
        .eq('id', threadId);

      return new Response(
        JSON.stringify({ success: true, message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (error) {
      if (error instanceof UsageLimitError) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      console.error('outreach-send error', error);
      return new Response(
        JSON.stringify({ error: error?.message ?? 'Unknown error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  });
}
