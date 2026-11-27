-- Keep commercial status history while removing the expired HTML, embedded images
-- and offer. A bounded batch avoids competing with delivery and CRM updates.
create index prospect_private_proposals_pending_expiration
  on public.prospect_private_proposals (expires_at, id)
  where variants is not null or offer is not null;

create function prospect_internal.purge_expired_proposal_payloads()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with expired as (
    select id
    from public.prospect_private_proposals
    where expires_at <= statement_timestamp()
      and (variants is not null or offer is not null)
    order by expires_at, id
    limit 250
    for update skip locked
  ), purged as (
    update public.prospect_private_proposals as proposals
    set variants = null, offer = null
    from expired
    where proposals.id = expired.id
    returning 1
  )
  select count(*)::integer from purged;
$$;

revoke all on function prospect_internal.purge_expired_proposal_payloads()
  from public, anon, authenticated;

-- The app keeps enforcing expiration without pg_cron. Only register a job
-- when the database already has the integration.
do $$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron')
    and pg_catalog.to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule(
      'prospect-private-proposal-cleanup',
      '*/15 * * * *',
      'select prospect_internal.purge_expired_proposal_payloads()'
    );
  else
    raise notice 'Supabase Cron indisponível. A limpeza periódica não foi agendada.';
  end if;
end
$$;
