-- SHIQI canonical moderation, reactions, events, voice and discovery RPCs
-- Exact pg_get_functiondef extraction from original project catalog.
-- Reference only; verify signatures, ACLs, dependencies and frontend parity before migration.
-- QR and music are intentionally excluded.

CREATE OR REPLACE FUNCTION public.ban_member(p_server uuid, p_user uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.remove_from_server(p_server, p_user, true) $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.create_event(p_server uuid, p_title text, p_description text, p_place text, p_starts timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := auth.uid(); eid uuid; t text := btrim(coalesce(p_title, ''));
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.servers s where s.id = p_server and s.owner_id = me) then raise exception 'not_owner'; end if;
  if char_length(t) < 2 or char_length(t) > 80 then raise exception 'invalid_title'; end if;
  if p_starts is null or p_starts < now() - interval '5 minutes' then raise exception 'past_date'; end if;
  if (select count(*) from public.server_events e where e.server_id = p_server and e.starts_at > now()) >= 25 then raise exception 'too_many_events'; end if;
  insert into public.server_events (server_id, creator_id, title, description, place, starts_at)
  values (p_server, me, t, left(btrim(coalesce(p_description, '')), 500), left(btrim(coalesce(p_place, '')), 80), p_starts) returning id into eid;
  return eid;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.delete_event(p_event uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  delete from public.server_events e using public.servers s where e.id = p_event and s.id = e.server_id and s.owner_id = auth.uid();
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.featured_servers()
 RETURNS TABLE(id uuid, name text, level integer, members integer, joined boolean, until_ts timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  win bigint := floor(extract(epoch from now()) / 172800)::bigint;  -- janela de 48 h
  total integer; pages integer; pg integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select count(*) into total from public.servers s
   where s.is_public and s.level >= 3
     and not exists (select 1 from public.server_bans b where b.server_id = s.id and b.user_id = uid);
  if total = 0 then return; end if;
  pages := greatest(1, ceil(total / 4.0)::integer);
  pg := (win % pages)::integer;
  return query
    select r.id, r.name, r.level, r.members, r.joined, to_timestamp((win + 1) * 172800.0)
    from (
      select s.id, s.name, s.level,
             (select count(*)::integer from public.server_members m where m.server_id = s.id) as members,
             exists (select 1 from public.server_members m where m.server_id = s.id and m.user_id = uid) as joined,
             row_number() over (order by md5(s.id::text)) as rn
      from public.servers s
      where s.is_public and s.level >= 3
        and not exists (select 1 from public.server_bans b where b.server_id = s.id and b.user_id = uid)
    ) r
    where r.rn > pg * 4 and r.rn <= pg * 4 + 4
    order by r.rn;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.kick_member(p_server uuid, p_user uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.remove_from_server(p_server, p_user, false) $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.list_bans(p_server uuid)
 RETURNS TABLE(user_id uuid, username text, display_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.servers s where s.id = p_server and s.owner_id = (select auth.uid())) then raise exception 'not_owner'; end if;
  return query select b.user_id, p.username::text, p.display_name::text
    from public.server_bans b left join public.profiles p on p.id = b.user_id
    where b.server_id = p_server order by b.banned_at desc;
end;
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.list_public_servers()
 RETURNS TABLE(id uuid, name text, members integer, joined boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  return query
    select s.id, s.name,
           (select count(*)::integer from public.server_members m where m.server_id = s.id),
           exists (select 1 from public.server_members m where m.server_id = s.id and m.user_id = uid)
    from public.servers s
    where s.is_public and not exists (select 1 from public.server_bans b where b.server_id = s.id and b.user_id = uid)
    order by 3 desc, s.created_at asc
    limit 50;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.my_plan()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select p.plan from public.profiles p where p.id = auth.uid()), 'free');
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.pin_server(p_server uuid, p_pin boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not coalesce(p_pin, false) then
    delete from public.server_pins where user_id = uid and server_id = p_server;
    return;
  end if;
  if not exists (select 1 from public.server_members m where m.server_id = p_server and m.user_id = uid) then raise exception 'not_member'; end if;
  if exists (select 1 from public.server_pins p where p.user_id = uid and p.server_id = p_server) then return; end if;
  if (select count(*) from public.server_pins p join public.server_members m on m.server_id = p.server_id and m.user_id = p.user_id where p.user_id = uid) >= 4 then
    raise exception 'too_many_pins';
  end if;
  insert into public.server_pins (user_id, server_id) values (uid, p_server);
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.set_server_public(p_server uuid, p_public boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.servers s where s.id = p_server and s.owner_id = uid) then raise exception 'not_owner'; end if;
  update public.servers set is_public = coalesce(p_public, false) where id = p_server;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.toggle_event_interest(p_event uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.server_events e join public.server_members sm on sm.server_id = e.server_id where e.id = p_event and sm.user_id = me) then raise exception 'not_member'; end if;
  delete from public.event_interest where event_id = p_event and user_id = me;
  get diagnostics n = row_count;
  if n > 0 then return false; end if;
  insert into public.event_interest (event_id, user_id) values (p_event, me);
  return true;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.toggle_reaction(p_message bigint, p_emoji text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := auth.uid(); ch uuid; n int; e text := btrim(coalesce(p_emoji, ''));
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if char_length(e) < 1 or char_length(e) > 16 then raise exception 'invalid_emoji'; end if;
  select channel_id into ch from public.messages where id = p_message;
  if ch is null or not private.can_post(ch) then raise exception 'not_member'; end if;
  delete from public.message_reactions where message_id = p_message and user_id = me and emoji = e;
  get diagnostics n = row_count;
  if n > 0 then return false; end if;
  if (select count(distinct emoji) from public.message_reactions where message_id = p_message) >= 20 then raise exception 'too_many_reactions'; end if;
  insert into public.message_reactions (message_id, user_id, emoji) values (p_message, me, e);
  return true;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.unban_member(p_server uuid, p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.servers s where s.id = p_server and s.owner_id = (select auth.uid())) then raise exception 'not_owner'; end if;
  delete from public.server_bans where server_id = p_server and user_id = p_user;
end;
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.voice_join(p_channel uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.channels c join public.server_members m on m.server_id = c.server_id
                 where c.id = p_channel and c.kind = 'voice' and m.user_id = uid) then
    raise exception 'not_member';
  end if;
  delete from public.voice_members where channel_id = p_channel and seen_at < now() - interval '45 seconds';
  delete from public.voice_members where user_id = uid and channel_id <> p_channel;
  select count(*) into n from public.voice_members where channel_id = p_channel and user_id <> uid;
  if n >= 6 then raise exception 'voice_full'; end if;
  insert into public.voice_members (channel_id, user_id) values (p_channel, uid)
  on conflict (channel_id, user_id) do update set seen_at = now(), muted = false, deafened = false, video = false, screen = false;
end;
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.voice_leave()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  delete from public.voice_members where user_id = (select auth.uid());
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.voice_ping(p_channel uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.voice_members set seen_at = now() where channel_id = p_channel and user_id = (select auth.uid());
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.voice_set_state(p_muted boolean, p_deafened boolean, p_video boolean, p_screen boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  update public.voice_members
     set muted = coalesce(p_muted, false) or coalesce(p_deafened, false),
         deafened = coalesce(p_deafened, false),
         video = coalesce(p_video, false),
         screen = coalesce(p_screen, false),
         seen_at = now()
   where user_id = uid;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'not_in_voice'; end if;
end $function$

