import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '$lib/database.types';
import { env } from '$env/dynamic/public';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export const getBrowserClient = () => {
  if (!browserClient) {
    const supabaseUrl = env.PUBLIC_SUPABASE_URL;
    const anonKey = env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY environment variables.');
    }

    browserClient = createBrowserClient<Database>(supabaseUrl, anonKey);
  }

  return browserClient;
};
