import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Handle } from '@sveltejs/kit';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '$env/static/private';
import type { Database } from '$lib/database.types';

const PUBLIC_HEADERS = new Set(['content-range', 'x-supabase-api-version']);

export const handle: Handle = async ({ event, resolve }) => {
  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: (name) => event.cookies.get(name),
      set: (name, value, options) => {
        event.cookies.set(name, value, { ...options, path: '/' });
      },
      remove: (name, options) => {
        event.cookies.delete(name, { ...options, path: '/' });
      },
    },
    global: {
      headers: (() => {
        const authHeader = event.request.headers.get('Authorization');
        return authHeader ? { Authorization: authHeader } : undefined;
      })(),
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  event.locals.supabase = supabase as unknown as SupabaseClient<any>;
  event.locals.getSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  };

  const response = await resolve(event, {
    filterSerializedResponseHeaders: (name) => PUBLIC_HEADERS.has(name.toLowerCase()),
  });

  return response;
};
