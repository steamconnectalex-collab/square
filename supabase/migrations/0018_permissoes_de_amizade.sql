-- Respeita "Permissões de pedido de amizade" (profiles.settings: fr_all, fr_fof, fr_server; padrão = tudo liberado).
-- Se a pessoa desligou "Todos", só recebe pedido de quem tem amigo em comum (fr_fof) ou servidor em comum (fr_server).
create or replace function public.send_friend_request(p_username text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); other uuid; a uuid; b uuid; cur record; st jsonb; ok boolean;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select id into other from public.profiles where lower(username) = lower(regexp_replace(btrim(coalesce(p_username, '')), '^@', ''));
  if other is null then raise exception 'user_not_found'; end if;
  if other = me then raise exception 'cannot_add_self'; end if;
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
end $$;
