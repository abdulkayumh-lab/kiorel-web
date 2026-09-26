create or replace function public.claim_forensics_job(p_worker_id text, p_stale_after_seconds integer default 900)
returns setof public.analysis_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select id
    from public.analysis_jobs
    where (
      status = 'queued'
      or (status = 'running' and started_at < now() - make_interval(secs => p_stale_after_seconds))
    )
    order by created_at asc
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
