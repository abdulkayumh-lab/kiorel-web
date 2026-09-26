create or replace function public.claim_forensics_job(p_worker_id text, p_stale_after_seconds integer default 900)
returns setof public.analysis_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select j.id
    from public.analysis_jobs j
    join public.analyses a on a.id = j.analysis_id
    where (
      (j.status = 'queued' and (
        (j.job_type = 'ingest' and a.status = 'queued') or
        (j.job_type = 'provenance' and a.status = 'provenance') or
        (j.job_type = 'pixel_analysis' and a.status = 'pixel_analysis') or
        (j.job_type = 'ml_analysis' and a.status = 'ml_analysis') or
        (j.job_type = 'evidence_fusion' and a.status = 'evidence_fusion') or
        (j.job_type = 'reporting' and a.status = 'reporting')
      ))
      or (j.status = 'running' and j.started_at < now() - make_interval(secs => p_stale_after_seconds))
    )
    order by j.created_at asc
    for update skip locked
    limit 1
  )
  update public.analysis_jobs j
  set status = 'running',
      attempts = j.attempts + 1,
      started_at = now(),
      error_message = null
  from candidate
  where j.id = candidate.id
  returning j.*;
end;
$$;

revoke all on function public.claim_forensics_job(text, integer) from public;
grant execute on function public.claim_forensics_job(text, integer) to service_role;
