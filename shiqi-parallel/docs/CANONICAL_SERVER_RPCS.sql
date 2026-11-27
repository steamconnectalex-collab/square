-- SHIQI — RPCs de servidores/canais/convites extraídas do PostgreSQL original.
-- Referência SQL; tabelas, helpers e extensão pgcrypto/namespace extensions devem existir.

create or replace function public.create_server(p_name text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := (select auth.uid());
  nm text := btrim(coalesce(p_name, ''));
  sid uuid;
  n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(nm) < 2 or char_length(nm) > 40 then raise exception 'invalid_name'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:server:create:' || uid::text, 0));
  select count(*) into n from public.servers where owner_id = uid;
  if n >= 10 then raise exception 'too_many_servers'; end if;
  insert into public.servers (name, owner_id) values (nm, uid) returning id into sid;
  insert into public.server_members (server_id, user_id, role) values (sid, uid, 'owner');
  insert into public.channels (server_id, name, kind, position)
    values (sid, 'Geral', 'text', 0), (sid, 'Sala principal', 'voice', 1);
  return sid;
end;
$function$;

create or replace function public.create_channel(p_server uuid, p_name text, p_kind text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:channel:create:' || p_server::text, 0));
  select count(*), coalesce(max(position), -1) + 1 into n, pos
  from public.channels where server_id = p_server;
  if n >= 30 then raise exception 'too_many_channels'; end if;
  insert into public.channels (server_id, name, kind, position)
  values (p_server, nm, p_kind, pos) returning id into cid;
  return cid;
end;
$function$;

create or replace function public.create_invite(p_server uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  c text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.server_members m where m.server_id = p_server and m.user_id = uid
  ) then raise exception 'not_member'; end if;
  c := encode(extensions.gen_random_bytes(5), 'hex');
  insert into public.server_invites (code, server_id, created_by) values (c, p_server, uid);
  return c;
end;
$function$;

create or replace function public.join_public_server(p_server uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.servers s where s.id = p_server and s.is_public) then
    raise exception 'invalid_invite';
  end if;
  if exists (select 1 from public.server_bans b where b.server_id = p_server and b.user_id = uid) then
    raise exception 'banned';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:membership:limit:' || uid::text, 0));
  if exists (select 1 from public.server_members m where m.server_id = p_server and m.user_id = uid) then
    return p_server;
  end if;
  select count(*) into n from public.server_members where user_id = uid;
  if n >= 20 then raise exception 'too_many_servers'; end if;
  insert into public.server_members (server_id, user_id, role)
  values (p_server, uid, 'member') on conflict do nothing;
  return p_server;
end;
$function$;

create or replace function public.join_server(p_code text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  inv public.server_invites%rowtype;
  n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into inv from public.server_invites
  where code = lower(btrim(coalesce(p_code, ''))) for update;
  if not found or inv.expires_at < now() or inv.uses >= inv.max_uses then
    raise exception 'invalid_invite';
  end if;
  if exists (select 1 from public.server_bans b where b.server_id = inv.server_id and b.user_id = uid) then
    raise exception 'banned';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:membership:limit:' || uid::text, 0));
  if exists (select 1 from public.server_members m where m.server_id = inv.server_id and m.user_id = uid) then
    return inv.server_id;
  end if;
  select count(*) into n from public.server_members where user_id = uid;
  if n >= 20 then raise exception 'too_many_servers'; end if;
  insert into public.server_members (server_id, user_id, role)
  values (inv.server_id, uid, 'member') on conflict do nothing;
  update public.server_invites set uses = uses + 1 where code = inv.code;
  return inv.server_id;
end;
$function$;
