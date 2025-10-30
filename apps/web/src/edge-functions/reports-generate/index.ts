import { corsHeaders, buildSupabaseClient, maybeHandleCors } from '../_shared/supabaseClient.ts';

type ReportPayload = {
  campaign_id: string;
  from?: string;
  to?: string;
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

      const { client } = buildSupabaseClient(req);
      const payload = (await req.json()) as ReportPayload;
      if (!payload?.campaign_id) {
        return new Response(
          JSON.stringify({ error: 'campaign_id is required' }),
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

      const { data: campaign, error: campaignError } = await client
        .from('campaigns')
        .select('id, created_by, name')
        .eq('id', payload.campaign_id)
        .maybeSingle();

      if (campaignError || !campaign) {
        return new Response(
          JSON.stringify({ error: 'Campaign not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      if (campaign.created_by !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      const from = payload.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = payload.to ?? new Date().toISOString();

      const { data: metrics, error: metricsError } = await client
        .from('campaign_metrics')
        .select('*')
        .eq('campaign_id', campaign.id)
        .gte('metric_date', from)
        .lte('metric_date', to)
        .order('metric_date');

      if (metricsError) {
        throw metricsError;
      }

      const summary = (metrics ?? []).reduce(
        (acc, row) => {
          acc.impressions += row.impressions ?? 0;
          acc.clicks += row.clicks ?? 0;
          acc.conversions += row.conversions ?? 0;
          acc.spend_cents += row.spend_cents ?? 0;
          return acc;
        },
        { impressions: 0, clicks: 0, conversions: 0, spend_cents: 0 }
      );

      return new Response(
        JSON.stringify({ campaign, range: { from, to }, summary, metrics }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (error) {
      console.error('reports-generate error', error);
      return new Response(
        JSON.stringify({ error: error?.message ?? 'Unknown error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  });
}
