-- Creates gmail_accounts table for storing OAuth tokens per user
create table if not exists public.gmail_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  access_token text not null,
  refresh_token text not null,
  scope text[] not null default '{}',
  token_type text not null default 'Bearer',
  expiry timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists gmail_accounts_email_idx on public.gmail_accounts(email);
