-- SHIQI canonical friendship, DM, block, profile and settings RPCs
-- Exact pg_get_functiondef extraction from original project catalog.
-- Reference only: dependencies and ACLs must be reconciled before migration.
-- Music and QR functionality are intentionally excluded.

CREATE OR REPLACE FUNCTION public.block_user(p_other uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_other is null or p_other = me then raise exception 'cannot_add_self'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:block:limit:' || me::text, 0));
  if (select count(*) from public.blocks where blocker = me) >= 200 then raise exception 'too_many_requests'; end if;
  insert into public.blocks (blocker, blocked) values (me, p_other) on conflict do nothing;
  delete from public.friendships where user_a = least(me, p_other) and user_b = greatest(me, p_other);
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.change_username(p_username text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid(); u text := lower(btrim(coalesce(p_username, '')));
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if u !~ '^[a-z0-9._]{3,20}$' then raise exception 'invalid_username'; end if;
  if exists (select 1 from public.profiles p where lower(p.username) = u and p.id <> uid) then raise exception 'username_taken'; end if;
  update public.profiles set username = u where id = uid;
  return u;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.get_my_settings()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select p.settings from public.profiles p where p.id = auth.uid()), '{}'::jsonb);
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.my_age_group()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select case when p.birth_date is null then 'unknown'
                               when p.birth_date <= (current_date - interval '18 years')::date then 'adult'
                               else 'teen' end
                   from public.profiles p where p.id = auth.uid()), 'unknown');
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.open_dm(p_other uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := auth.uid(); ch uuid; cfg jsonb; v_allow boolean; v_noreq boolean; st text := 'active'; fr boolean;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_other is null or p_other = me then raise exception 'cannot_add_self'; end if;
  if exists (select 1 from public.blocks where (blocker = me and blocked = p_other) or (blocker = p_other and blocked = me)) then raise exception 'dm_closed'; end if;
  fr := exists (select 1 from public.friendships where user_a = least(me, p_other) and user_b = greatest(me, p_other) and status = 'accepted');
  if not fr then
    if not exists (select 1 from public.server_members a join public.server_members b on b.server_id = a.server_id where a.user_id = me and b.user_id = p_other) then
      raise exception 'not_friends';
    end if;
    select coalesce(settings, '{}'::jsonb) into cfg from public.profiles where id = p_other;
    select bool_or(q.ea), bool_or(q.ea and not q.er) into v_allow, v_noreq from (
      select coalesce((cfg->'dm_over'->(a.server_id::text)->>'allow')::boolean, coalesce((cfg->>'dm_allow')::boolean, true)) as ea,
             coalesce((cfg->'dm_over'->(a.server_id::text)->>'req')::boolean, coalesce((cfg->>'dm_requests')::boolean, true)) as er
      from public.server_members a join public.server_members b on b.server_id = a.server_id
      where a.user_id = me and b.user_id = p_other) q;
    if not coalesce(v_allow, false) then raise exception 'dm_closed'; end if;
    if not coalesce(v_noreq, false) then st := 'request'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext(least(me, p_other)::text || greatest(me, p_other)::text));
  select d1.channel_id into ch from public.dm_members d1 join public.dm_members d2 on d2.channel_id = d1.channel_id
    where d1.user_id = me and d2.user_id = p_other limit 1;
  if ch is null then
    insert into public.channels (server_id, name, kind) values (null, 'dm', 'dm') returning id into ch;
    insert into public.dm_members (channel_id, user_id, state) values (ch, me, 'active'), (ch, p_other, st);
  end if;
  return ch;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.profiles_full(p_ids uuid[])
 RETURNS TABLE(id uuid, bio text, status_text text, accent text, created_at timestamp with time zone, profile_updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (select (select auth.uid()) as uid)
  select p.id,
         case when q.full then p.bio else '' end,
         case when q.full then p.status_text else '' end,
         case when q.full then p.accent else '#9D8CCF' end,
         case when q.full then p.created_at else null end,
         case when q.full then p.profile_updated_at else null end
  from public.profiles p
  cross join me
  cross join lateral (
    select (p.id = me.uid) or (
      case coalesce(p.settings->>'profile_share', 'all')
        when 'friends' then fr.is_friend
        when 'small'   then fr.is_friend or sm.small
        else true
      end) as full
    from (select exists (select 1 from public.friendships f where f.status = 'accepted'
                          and f.user_a = least(me.uid, p.id) and f.user_b = greatest(me.uid, p.id)) as is_friend) fr,
         (select exists (select 1 from public.server_members a join public.server_members b on b.server_id = a.server_id
                          where a.user_id = me.uid and b.user_id = p.id
                            and (select count(*) from public.server_members x where x.server_id = a.server_id) <= 200) as small) sm
  ) q
  where p.id = any (p_ids[1:200])
    and (p.id = me.uid or (p.deactivated_at is null and private.shares_server_with(p.id)));
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.remove_friend(p_other uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  delete from public.friendships where user_a = least(me, p_other) and user_b = greatest(me, p_other);
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.respond_dm_request(p_channel uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_accept then
    update public.dm_members set state = 'active' where channel_id = p_channel and user_id = me and state = 'request';
  else
    delete from public.dm_members where channel_id = p_channel and user_id = me and state = 'request';
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'no_request'; end if;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.respond_friend_request(p_other uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := auth.uid(); a uuid; b uuid; n int; nt text; ch uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  a := least(me, p_other); b := greatest(me, p_other);
  if p_accept then
    update public.friendships set status = 'accepted' where user_a = a and user_b = b and status = 'pending' and requester = p_other returning note into nt;
    get diagnostics n = row_count;
    if n > 0 and nt is not null and btrim(nt) <> '' then
      perform pg_advisory_xact_lock(hashtext(a::text || b::text));
      select d1.channel_id into ch from public.dm_members d1 join public.dm_members d2 on d2.channel_id = d1.channel_id
        where d1.user_id = me and d2.user_id = p_other limit 1;
      if ch is null then
        insert into public.channels (server_id, name, kind) values (null, 'dm', 'dm') returning id into ch;
        insert into public.dm_members (channel_id, user_id) values (ch, me), (ch, p_other);
      end if;
      insert into public.messages (channel_id, author_id, content) values (ch, p_other, nt);
    end if;
  else
    delete from public.friendships where user_a = a and user_b = b and status = 'pending' and requester = p_other;
    get diagnostics n = row_count;
  end if;
  if n = 0 then raise exception 'no_request'; end if;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.save_my_settings(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 6000 then raise exception 'invalid_settings'; end if;
  update public.profiles set settings = p where id = auth.uid();
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.send_friend_request(p_username text, p_note text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r text; me uuid := auth.uid(); other uuid; nt text := nullif(btrim(coalesce(p_note, '')), '');
begin
  r := public.send_friend_request(p_username);
  if r = 'pending' and nt is not null then
    select id into other from public.profiles where lower(username) = lower(regexp_replace(btrim(coalesce(p_username, '')), '^@', ''));
    update public.friendships set note = left(nt, 120)
      where user_a = least(me, other) and user_b = greatest(me, other) and requester = me and status = 'pending';
  end if;
  return r;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.send_friend_request(p_username text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := auth.uid(); other uuid; a uuid; b uuid; cur record; st jsonb; ok boolean;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select id into other from public.profiles where lower(username) = lower(regexp_replace(btrim(coalesce(p_username, '')), '^@', ''));
  if other is null then raise exception 'user_not_found'; end if;
  if other = me then raise exception 'cannot_add_self'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:friend-request:limit:' || me::text, 0));
  if exists (select 1 from public.blocks where blocker = me and blocked = other) then raise exception 'you_blocked'; end if;
  if exists (select 1 from public.blocks where blocker = other and blocked = me) then raise exception 'user_not_found'; end if;
  a := least(me, other); b := greatest(me, other);
  select * into cur from public.friendships where user_a = a and user_b = b;
  if found then
    if cur.status = 'accepted' then return 'friends'; end if;
    if cur.requester = me then return 'pending'; end if;
    update public.friendships set status = 'accepted' where user_a = a and user_b = b;
    return 'accepted';
  end if;
  select coalesce(settings, '{}'::jsonb) into st from public.profiles where id = other;
  if coalesce((st->>'fr_all')::boolean, true) = false then
    ok := (coalesce((st->>'fr_fof')::boolean, true) and exists (
            select 1 from public.friendships f1 join public.friendships f2
              on f2.status = 'accepted' and f1.status = 'accepted'
             and (case when f1.user_a = me then f1.user_b else f1.user_a end) = (case when f2.user_a = other then f2.user_b else f2.user_a end)
            where me in (f1.user_a, f1.user_b) and other in (f2.user_a, f2.user_b)))
       or (coalesce((st->>'fr_server')::boolean, true) and exists (
            select 1 from public.server_members m1 join public.server_members m2 on m2.server_id = m1.server_id
            where m1.user_id = me and m2.user_id = other));
    if not ok then raise exception 'requests_closed'; end if;
  end if;
  if (select count(*) from public.friendships where requester = me and status = 'pending') >= 30 then raise exception 'too_many_requests'; end if;
  insert into public.friendships (user_a, user_b, requester) values (a, b, me);
  return 'pending';
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.set_my_presence(p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_status not in ('online','idle','dnd','invisible') then raise exception 'invalid_status'; end if;
  update public.profiles set presence = p_status where id = auth.uid();
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.unblock_user(p_other uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  delete from public.blocks where blocker = me and blocked = p_other;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.unsubscribe_marketing()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.profiles set marketing_opt_in = false where id = auth.uid();
end $function$

