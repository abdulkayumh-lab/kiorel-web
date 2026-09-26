create table if not exists public.fusion_runs (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  fusion_version text not null,
  evidence_snapshot_hash text not null,
  classification text not null,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  components jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  decision_basis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fusion_runs_analysis_created_idx
  on public.fusion_runs(analysis_id, created_at desc);

alter table public.fusion_runs enable row level security;

create policy "members can read fusion runs"
on public.fusion_runs for select to authenticated
using (analysis_id in (
  select a.id from public.analyses a
  join public.media m on m.id = a.media_id
  where m.organization_id = public.current_organization_id()
));

alter table public.detector_calibrations
  add column if not exists score_semantics text not null default 'unknown'
  check (score_semantics in ('unknown','manipulation_probability','authenticity_probability'));

create index if not exists detector_calibrations_semantics_idx
  on public.detector_calibrations(detector_model_id, approved, score_semantics);
