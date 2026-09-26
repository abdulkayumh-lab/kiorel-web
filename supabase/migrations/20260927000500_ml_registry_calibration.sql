create table if not exists public.detector_calibrations (
  id uuid primary key default gen_random_uuid(),
  detector_model_id uuid not null references public.detector_models(id) on delete cascade,
  calibration_version text not null,
  method text not null,
  parameters jsonb not null default '{}'::jsonb,
  operating_points jsonb not null default '[]'::jsonb,
  dataset_name text,
  dataset_version text,
  validation_metrics jsonb not null default '{}'::jsonb,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (detector_model_id, calibration_version)
);

alter table public.detector_calibrations enable row level security;

create policy "members can read detector calibrations"
on public.detector_calibrations for select to authenticated
using (true);

create index if not exists detector_calibration_approved_idx
  on public.detector_calibrations(detector_model_id, approved);

alter table public.detector_models
  add column if not exists task text not null default 'image_forensics',
  add column if not exists provider text not null default 'local',
  add column if not exists input_schema jsonb not null default '{}'::jsonb,
  add column if not exists output_schema jsonb not null default '{}'::jsonb,
  add column if not exists enabled boolean not null default false;
