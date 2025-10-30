/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module '$env/static/private' {
  export const SUPABASE_URL: string;
  export const SUPABASE_ANON_KEY: string;
  export const SUPABASE_SERVICE_ROLE_KEY: string;
  export const SUPABASE_DB_URL: string;
  export const STRIPE_SECRET_KEY: string;
  export const STRIPE_WEBHOOK_SECRET: string;
  export const STRIPE_PRICE_STARTER_MONTHLY: string;
  export const STRIPE_PRICE_PRO_MONTHLY: string;
  export const STRIPE_TRIAL_DAYS: string;
}

declare module '$env/static/public' {
  export const PUBLIC_SUPABASE_URL: string;
  export const PUBLIC_SUPABASE_ANON_KEY: string;
  export const PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  export const PUBLIC_SITE_URL: string;
}

declare module '$env/dynamic/private' {
  export const env: {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    SUPABASE_DB_URL: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_PRICE_STARTER_MONTHLY: string;
    STRIPE_PRICE_PRO_MONTHLY: string;
    STRIPE_TRIAL_DAYS: string;
    [key: string]: string | undefined;
  };
}

declare module '$env/dynamic/public' {
  export const env: {
    PUBLIC_SUPABASE_URL: string;
    PUBLIC_SUPABASE_ANON_KEY: string;
    PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
    PUBLIC_SITE_URL: string;
    [key: string]: string | undefined;
  };
}
