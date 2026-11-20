create table public.prospect_studio_project_versions (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id text not null check (project_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  revision bigint generated always as identity,
  version_id uuid not null,
  previous_version_id uuid,
  snapshot jsonb,
  created_at timestamptz not null default statement_timestamp(),
  primary key (owner_id, project_id, revision),
  unique (owner_id, project_id, version_id),
  check (snapshot is null or (
    jsonb_typeof(snapshot) = 'object'
    and snapshot ->> 'id' is not null
    and snapshot ->> 'id' = project_id
    and octet_length(snapshot::text) <= 200000
  ))
);

alter table public.prospect_studio_project_versions enable row level security;
revoke all on table public.prospect_studio_project_versions from public, anon, authenticated;
grant select on table public.prospect_studio_project_versions to authenticated;
grant insert (project_id, version_id, previous_version_id, snapshot)
  on table public.prospect_studio_project_versions to authenticated;

-- Provision the operator in trusted app_metadata. Every row also belongs to
-- the signed-in owner. An anonymous Supabase Auth account is ineligible.
create policy "Operators can read their own studio drafts"
  on public.prospect_studio_project_versions for select to authenticated
  using (
    owner_id = (select auth.uid())
    and (select auth.jwt() -> 'app_metadata' ->> 'prospect_operator') = 'true'
    and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

create policy "Operators can add versions to their own studio drafts"
  on public.prospect_studio_project_versions for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select auth.jwt() -> 'app_metadata' ->> 'prospect_operator') = 'true'
    and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

create function public.prospect_check_studio_project_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_version uuid;
begin
  -- Competing saves for the same project must compare against a committed
  -- revision. A retry of an already committed operation is safe to ignore.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text || ':' || new.project_id, 0));

  if exists (
    select 1 from public.prospect_studio_project_versions
    where owner_id = new.owner_id and project_id = new.project_id and version_id = new.version_id
  ) then
    return null;
  end if;

  select version_id into current_version
  from public.prospect_studio_project_versions
  where owner_id = new.owner_id and project_id = new.project_id
  order by revision desc
  limit 1;

  if current_version is distinct from new.previous_version_id then
    raise exception 'Já existe outra versão deste projeto.' using errcode = 'PT409';
  end if;

  return new;
end;
$$;

create trigger prospect_check_studio_project_version
  before insert on public.prospect_studio_project_versions
  for each row execute function public.prospect_check_studio_project_version();

revoke all on function public.prospect_check_studio_project_version() from public, anon, authenticated;

create function public.prospect_studio_current_projects()
returns table (project_id text, version_id uuid, snapshot jsonb, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (versions.project_id)
    versions.project_id, versions.version_id, versions.snapshot, versions.created_at
  from public.prospect_studio_project_versions as versions
  where versions.owner_id = (select auth.uid())
  order by versions.project_id desc, versions.revision desc
$$;

revoke all on function public.prospect_studio_current_projects() from public, anon, authenticated;
grant execute on function public.prospect_studio_current_projects() to authenticated;
