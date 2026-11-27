-- SHIQI canonical auth/account lifecycle and remaining utility RPCs
-- Exact pg_get_functiondef extraction from original project catalog.
-- Reference only; auth Edge Function contracts, ACLs and dependencies must be reconciled.

CREATE OR REPLACE FUNCTION public.get_auth_user_by_email(p_email text)
 RETURNS TABLE(id uuid, email_confirmed boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select u.id, (u.email_confirmed_at is not null)
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.get_login_email_by_username(p_username text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(p_username)
  limit 1
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.purge_user_data(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s record; nxt uuid;
begin
  for s in select id from public.servers where owner_id = p_user loop
    select user_id into nxt from public.server_members where server_id = s.id and user_id <> p_user order by joined_at limit 1;
    if nxt is null then delete from public.servers where id = s.id;
    else update public.servers set owner_id = nxt where id = s.id; end if;
  end loop;
end $function$


-- ========================================

CREATE OR REPLACE FUNCTION public.rate_check(p_key text, p_limit integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  n integer;
begin
  delete from public.rate_hits
  where key = p_key and at < now() - make_interval(secs => p_window_seconds);

  if random() < 0.02 then
    delete from public.rate_hits where at < now() - interval '1 day';
  end if;

  select count(*) into n from public.rate_hits where key = p_key;
  if n >= p_limit then
    return false;
  end if;

  insert into public.rate_hits (key) values (p_key);
  return true;
end;
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.reactivate_account()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.profiles set deactivated_at = null where id = (select auth.uid()) and deactivated_at is not null;
$function$


-- ========================================

CREATE OR REPLACE FUNCTION public.revoke_user_sessions(p_user uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  delete from auth.sessions where user_id = p_user;
$function$


-- ========================================


CREATE OR REPLACE FUNCTION public.verify_email_code(p_email text, p_purpose text, p_hash text, p_max_attempts integer DEFAULT 5)
 RETURNS TABLE(status text, attempts_left integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.email_codes%rowtype;
begin
  select * into r
  from public.email_codes
  where email = p_email
    and purpose = p_purpose
    and consumed_at is null
  order by created_at desc
  limit 1
  for update;

  if not found or r.expires_at < now() then
    return query select 'expired'::text, 0;
    return;
  end if;

  if r.attempts >= p_max_attempts then
    return query select 'locked'::text, 0;
    return;
  end if;

  if r.code_hash = p_hash then
    update public.email_codes set consumed_at = now() where id = r.id;
    return query select 'ok'::text, p_max_attempts - r.attempts;
    return;
  end if;

  update public.email_codes set attempts = attempts + 1 where id = r.id;
  return query select 'wrong'::text, greatest(p_max_attempts - r.attempts - 1, 0);
end;
$function$

