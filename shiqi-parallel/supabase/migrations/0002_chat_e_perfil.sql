-- Square. — mensagens de chat e campos de perfil (migração 0002).
-- Antes desta: 0001 (acesso à conta) e "servidores_e_canais" (tabelas servers, server_members,
-- channels + funções create_server / is_server_member; já estavam no banco, resumo no fim deste arquivo).
-- Segurança: RLS em tudo; funções auxiliares ficam no schema "private" (não aparecem na API).

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------- perfil: novos campos que o usuário edita ----------
alter table public.profiles
  add column if not exists bio text not null default '' check (char_length(bio) <= 190),
  add column if not exists status_text text not null default '' check (char_length(status_text) <= 60),
  add column if not exists avatar_path text check (avatar_path is null or char_length(avatar_path) <= 200),
  add column if not exists accent text not null default '#9D8CCF' check (accent ~ '^#[0-9A-Fa-f]{6}$');

-- Só colunas "públicas" ficam legíveis pelo navegador. birth_date e marketing_opt_in continuam privados.
revoke select, update on public.profiles from authenticated;
grant select (id, username, display_name, bio, status_text, avatar_path, accent, created_at) on public.profiles to authenticated;
grant update (display_name, bio, status_text, avatar_path, accent) on public.profiles to authenticated;

-- ---------- funções auxiliares (schema private) ----------
create or replace function private.shares_server_with(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.server_members a
    join public.server_members b on b.server_id = a.server_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  )
$$;

create or replace function private.is_channel_member(p_channel uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.channels c
    join public.server_members m on m.server_id = c.server_id
    where c.id = p_channel and m.user_id = (select auth.uid())
  )
$$;

create or replace function private.can_post(p_channel uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.channels c
    join public.server_members m on m.server_id = c.server_id
    where c.id = p_channel and c.kind = 'text' and m.user_id = (select auth.uid())
  )
$$;

create or replace function private.is_channel_owner(p_channel uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.channels c
    join public.servers s on s.id = c.server_id
    where c.id = p_channel and s.owner_id = (select auth.uid())
  )
$$;

revoke all on function private.shares_server_with(uuid), private.is_channel_member(uuid),
  private.can_post(uuid), private.is_channel_owner(uuid) from public, anon;
grant execute on function private.shares_server_with(uuid), private.is_channel_member(uuid),
  private.can_post(uuid), private.is_channel_owner(uuid) to authenticated;

-- ---------- perfis: ver o próprio e o de quem divide servidor com você ----------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_visible on public.profiles for select to authenticated
  using ((select auth.uid()) = id or private.shares_server_with(id));

-- ---------- mensagens ----------
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists messages_channel_created_idx on public.messages (channel_id, created_at desc);
create index if not exists messages_author_idx on public.messages (author_id);
alter table public.messages enable row level security;

revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (channel_id, content) on public.messages to authenticated;
grant update (content) on public.messages to authenticated;
grant delete on public.messages to authenticated;
grant all on public.messages to service_role;

create policy messages_select_member on public.messages for select to authenticated
  using (private.is_channel_member(channel_id));
create policy messages_insert_member on public.messages for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_post(channel_id));
create policy messages_update_own on public.messages for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()) and private.can_post(channel_id));
create policy messages_delete_own_or_owner on public.messages for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_channel_owner(channel_id));

create or replace function private.touch_edited_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.content is distinct from old.content then new.edited_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists messages_touch_edited on public.messages;
create trigger messages_touch_edited before update on public.messages
  for each row execute function private.touch_edited_at();

-- mensagens novas chegam em tempo real (o Realtime respeita as regras de RLS acima)
alter publication supabase_realtime add table public.messages;

-- ---------- resumo do que já existia ("servidores_e_canais") ----------
-- servers(id, name 2-40, owner_id, created_at)              select: só membros (is_server_member)
-- server_members(server_id, user_id, role owner|member)     select: só membros
-- channels(id, server_id, name 1-30, kind text|voice, position)  select: só membros
-- create_server(p_name) -> uuid : cria servidor + vínculo de dono + canais "Geral" (texto) e "Sala principal" (voz); limite de 10 por dono.
