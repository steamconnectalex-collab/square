-- Square. — limite de mensagens, expulsar e banir (migração 0009).

-- 1) Limite de velocidade: no máximo 5 mensagens a cada 5 s e 40 por minuto por pessoa.
create index if not exists messages_author_created_idx on public.messages (author_id, created_at desc);
create or replace function private.messages_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages where author_id = new.author_id and created_at > now() - interval '5 seconds') >= 5
     or (select count(*) from public.messages where author_id = new.author_id and created_at > now() - interval '60 seconds') >= 40 then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function private.messages_rate_limit();

-- 2) Banimentos (só o dono do servidor mexe, por funções; ninguém lê a tabela direto).
create table if not exists public.server_bans (
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  banned_at timestamptz not null default now(),
  primary key (server_id, user_id)
);
alter table public.server_bans enable row level security;
revoke all on public.server_bans from anon, authenticated;

create or replace function private.remove_from_server(p_server uuid, p_user uuid, p_ban boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.servers s where s.id = p_server and s.owner_id = uid) then raise exception 'not_owner'; end if;
  if p_user = uid then raise exception 'cannot_remove_self'; end if;
  delete from public.server_members where server_id = p_server and user_id = p_user;
  delete from public.voice_members where user_id = p_user and channel_id in (select id from public.channels where server_id = p_server);
  if p_ban then
    insert into public.server_bans (server_id, user_id) values (p_server, p_user) on conflict do nothing;
  end if;
end;
$$;
create or replace function public.kick_member(p_server uuid, p_user uuid) returns void
language sql security definer set search_path = '' as $$ select private.remove_from_server(p_server, p_user, false) $$;
create or replace function public.ban_member(p_server uuid, p_user uuid) returns void
language sql security definer set search_path = '' as $$ select private.remove_from_server(p_server, p_user, true) $$;

create or replace function public.unban_member(p_server uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.servers s where s.id = p_server and s.owner_id = (select auth.uid())) then raise exception 'not_owner'; end if;
  delete from public.server_bans where server_id = p_server and user_id = p_user;
end;
$$;

create or replace function public.list_bans(p_server uuid)
returns table (user_id uuid, username text, display_name text)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.servers s where s.id = p_server and s.owner_id = (select auth.uid())) then raise exception 'not_owner'; end if;
  return query select b.user_id, p.username::text, p.display_name::text
    from public.server_bans b left join public.profiles p on p.id = b.user_id
    where b.server_id = p_server order by b.banned_at desc;
end;
$$;

-- Quem foi banido não entra de novo por convite.
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
  if exists (select 1 from public.server_bans b where b.server_id = inv.server_id and b.user_id = uid) then
    raise exception 'banned';
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

revoke all on function public.kick_member(uuid, uuid), public.ban_member(uuid, uuid), public.unban_member(uuid, uuid), public.list_bans(uuid), private.remove_from_server(uuid, uuid, boolean) from public, anon;
grant execute on function public.kick_member(uuid, uuid), public.ban_member(uuid, uuid), public.unban_member(uuid, uuid), public.list_bans(uuid) to authenticated;
