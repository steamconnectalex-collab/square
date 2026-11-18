-- Square. — amigos e mensagens diretas (migração 0005).
-- Conversa 1 a 1 = um "canal" do tipo 'dm' sem servidor; só os dois membros (dm_members) enxergam e escrevem.
-- Assim o chat que já existe (histórico, tempo real, editar/apagar) funciona igual.

alter table public.channels alter column server_id drop not null;
alter table public.channels drop constraint if exists channels_kind_check;
alter table public.channels add constraint channels_kind_check check (kind in ('text', 'voice', 'dm'));
alter table public.channels drop constraint if exists channels_dm_shape;
alter table public.channels add constraint channels_dm_shape check ((kind = 'dm') = (server_id is null));

create table if not exists public.dm_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (channel_id, user_id)
);
create index if not exists dm_members_user_idx on public.dm_members(user_id);

create table if not exists public.friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  requester uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requester = user_a or requester = user_b)
);
create index if not exists friendships_b_idx on public.friendships(user_b);

alter table public.dm_members enable row level security;
alter table public.friendships enable row level security;
revoke all on public.dm_members, public.friendships from anon, authenticated;
grant select on public.dm_members, public.friendships to authenticated;

-- ---------- funções auxiliares (schema private, não expostas na API) ----------
create or replace function private.is_dm_member(p_channel uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.dm_members d where d.channel_id = p_channel and d.user_id = (select auth.uid()))
$$;

create or replace function private.is_channel_member(p_channel uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.channels c
    join public.server_members m on m.server_id = c.server_id
    where c.id = p_channel and m.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.dm_members d where d.channel_id = p_channel and d.user_id = (select auth.uid())
  )
$$;

-- Escrever: canal de texto de servidor onde sou membro, ou conversa privada com alguém que ainda é meu amigo.
create or replace function private.can_post(p_channel uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.channels c
    join public.server_members m on m.server_id = c.server_id
    where c.id = p_channel and c.kind = 'text' and m.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.dm_members d1
    join public.dm_members d2 on d2.channel_id = d1.channel_id and d2.user_id <> d1.user_id
    join public.friendships f on f.status = 'accepted'
      and f.user_a = least(d1.user_id, d2.user_id) and f.user_b = greatest(d1.user_id, d2.user_id)
    where d1.channel_id = p_channel and d1.user_id = (select auth.uid())
  )
$$;

-- Ver o perfil de quem divide servidor comigo ou tem pedido/amizade comigo.
create or replace function private.shares_server_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.server_members a
    join public.server_members b on b.server_id = a.server_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  ) or exists (
    select 1 from public.friendships f
    where f.user_a = least((select auth.uid()), p_user) and f.user_b = greatest((select auth.uid()), p_user)
  )
$$;

-- ---------- regras de acesso ----------
drop policy if exists channels_select_member on public.channels;
create policy channels_select_member on public.channels for select to authenticated
  using (public.is_server_member(server_id) or private.is_dm_member(id));

drop policy if exists dm_members_select on public.dm_members;
create policy dm_members_select on public.dm_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_dm_member(channel_id));

drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own on public.friendships for select to authenticated
  using ((select auth.uid()) = user_a or (select auth.uid()) = user_b);

-- ---------- funções chamadas pelo site ----------
-- Pede amizade pelo @usuário. Se a outra pessoa já tinha pedido a você, vira amizade na hora.
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

-- Aceita ou recusa um pedido que a outra pessoa mandou para você.
create or replace function public.respond_friend_request(p_other uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); a uuid; b uuid; n int;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  a := least(me, p_other); b := greatest(me, p_other);
  if p_accept then
    update public.friendships set status = 'accepted' where user_a = a and user_b = b and status = 'pending' and requester = p_other;
  else
    delete from public.friendships where user_a = a and user_b = b and status = 'pending' and requester = p_other;
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'no_request'; end if;
end $$;

-- Remove um amigo ou cancela um pedido (o histórico da conversa fica guardado, mas ninguém escreve mais).
create or replace function public.remove_friend(p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  delete from public.friendships where user_a = least(me, p_other) and user_b = greatest(me, p_other);
end $$;

-- Abre (ou cria) a conversa privada com um amigo. Devolve o id do canal.
create or replace function public.open_dm(p_other uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); ch uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.friendships where user_a = least(me, p_other) and user_b = greatest(me, p_other) and status = 'accepted') then
    raise exception 'not_friends';
  end if;
  perform pg_advisory_xact_lock(hashtext(least(me, p_other)::text || greatest(me, p_other)::text));
  select d1.channel_id into ch from public.dm_members d1
    join public.dm_members d2 on d2.channel_id = d1.channel_id
    where d1.user_id = me and d2.user_id = p_other limit 1;
  if ch is null then
    insert into public.channels (server_id, name, kind) values (null, 'dm', 'dm') returning id into ch;
    insert into public.dm_members (channel_id, user_id) values (ch, me), (ch, p_other);
  end if;
  return ch;
end $$;

revoke all on function public.send_friend_request(text), public.respond_friend_request(uuid, boolean), public.remove_friend(uuid), public.open_dm(uuid) from public, anon;
grant execute on function public.send_friend_request(text), public.respond_friend_request(uuid, boolean), public.remove_friend(uuid), public.open_dm(uuid) to authenticated;

-- Pedidos de amizade chegam em tempo real (RLS continua valendo: cada um só recebe os seus).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;
