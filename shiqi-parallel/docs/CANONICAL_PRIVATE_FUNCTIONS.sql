-- SHIQI — helpers privados extraídos do catálogo PostgreSQL original.
-- Referência SQL. Criar schema private e tabelas antes; grants e triggers em arquivos próprios.
-- SECURITY DEFINER com search_path vazio, conforme catálogo original.

create schema if not exists private;

create or replace function private.accept_on_reply()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.dm_members set state = 'active'
  where channel_id = new.channel_id and user_id = new.author_id and state = 'request';
  return new;
end
$function$;

create or replace function private.can_post(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.channels c
    join public.server_members m on m.server_id = c.server_id
    where c.id = p_channel and c.kind = 'text' and m.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.dm_members d1
    join public.dm_members d2 on d2.channel_id = d1.channel_id and d2.user_id <> d1.user_id
    where d1.channel_id = p_channel and d1.user_id = (select auth.uid())
      and private.dm_allowed(d1.user_id, d2.user_id)
  )
$function$;

create or replace function private.can_voice_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_topic !~ '^voice:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return exists (
    select 1 from public.channels c
    join public.server_members m on m.server_id = c.server_id
    where c.id = substring(p_topic from 7)::uuid and c.kind = 'voice'
      and m.user_id = (select auth.uid())
  );
end;
$function$;

create or replace function private.check_thread_parent()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare pc uuid; pt bigint;
begin
  if new.thread_of is null then return new; end if;
  select channel_id, thread_of into pc, pt from public.messages where id = new.thread_of;
  if pc is null or pc <> new.channel_id or pt is not null then raise exception 'invalid_thread'; end if;
  return new;
end
$function$;

create or replace function private.dm_allowed(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select not exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  ) and (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted' and f.user_a = least(a, b) and f.user_b = greatest(a, b)
    ) or exists (
      select 1 from public.server_members x
      join public.server_members y on y.server_id = x.server_id
      where x.user_id = a and y.user_id = b
    )
  )
$function$;

create or replace function private.is_channel_member(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.channels c
    join public.server_members m on m.server_id = c.server_id
    where c.id = p_channel and m.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.dm_members d
    where d.channel_id = p_channel and d.user_id = (select auth.uid())
  )
$function$;

create or replace function private.is_channel_owner(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.channels c
    join public.servers s on s.id = c.server_id
    where c.id = p_channel and s.owner_id = (select auth.uid())
  )
$function$;

create or replace function private.is_dm_member(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.dm_members d
    where d.channel_id = p_channel and d.user_id = (select auth.uid())
  )
$function$;

create or replace function private.messages_rate_limit()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select count(*) from public.messages
      where author_id = new.author_id and created_at > now() - interval '5 seconds') >= 5
     or (select count(*) from public.messages
         where author_id = new.author_id and created_at > now() - interval '60 seconds') >= 40 then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$function$;

create or replace function private.remove_from_server(p_server uuid, p_user uuid, p_ban boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.servers s where s.id = p_server and s.owner_id = uid) then raise exception 'not_owner'; end if;
  if p_user = uid then raise exception 'cannot_remove_self'; end if;
  delete from public.server_members where server_id = p_server and user_id = p_user;
  delete from public.voice_members
  where user_id = p_user and channel_id in (select id from public.channels where server_id = p_server);
  if p_ban then
    insert into public.server_bans (server_id, user_id)
    values (p_server, p_user) on conflict do nothing;
  end if;
end;
$function$;

create or replace function private.shares_server_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.server_members a
    join public.server_members b on b.server_id = a.server_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  ) or exists (
    select 1 from public.friendships f
    where f.user_a = least((select auth.uid()), p_user)
      and f.user_b = greatest((select auth.uid()), p_user)
  )
$function$;

create or replace function private.touch_edited_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.content is distinct from old.content then new.edited_at := now(); end if;
  return new;
end;
$function$;

create or replace function private.touch_profile()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (new.bio is distinct from old.bio or new.display_name is distinct from old.display_name
      or new.avatar_path is distinct from old.avatar_path or new.accent is distinct from old.accent
      or new.status_text is distinct from old.status_text)
     and coalesce((new.settings->>'share_profile_update')::boolean, true) then
    new.profile_updated_at := now();
  end if;
  return new;
end
$function$;
