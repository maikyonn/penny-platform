-- Enable useful extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Enumerated types
create type plan_tier as enum ('free','starter','pro','enterprise');
create type membership_role as enum ('owner','admin','member','viewer');
create type campaign_status as enum ('draft','active','paused','completed','archived');
create type campaign_influencer_status as enum (
  'prospect','invited','accepted','declined','in_conversation','contracted','completed'
);
create type outreach_channel as enum ('email','dm','sms','whatsapp','other');
create type workflow_topic as enum ('campaign_brief','support','negotiation','ai_assistant');

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  plan plan_tier not null default 'free',
  billing_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  locale text default 'en',
  current_org uuid references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.org_members (
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(user_id) on delete cascade,
  role membership_role not null default 'member',
  invited_by uuid references public.profiles(user_id),
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  email text not null,
  role membership_role not null default 'member',
  token text not null,
  expires_at timestamptz not null,
  created_by uuid references public.profiles(user_id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Campaigns and assets
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(user_id),
  name text not null,
  description text,
  status campaign_status not null default 'draft',
  objective text,
  budget_cents bigint,
  currency text default 'USD',
  landing_page_url text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.campaign_targets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  audience jsonb default '{}'::jsonb,
  geos text[] default array[]::text[],
  platforms text[] default array[]::text[],
  interests text[] default array[]::text[],
  created_at timestamptz not null default now()
);

create table public.campaign_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  storage_path text not null,
  kind text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.campaign_metrics (
  id bigserial primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  metric_date date not null,
  impressions bigint default 0,
  clicks bigint default 0,
  conversions bigint default 0,
  spend_cents bigint default 0,
  created_at timestamptz not null default now(),
  unique (campaign_id, metric_date)
);

-- Influencers and outreach
create table public.influencers (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  display_name text,
  handle text,
  email text,
  platform text,
  follower_count bigint,
  engagement_rate numeric,
  location text,
  languages text[] default array[]::text[],
  verticals text[] default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.influencer_profiles (
  influencer_id uuid primary key references public.influencers(id) on delete cascade,
  bio text,
  demographics jsonb default '{}'::jsonb,
  rates jsonb default '{}'::jsonb,
  availability text,
  links jsonb default '{}'::jsonb,
  last_synced_at timestamptz
);

create table public.influencer_stats_history (
  id bigserial primary key,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  snapshot_date date not null,
  follower_count bigint,
  engagement_rate numeric,
  impressions bigint,
  created_at timestamptz not null default now(),
  unique (influencer_id, snapshot_date)
);

create table public.campaign_influencers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  status campaign_influencer_status not null default 'prospect',
  source text default 'manual',
  match_score numeric,
  outreach_channel outreach_channel default 'email',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, influencer_id)
);

create table public.outreach_threads (
  id uuid primary key default gen_random_uuid(),
  campaign_influencer_id uuid not null references public.campaign_influencers(id) on delete cascade,
  channel outreach_channel not null,
  external_thread_id text,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.outreach_threads(id) on delete cascade,
  direction text not null check (direction in ('brand','influencer','system')),
  body text,
  attachments text[] default array[]::text[],
  sent_at timestamptz not null default now(),
  author_id uuid references public.profiles(user_id)
);

create table public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  influencer_id uuid references public.influencers(id),
  rationale text,
  metadata jsonb default '{}'::jsonb,
  created_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now()
);

-- Chat and workflow
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  topic workflow_topic not null default 'campaign_brief',
  created_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  workflow text not null,
  status text not null default 'pending',
  input jsonb,
  output jsonb,
  error text,
  executed_by uuid references public.profiles(user_id),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Billing & usage
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  plan plan_tier not null default 'starter',
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists subscriptions_user_id_key on public.subscriptions (user_id);
create unique index if not exists subscriptions_provider_subscription_id_key on public.subscriptions (provider_subscription_id);

create table public.usage_logs (
  id bigserial primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null,
  quantity numeric not null,
  recorded_at timestamptz not null default now()
);

-- Basic indexes for search
create index if not exists influencers_handle_trgm on public.influencers using gin (handle gin_trgm_ops);
create index if not exists influencers_verticals_idx on public.influencers using gin (verticals);
create index if not exists campaign_influencers_campaign_idx on public.campaign_influencers (campaign_id);
create index if not exists campaign_influencers_status_idx on public.campaign_influencers (status);
create index if not exists chat_messages_session_idx on public.chat_messages (session_id, created_at);

