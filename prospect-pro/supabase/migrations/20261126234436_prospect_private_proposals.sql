-- Proposals are served only by the Prospect PRO backend. No public storage bucket
-- is involved: images are embedded in the HTML and purged with that content.
create table public.prospect_private_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  lead_id text not null references public.prospect_crm_leads (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  business_name text not null,
  variants jsonb check (variants is null or jsonb_array_length(variants) = 3),
  offer jsonb,
  created_at timestamptz not null default statement_timestamp(),
  contact_authorized_at timestamptz not null,
  expires_at timestamptz not null,
  viewed_at timestamptz,
  interested_at timestamptz,
  refused_at timestamptz,
  revoked_at timestamptz
);

alter table public.prospect_private_proposals enable row level security;
revoke all on table public.prospect_private_proposals from public, anon, authenticated;
grant select on table public.prospect_private_proposals to service_role;
grant insert, update on table public.prospect_private_proposals to service_role;
create index prospect_private_proposals_owner_created
  on public.prospect_private_proposals (owner_id, created_at desc, id desc);
create index prospect_private_proposals_lead on public.prospect_private_proposals (lead_id);

alter table public.prospect_crm_leads add column private_proposal_refused_at timestamptz;
grant update (opted_out, stage, private_proposal_refused_at, updated_at)
  on table public.prospect_crm_leads to service_role;
grant select on table public.prospect_crm_leads to service_role;

-- The CRM sync may push an older tab's copy of this lead. Preserve actual client
-- refusals. Operator-only flags can still be changed using the existing CRM flow.
create schema if not exists prospect_internal;
revoke all on schema prospect_internal from public, anon, authenticated;

create function prospect_internal.keep_prospect_refusal()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.private_proposal_refused_at is not null then
    new.private_proposal_refused_at := old.private_proposal_refused_at;
    new.opted_out := true;
    new.stage := 'Não contatar';
  end if;
  return new;
end
$$;

revoke all on function prospect_internal.keep_prospect_refusal() from public, anon, authenticated;

create trigger keep_prospect_refusal before update on public.prospect_crm_leads
  for each row execute function prospect_internal.keep_prospect_refusal();

-- A trusted trigger on the lead row invalidates only that lead's proposals,
-- including when the operator sets the opt-out via the existing CRM API.
create function prospect_internal.purge_blocked_prospect_proposals()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.prospect_private_proposals p
    set variants = null, offer = null,
        refused_at = case when p.revoked_at is null and p.expires_at > statement_timestamp()
          then coalesce(p.refused_at, new.private_proposal_refused_at) else p.refused_at end,
        revoked_at = case when p.expires_at > statement_timestamp()
          then coalesce(p.revoked_at, statement_timestamp()) else p.revoked_at end
    where p.owner_id = new.owner_id and p.lead_id = new.id
      and (p.variants is not null or p.offer is not null);
  return new;
end
$$;

revoke all on function prospect_internal.purge_blocked_prospect_proposals() from public, anon, authenticated;

create trigger purge_blocked_prospect_proposals after update on public.prospect_crm_leads
  for each row when (
    (new.opted_out and (not old.opted_out or
      new.private_proposal_refused_at is distinct from old.private_proposal_refused_at))
    or (new.archived_at is not null and old.archived_at is null)
    or (new.stage in ('Não contatar', 'Arquivado') and new.stage is distinct from old.stage)
  )
  execute function prospect_internal.purge_blocked_prospect_proposals();

