-- Square. — bloquear usuários (migração 0006).
-- Bloquear desfaz a amizade e impede novos pedidos nos dois sentidos. As mensagens da pessoa bloqueada
-- são escondidas no site (filtro no navegador).
create table if not exists public.blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;
drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks for select to authenticated using (blocker = (select auth.uid()));

create or replace function public.block_user(p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_other is null or p_other = me then raise exception 'cannot_add_self'; end if;
  if (select count(*) from public.blocks where blocker = me) >= 200 then raise exception 'too_many_requests'; end if;
  insert into public.blocks (blocker, blocked) values (me, p_other) on conflict do nothing;
  delete from public.friendships where user_a = least(me, p_other) and user_b = greatest(me, p_other);
end $$;

create or replace function public.unblock_user(p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  delete from public.blocks where blocker = me and blocked = p_other;
end $$;

-- Pedido de amizade: recusa se houver bloqueio (quem foi bloqueado não descobre: recebe "usuário não encontrado").
create or replace function public.send_friend_request(p_username text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  a uuid; b uuid;
  cur record;
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
  if (select count(*) from public.friendships where requester = me and status = 'pending') >= 30 then raise exception 'too_many_requests'; end if;
  insert into public.friendships (user_a, user_b, requester) values (a, b, me);
  return 'pending';
end $$;

revoke all on function public.block_user(uuid), public.unblock_user(uuid), public.send_friend_request(text) from public, anon;
grant execute on function public.block_user(uuid), public.unblock_user(uuid), public.send_friend_request(text) to authenticated;