-- Enable Row Level Security
do $$
declare
  rec record;
begin
  for rec in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security;', rec.tablename);
  end loop;
end$$;

-- Helper function to check membership
create or replace function public.is_org_member(_org uuid)
returns boolean as $$
  select exists (
    select 1 from public.org_members om
    where om.org_id = _org and om.user_id = auth.uid()
  );
$$ language sql stable;

-- Policies
create policy "Profiles are self accessible" on public.profiles
  for select using (auth.uid() = user_id);

create policy "Org profiles visible to members" on public.profiles
  for select using (
    exists (
      select 1 from public.org_members om
      where om.user_id = auth.uid() and om.org_id = profiles.current_org
    )
  );

create policy "Members manage organizations" on public.organizations
  for select using (public.is_org_member(id));

create policy "Members update organizations" on public.organizations
  for update using (
    exists (select 1 from public.org_members om where om.org_id = organizations.id and om.user_id = auth.uid() and om.role in ('owner','admin'))
  ) with check (true);

create policy "Members manage campaigns" on public.campaigns
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "Members manage campaign targets" on public.campaign_targets
  for all using (
    exists (select 1 from public.campaigns c where c.id = campaign_targets.campaign_id and public.is_org_member(c.org_id))
  ) with check (
    exists (select 1 from public.campaigns c where c.id = campaign_targets.campaign_id and public.is_org_member(c.org_id))
  );

create policy "Members manage campaign assets" on public.campaign_assets
  for all using (
    exists (select 1 from public.campaigns c where c.id = campaign_assets.campaign_id and public.is_org_member(c.org_id))
  ) with check (
    exists (select 1 from public.campaigns c where c.id = campaign_assets.campaign_id and public.is_org_member(c.org_id))
  );

create policy "Members view influencers" on public.influencers
  for select using (true);

create policy "Members manage campaign influencers" on public.campaign_influencers
  for all using (
    exists (select 1 from public.campaigns c where c.id = campaign_influencers.campaign_id and public.is_org_member(c.org_id))
  ) with check (
    exists (select 1 from public.campaigns c where c.id = campaign_influencers.campaign_id and public.is_org_member(c.org_id))
  );

create policy "Members access chat sessions" on public.chat_sessions
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "Members access chat messages" on public.chat_messages
  for all using (
    exists (
      select 1 from public.chat_sessions cs
      where cs.id = chat_messages.session_id and public.is_org_member(cs.org_id)
    )
  ) with check (
    exists (
      select 1 from public.chat_sessions cs
      where cs.id = chat_messages.session_id and public.is_org_member(cs.org_id)
    )
  );

create policy "Members access workflow runs" on public.workflow_runs
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "Users can view their subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "Members access metrics" on public.campaign_metrics
  for select using (
    exists (select 1 from public.campaigns c where c.id = campaign_metrics.campaign_id and public.is_org_member(c.org_id))
  );

create policy "Members access outreach" on public.outreach_threads
  for all using (
    exists (
      select 1 from public.campaign_influencers ci
      join public.campaigns c on ci.campaign_id = c.id
      where outreach_threads.campaign_influencer_id = ci.id and public.is_org_member(c.org_id)
    )
  ) with check (
    exists (
      select 1 from public.campaign_influencers ci
      join public.campaigns c on ci.campaign_id = c.id
      where outreach_threads.campaign_influencer_id = ci.id and public.is_org_member(c.org_id)
    )
  );

create policy "Members access outreach messages" on public.outreach_messages
  for all using (
    exists (
      select 1 from public.outreach_threads ot
      join public.campaign_influencers ci on ot.id = outreach_messages.thread_id and ot.campaign_influencer_id = ci.id
      join public.campaigns c on ci.campaign_id = c.id
      where public.is_org_member(c.org_id)
    )
  ) with check (
    exists (
      select 1 from public.outreach_threads ot
      join public.campaign_influencers ci on ot.id = outreach_messages.thread_id and ot.campaign_influencer_id = ci.id
      join public.campaigns c on ci.campaign_id = c.id
      where public.is_org_member(c.org_id)
    )
  );

-- Storage policies (referenced via storage policies file later)
