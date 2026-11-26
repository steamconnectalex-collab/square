-- Square. — convites, criar canal e presença (migração 0003).
-- Segurança: funções SECURITY DEFINER com search_path vazio; só usuários logados executam.

-- ---------- presença: última vez que a pessoa esteve online ----------
alter table public.profiles add column if not exists last_seen timestamptz;
grant select (last_seen) on public.profiles to authenticated;
grant update (last_seen) on public.profiles to authenticated;

-- ---------- convites (só as funções abaixo mexem; sem acesso direto pelo navegador) ----------
create table if not exists public.server_invites (
  code text primary key,
  server_id uuid not null references public.servers(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  max_uses integer not null default 50,
  uses integer not null default 0
);
create index if not exists server_invites_server_idx on public.server_invites (server_id);
create index if not exists server_invites_creator_idx on public.server_invites (created_by);
alter table public.server_invites enable row level security;
revoke all on public.server_invites from anon, authenticated;
grant all on public.server_invites to service_role;

-- ---------- criar canal (só o dono do servidor) ----------
create or replace function public.create_channel(p_server uuid, p_name text, p_kind text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  nm text := btrim(coalesce(p_name, ''));
  n integer;
  pos integer;
  cid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('text', 'voice') then raise exception 'invalid_kind'; end if;
  if char_length(nm) < 1 or char_length(nm) > 30 then raise exception 'invalid_name'; end if;
  if not exists (select 1 from public.servers s where s.id = p_server and s.owner_id = uid) then
    raise exception 'not_owner';
  end if;
  select count(*), coalesce(max(position), -1) + 1 into n, pos from public.channels where server_id = p_server;
  if n >= 30 then raise exception 'too_many_channels'; end if;
  insert into public.channels (server_id, name, kind, position) values (p_server, nm, p_kind, pos)
  returning id into cid;
  return cid;
end;
$$;

-- ---------- criar convite (qualquer membro) ----------
create or replace function public.create_invite(p_server uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.server_members m where m.server_id = p_server and m.user_id = uid) then
    raise exception 'not_member';
  end if;
  c := encode(extensions.gen_random_bytes(5), 'hex');
  insert into public.server_invites (code, server_id, created_by) values (c, p_server, uid);
  return c;
end;
$$;

-- ---------- entrar num servidor por convite ----------
create or replace function public.join_server(p_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.server_invites%rowtype;
  n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into inv from public.server_invites where code = lower(btrim(coalesce(p_code, ''))) for update;
  if not found or inv.expires_at < now() or inv.uses >= inv.max_uses then
    raise exception 'invalid_invite';
  end if;
  if exists (select 1 from public.server_members m where m.server_id = inv.server_id and m.user_id = uid) then
    return inv.server_id;
  end if;
  select count(*) into n from public.server_members where user_id = uid;
  if n >= 20 then raise exception 'too_many_servers'; end if;
  insert into public.server_members (server_id, user_id, role) values (inv.server_id, uid, 'member')
  on conflict do nothing;
  update public.server_invites set uses = uses + 1 where code = inv.code;
  return inv.server_id;
end;
$$;

revoke all on function public.create_channel(uuid, text, text), public.create_invite(uuid), public.join_server(text) from public, anon;
grant execute on function public.create_channel(uuid, text, text), public.create_invite(uuid), public.join_server(text) to authenticated;
