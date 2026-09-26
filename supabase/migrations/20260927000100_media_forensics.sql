create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  filename text,
  mime_type text not null,
  size_bytes bigint,
  width integer,
  height integer,
  sha256 text not null,
  storage_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists media_org_created_idx
  on public.media(organization_id, created_at desc);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued','ingesting','provenance','pixel_analysis','ml_analysis','evidence_fusion','reporting','complete','failed')),
  pipeline_version text not null default '1.0.0',
  assessment text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists analyses_media_created_idx
  on public.analyses(media_id, created_at desc);
create index if not exists analyses_status_idx
  on public.analyses(status, created_at);

create table if not exists public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued'
    check (status in ('queued','running','complete','failed')),
  attempts integer not null default 0,
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (analysis_id, job_type)
);

create table if not exists public.provenance_records (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  source text not null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.metadata_records (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.forensic_artifacts (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  artifact_type text not null,
  storage_key text not null,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.detector_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  model_hash text,
  framework text,
  weights_uri text,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create table if not exists public.detector_runs (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  detector_model_id uuid references public.detector_models(id) on delete set null,
  detector_name text not null,
  status text not null default 'complete',
  score numeric,
  findings jsonb not null default '[]'::jsonb,
  artifacts jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  category text not null,
  detector text not null,
  finding text not null,
  score numeric,
  strength text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists evidence_analysis_idx
  on public.evidence_items(analysis_id, created_at);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  format text not null check (format in ('json','pdf')),
  storage_key text,
  report jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.media enable row level security;
alter table public.analyses enable row level security;
alter table public.analysis_jobs enable row level security;
alter table public.provenance_records enable row level security;
alter table public.metadata_records enable row level security;
alter table public.forensic_artifacts enable row level security;
alter table public.detector_models enable row level security;
alter table public.detector_runs enable row level security;
alter table public.evidence_items enable row level security;
alter table public.reports enable row level security;
alter table public.audit_events enable row level security;

create policy "members can read media"
on public.media for select to authenticated
using (organization_id = public.current_organization_id());

create policy "members can manage media"
on public.media for all to authenticated
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members can read analyses"
on public.analyses for select to authenticated
using (media_id in (
  select id from public.media where organization_id = public.current_organization_id()
));

create policy "members can read analysis jobs"
on public.analysis_jobs for select to authenticated
using (analysis_id in (
  select a.id from public.analyses a
  join public.media m on m.id = a.media_id
  where m.organization_id = public.current_organization_id()
));

create policy "members can read provenance"
on public.provenance_records for select to authenticated
using (analysis_id in (
  select a.id from public.analyses a
  join public.media m on m.id = a.media_id
  where m.organization_id = public.current_organization_id()
));

create policy "members can read metadata"
on public.metadata_records for select to authenticated
using (analysis_id in (
  select a.id from public.analyses a
  join public.media m on m.id = a.media_id
  where m.organization_id = public.current_organization_id()
));

create policy "members can read forensic artifacts"
on public.forensic_artifacts for select to authenticated
using (analysis_id in (
  select a.id from public.analyses a
  join public.media m on m.id = a.media_id
  where m.organization_id = public.current_organization_id()
));

create policy "members can read detector runs"
on public.detector_runs for select to authenticated
using (analysis_id in (
  select a.id from public.analyses a
  join public.media m on m.id = a.media_id
  where m.organization_id = public.current_organization_id()
));

create policy "members can read evidence"
on public.evidence_items for select to authenticated
using (analysis_id in (
  select a.id from public.analyses a
  join public.media m on m.id = a.media_id
  where m.organization_id = public.current_organization_id()
));

create policy "members can read reports"
on public.reports for select to authenticated
using (analysis_id in (
  select a.id from public.analyses a
  join public.media m on m.id = a.media_id
  where m.organization_id = public.current_organization_id()
));

create policy "members can read audit events"
on public.audit_events for select to authenticated
using (organization_id = public.current_organization_id());
