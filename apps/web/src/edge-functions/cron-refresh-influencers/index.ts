import { buildSupabaseClient } from '../_shared/supabaseClient.ts';

denoServe();

function denoServe() {
  Deno.serve(async (req) => {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { client } = buildSupabaseClient(req);

      const now = new Date().toISOString();
      const { error } = await client
        .from('influencer_profiles')
        .update({ last_synced_at: now })
        .is('last_synced_at', null)
        .limit(100);

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ status: 'ok', refreshed_at: now }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      console.error('cron-refresh-influencers error', error);
      return new Response(JSON.stringify({ error: error?.message ?? 'Unknown error' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  });
}
