// Shared helper utilities for Supabase Edge Functions
import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Database } from '../../lib/database.types.ts';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function buildSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? undefined;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';

  const client = createClient<Database>(supabaseUrl, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    },
  });

  const adminClient = supabaseServiceRoleKey
    ? createClient<Database>(supabaseUrl, supabaseServiceRoleKey)
    : client;

  return { client, adminClient, authHeader };
}

export function maybeHandleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}
