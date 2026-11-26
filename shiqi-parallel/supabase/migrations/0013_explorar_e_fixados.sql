-- Square. — Explorar servidores públicos e servidores fixados (migração 0013).
-- Servidor público aparece em "Explorar" e qualquer pessoa logada pode entrar (banidos não). Fixados: até 4 por pessoa (plano grátis).
alter table public.servers add column if not exists is_public boolean not null default false;
grant select (is_public) on public.servers to authenticated;

create table if not exists public.server_pins (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  server_id uuid not null references public.servers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, server_id)
);
alter table public.server_pins enable row level security;
revoke all on public.server_pins from anon, authenticated;
grant select on public.server_pins to authenticated;
drop policy if exists pins_select_own on public.server_pins;
create policy pins_select_own on public.server_pins for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.pin_server(p_server uuid, p_pin boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not coalesce(p_pin, false) then
    delete from public.server_pins where user_id = uid and server_id = p_server;
    return;
  end if;
  if not exists (select 1 from public.server_members m where m.server_id = p_server and m.user_id = uid) then raise exception 'not_member'; end if;
  if exists (select 1 from public.server_pins p where p.user_id = uid and p.server_id = p_server) then return; end if;
  -- só conta fixados de servidores em que a pessoa ainda está
  if (select count(*) from public.server_pins p join public.server_members m on m.server_id = p.server_id and m.user_id = p.user_id where p.user_id = uid) >= 4 then
    raise exception 'too_many_pins';
  end if;
  insert into public.server_pins (user_id, server_id) values (uid, p_server);
end $$;

create or replace function public.set_server_public(p_server uuid, p_public boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.servers s where s.id = p_server and s.owner_id = uid) then raise exception 'not_owner'; end if;
  update public.servers set is_public = coalesce(p_public, false) where id = p_server;
end $$;

create or replace function public.list_public_servers() returns table (id uuid, name text, members integer, joined boolean)
language plpgsql security definer set search_path = '' as $$
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
end $$;

create or replace function public.join_public_server(p_server uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.servers s where s.id = p_server and s.is_public) then raise exception 'invalid_invite'; end if;
  if exists (select 1 from public.server_bans b where b.server_id = p_server and b.user_id = uid) then raise exception 'banned'; end if;
  if exists (select 1 from public.server_members m where m.server_id = p_server and m.user_id = uid) then return p_server; end if;
  select count(*) into n from public.server_members where user_id = uid;
  if n >= 20 then raise exception 'too_many_servers'; end if;
  insert into public.server_members (server_id, user_id, role) values (p_server, uid, 'member') on conflict do nothing;
  return p_server;
end $$;

revoke all on function public.pin_server(uuid, boolean), public.set_server_public(uuid, boolean), public.list_public_servers(), public.join_public_server(uuid) from public, anon;
grant execute on function public.pin_server(uuid, boolean), public.set_server_public(uuid, boolean), public.list_public_servers(), public.join_public_server(uuid) to authenticated;
