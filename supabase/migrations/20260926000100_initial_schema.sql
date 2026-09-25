create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  domain text not null,
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz not null default now(),
  unique (organization_id, domain)
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  type text not null check (type in ('meta_capi','ga4','webhook')),
  name text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  event_name text not null,
  event_id text not null,
  event_time timestamptz not null default now(),
  received_at timestamptz not null default now(),
  properties jsonb not null default '{}'::jsonb,
  unique (website_id, event_id)
);

create table if not exists public.event_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  destination_id uuid not null references public.destinations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sent','failed','retrying')),
  attempts integer not null default 0,
  response_code integer,
  error_message text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, destination_id)
);

create index if not exists events_website_received_idx on public.events(website_id, received_at desc);
create index if not exists deliveries_status_idx on public.event_deliveries(status, created_at);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.websites enable row level security;
alter table public.api_keys enable row level security;
alter table public.destinations enable row level security;
alter table public.events enable row level security;
alter table public.event_deliveries enable row level security;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create policy "organization members can read organization"
on public.organizations for select to authenticated
using (id = public.current_organization_id());

create policy "members can read websites"
on public.websites for select to authenticated
using (organization_id = public.current_organization_id());

create policy "members can manage websites"
on public.websites for all to authenticated
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members can read destinations"
on public.destinations for select to authenticated
using (website_id in (select id from public.websites where organization_id = public.current_organization_id()));

create policy "members can manage destinations"
on public.destinations for all to authenticated
using (website_id in (select id from public.websites where organization_id = public.current_organization_id()))
with check (website_id in (select id from public.websites where organization_id = public.current_organization_id()));

create policy "members can read events"
on public.events for select to authenticated
using (website_id in (select id from public.websites where organization_id = public.current_organization_id()));

create policy "members can read deliveries"
on public.event_deliveries for select to authenticated
using (event_id in (
  select e.id from public.events e
  join public.websites w on w.id = e.website_id
  where w.organization_id = public.current_organization_id()
));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
