create unique index if not exists detector_models_name_version_idx
  on public.detector_models(name, version);

alter table public.detector_models
  add column if not exists runtime_command_env text,
  add column if not exists artifact_schema jsonb not null default '{}'::jsonb;

insert into public.detector_models
  (name, version, task, provider, input_schema, output_schema,
   runtime_command_env, artifact_schema, enabled)
values
  ('trufor', 'unconfigured', 'image_forgery_localization', 'external_gpu',
   '{"mime_types":["image/jpeg","image/png","image/webp","image/tiff"]}'::jsonb,
   '{"score":"float[0,1]","localization_map":"optional","confidence_map":"optional"}'::jsonb,
   'TRUFOR_COMMAND',
   '{"localization_map":"npy","confidence_map":"npy"}'::jsonb,
   false),
  ('dire', 'unconfigured', 'diffusion_generated_image_detection', 'external_gpu',
   '{"mime_types":["image/jpeg","image/png","image/webp","image/tiff"]}'::jsonb,
   '{"score":"float","localization_map":"none","confidence_map":"none"}'::jsonb,
   'DIRE_COMMAND',
   '{}'::jsonb,
   false)
on conflict (name, version) do nothing;
