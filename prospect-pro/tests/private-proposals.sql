-- Run only against a disposable PostgreSQL database:
-- psql -X -v ON_ERROR_STOP=1 -f tests/private-proposals.sql
begin;
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create table public.prospect_crm_leads (
  id text primary key,
  owner_id uuid not null references auth.users,
  business_name text not null,
  opted_out boolean not null default false,
  archived_at timestamptz,
  stage text not null default 'Novo',
  operator_confirmed boolean not null default true,
  updated_at timestamptz not null default statement_timestamp()
);
grant select, update on public.prospect_crm_leads to authenticated;

\ir ../supabase/migrations/20261126234436_prospect_private_proposals.sql

insert into auth.users (id) values
  ('0149f43d-a1a1-44b1-ab12-aac2aa935526'), ('0149f43d-a1a1-44b1-ab12-aac2aa935527');
insert into public.prospect_crm_leads (id, owner_id, business_name) values
  ('lead-1', '0149f43d-a1a1-44b1-ab12-aac2aa935526', 'Salão de teste 1'),
  ('lead-2', '0149f43d-a1a1-44b1-ab12-aac2aa935526', 'Salão de teste 2'),
  ('lead-3', '0149f43d-a1a1-44b1-ab12-aac2aa935527', 'Cadastro de outra conta');

do $$
begin
  if has_table_privilege('anon', 'public.prospect_private_proposals', 'SELECT')
    or has_table_privilege('authenticated', 'public.prospect_private_proposals', 'SELECT')
    or has_function_privilege('anon', 'public.prospect_access_private_proposal(text,text,integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.prospect_access_private_proposal(text,text,integer)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.prospect_create_private_proposal(uuid,text,text,integer,jsonb,jsonb)', 'EXECUTE') then
    raise exception 'Tabelas e RPCs de propostas privadas devem exigir service_role.';
  end if;
end
$$;

set local role service_role;
do $$
declare
  owner uuid := '0149f43d-a1a1-44b1-ab12-aac2aa935526';
  test_offer jsonb := '{"price":"valor de teste"}';
  models jsonb := '[{"label":"Primeira","html":"<h1>Primeira</h1>"},{"label":"Segunda","html":"<h1>Segunda</h1>"},{"label":"Terceira","html":"<h1>Terceira</h1>"}]';
begin
  begin
    perform public.prospect_create_private_proposal(owner, 'lead-3', repeat('3',64), 7, models, test_offer);
    raise exception 'Conta não pode emitir para empresa alheia.';
  exception when sqlstate 'PT404' then null;
  end;
  perform public.prospect_create_private_proposal(owner, 'lead-1', repeat('1',64), 7, models, test_offer);
  perform public.prospect_create_private_proposal(owner, 'lead-2', repeat('2',64), 2, models, null);

  if (select expires_at - created_at from public.prospect_private_proposals where token_hash = repeat('1',64)) <> interval '7 days'
    or public.prospect_access_private_proposal(repeat('1',64), 'html', 1)::text <> '"<h1>Segunda</h1>"' then
    raise exception 'Prazo ou modelo incorreto.';
  end if;
  if public.prospect_access_private_proposal(repeat('1',64), 'read', null) -> 'offer' is distinct from 'null'::jsonb then
    raise exception 'Oferta exposta antes do interesse.';
  end if;
  if (select viewed_at from public.prospect_private_proposals where token_hash = repeat('1',64)) is not null then
    raise exception 'Leitura inicial não é visualização intencional.';
  end if;
  perform public.prospect_access_private_proposal(repeat('1',64), 'view', 1);
  if public.prospect_access_private_proposal(repeat('1',64), 'interest', null) -> 'offer' is distinct from test_offer then
    raise exception 'O cliente deve receber sua oferta depois de manifestar interesse.';
  end if;
  perform public.prospect_create_private_proposal(owner, 'lead-1', repeat('f',64), 7, models, test_offer);
  if exists (select 1 from public.prospect_private_proposals
    where token_hash = repeat('1',64) and (variants is not null or offer is not null or revoked_at is null)) then
    raise exception 'A emissão seguinte deve revogar e apagar a versão anterior.';
  end if;
  if public.prospect_access_private_proposal(repeat('f',64), 'refuse', null) is distinct from '{"refused":true}'::jsonb then
    raise exception 'Recusa não registrada.';
  end if;
  if exists (select 1 from public.prospect_private_proposals
    where lead_id = 'lead-1' and (variants is not null or offer is not null or revoked_at is null)) then
    raise exception 'Recusa não revogou os links e excluiu os materiais.';
  end if;
  if (select refused_at from public.prospect_private_proposals where token_hash = repeat('f',64)) is null then
    raise exception 'Recusa não aparece nas métricas.';
  end if;
  begin
    perform public.prospect_create_private_proposal(owner, 'lead-1', repeat('a',64), 7, models, test_offer);
    raise exception 'Contato bloqueado não deve receber nova proposta.';
  exception when sqlstate 'PT409' then null;
  end;
  if public.prospect_access_private_proposal(repeat('2',64), 'read', null) ->> 'businessName' <> 'Salão de teste 2' then
    raise exception 'Recusa afetou outra empresa.';
  end if;
end
$$;
reset role;

-- Simula upsert obsoleto da sincronização do CRM e opt-out manual via CRM.
set local role authenticated;
update public.prospect_crm_leads set opted_out = false, stage = 'Novo', private_proposal_refused_at = null where id = 'lead-1';
update public.prospect_crm_leads set opted_out = true, stage = 'Não contatar' where id = 'lead-2';
reset role;

do $$
begin
  if not exists (select 1 from public.prospect_crm_leads where id = 'lead-1' and opted_out and stage = 'Não contatar') then
    raise exception 'O CRM desfez uma recusa anterior.';
  end if;
  if exists (select 1 from public.prospect_private_proposals where lead_id = 'lead-2'
    and (variants is not null or revoked_at is null or refused_at is not null)) then
    raise exception 'Opt-out manual deve revogar e apagar as prévias sem fabricar uma recusa do cliente.';
  end if;
end
$$;
rollback;
