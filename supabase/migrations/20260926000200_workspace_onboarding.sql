create or replace function public.ensure_workspace(workspace_name text default 'My KIOREL Workspace')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  org_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id into org_id from public.profiles where id = uid for update;

  if org_id is null then
    insert into public.organizations (name) values (coalesce(nullif(trim(workspace_name), ''), 'My KIOREL Workspace'))
    returning id into org_id;

    update public.profiles set organization_id = org_id where id = uid;
  end if;

  return org_id;
end;
$$;

revoke all on function public.ensure_workspace(text) from public;
grant execute on function public.ensure_workspace(text) to authenticated;
