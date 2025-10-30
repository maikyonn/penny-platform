import { createServerClient } from '@supabase/ssr';
import type { Database } from '$lib/database.types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '$env/static/private';
import type { Cookies } from '@sveltejs/kit';

export const getSupabaseServerClient = (cookies: Cookies) =>
  createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: (name) => cookies.get(name),
      set: (name, value, options) => {
        cookies.set(name, value, { ...options, path: '/' });
      },
      remove: (name, options) => {
        cookies.delete(name, { ...options, path: '/' });
      },
    },
  });
