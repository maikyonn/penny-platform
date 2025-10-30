// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
	interface Locals {
		supabase: import('@supabase/supabase-js').SupabaseClient<any>;
		getSession: () => Promise<import('@supabase/supabase-js').Session | null>;
	}

	interface PageData {
		session: import('@supabase/supabase-js').Session | null;
		profile?: {
			user_id: string;
			full_name: string | null;
			avatar_url: string | null;
			locale?: string | null;
		} | null;
		subscription?: import('$lib/database.types').Database['public']['Tables']['subscriptions']['Row'] | null;
		form?: any;
		[key: string]: unknown;
	}
	}
}

export {};