create function public.prospect_create_private_proposal(
  p_owner_id uuid, p_lead_id text, p_token_hash text, p_days integer, p_variants jsonb, p_offer jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  lead public.prospect_crm_leads%rowtype;
  proposal public.prospect_private_proposals%rowtype;
begin
  select * into lead from public.prospect_crm_leads
    where id = p_lead_id and owner_id = p_owner_id for update;

  if not found then
    raise exception 'Empresa não cadastrada nesta conta.' using errcode = 'PT404';
  end if;
  if lead.opted_out or lead.archived_at is not null or lead.stage in ('Não contatar','Arquivado')
      or not lead.operator_confirmed then
    raise exception 'O cadastro precisa estar confirmado e liberado para contato.' using errcode = 'PT409';
  end if;
  if p_days is null or p_days not between 1 and 30 or p_variants is null then
    raise exception 'Validade ou modelos inválidos.' using errcode = 'PT422';
  end if;

  update public.prospect_private_proposals p
    set variants = null, offer = null,
        revoked_at = case when p.expires_at > statement_timestamp()
          then coalesce(p.revoked_at, statement_timestamp()) else p.revoked_at end
    where p.owner_id = p_owner_id and p.lead_id = p_lead_id
      and (p.variants is not null or p.offer is not null);

  insert into public.prospect_private_proposals (owner_id, lead_id, token_hash, business_name,
    variants, offer, contact_authorized_at, expires_at)
  values (p_owner_id, p_lead_id, p_token_hash, lead.business_name,
    p_variants, p_offer, statement_timestamp(), statement_timestamp() + p_days * interval '24 hours')
  returning * into proposal;

  return jsonb_build_object('id', proposal.id, 'expiresAt', proposal.expires_at);
end
$$;

revoke all on function public.prospect_create_private_proposal(uuid,text,text,integer,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.prospect_create_private_proposal(uuid,text,text,integer,jsonb,jsonb) to service_role;

create function public.prospect_access_private_proposal(p_token_hash text, p_action text, p_variant integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  proposal public.prospect_private_proposals%rowtype;
  lead public.prospect_crm_leads%rowtype;
begin
  if p_action not in ('read', 'html', 'view', 'interest', 'refuse') then
    raise exception 'Ação indisponível.' using errcode = 'PT400';
  end if;

  select * into proposal from public.prospect_private_proposals where token_hash = p_token_hash;
  if not found then return null; end if;

  -- Serialize mutations with creation and CRM changes for this business.
  if p_action in ('view', 'interest', 'refuse') then
    select * into lead from public.prospect_crm_leads
      where id = proposal.lead_id and owner_id = proposal.owner_id for update;
    if not found then return null; end if;
    select * into proposal from public.prospect_private_proposals
      where token_hash = p_token_hash for update;
    if not found then return null; end if;
  else
    select * into lead from public.prospect_crm_leads
      where id = proposal.lead_id and owner_id = proposal.owner_id;
    if not found then return null; end if;
  end if;

  if proposal.revoked_at is not null or proposal.expires_at <= clock_timestamp()
    or lead.opted_out or lead.archived_at is not null or lead.stage in ('Não contatar', 'Arquivado') then
    -- Avoid retaining expired renders once an expired link is revisited.
    update public.prospect_private_proposals set variants = null, offer = null
      where id = proposal.id and expires_at <= clock_timestamp()
        and (variants is not null or offer is not null);
    return jsonb_build_object('inactive', true);
  end if;

  if p_action = 'refuse' then
    update public.prospect_crm_leads
      set opted_out = true, stage = 'Não contatar', private_proposal_refused_at = statement_timestamp(),
          updated_at = statement_timestamp()
      where id = lead.id;
    return jsonb_build_object('refused', true);
  end if;

  if p_action in ('view', 'interest') then
    update public.prospect_private_proposals
      set viewed_at = coalesce(viewed_at, statement_timestamp()),
          interested_at = case when p_action = 'interest' then coalesce(interested_at, statement_timestamp())
            else interested_at end
      where id = proposal.id
    returning * into proposal;
  end if;

  if p_action = 'html' then
    return proposal.variants -> p_variant -> 'html';
  end if;

  return jsonb_build_object(
    'businessName', proposal.business_name, 'expiresAt', proposal.expires_at,
    'labels', jsonb_build_array(proposal.variants -> 0 -> 'label', proposal.variants -> 1 -> 'label',
      proposal.variants -> 2 -> 'label'),
    'offer', case when proposal.interested_at is not null then proposal.offer else null end,
    'interested', proposal.interested_at is not null
  );
end
$$;

revoke all on function public.prospect_access_private_proposal(text,text,integer) from public, anon, authenticated;
grant execute on function public.prospect_access_private_proposal(text,text,integer) to service_role;
