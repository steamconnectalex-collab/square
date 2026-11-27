-- SHIQI — policies RLS canônicas extraídas de pg_policies do projeto original.
-- Referência para reconstrução; NÃO executar antes de criar as funções private usadas abaixo.
-- Todas as policies encontradas são PERMISSIVE e TO authenticated.
-- Tabelas internas email_codes, rate_hits, server_invites, server_bans e mfa_recovery
-- não possuem policies públicas no original.

alter table public.profiles enable row level security;
alter table public.servers enable row level security;
alter table public.server_members enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.server_invites enable row level security;
alter table public.dm_members enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.voice_members enable row level security;
alter table public.server_bans enable row level security;
alter table public.server_pins enable row level security;
alter table public.email_codes enable row level security;
alter table public.rate_hits enable row level security;
alter table public.mfa_recovery enable row level security;
alter table public.message_reactions enable row level security;
alter table public.server_events enable row level security;
alter table public.event_interest enable row level security;

create policy profiles_select_visible on public.profiles
for select to authenticated
using ((select auth.uid()) = id or (deactivated_at is null and private.shares_server_with(id)));

create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy servers_select_member on public.servers
for select to authenticated
using (public.is_server_member(id));

create policy server_members_select_member on public.server_members
for select to authenticated
using (public.is_server_member(server_id));

create policy channels_select_member on public.channels
for select to authenticated
using (public.is_server_member(server_id) or private.is_dm_member(id));

create policy messages_select_member on public.messages
for select to authenticated
using (private.is_channel_member(channel_id));

create policy messages_insert_member on public.messages
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and private.can_post(channel_id)
  and (attachment_path is null or (
    split_part(attachment_path, '/', 1) = (select auth.uid())::text
    and split_part(attachment_path, '/', 2) <> ''
  ))
);

create policy messages_update_own on public.messages
for update to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()) and private.can_post(channel_id));

create policy messages_delete_own_or_owner on public.messages
for delete to authenticated
using (author_id = (select auth.uid()) or private.is_channel_owner(channel_id));

create policy friendships_select_own on public.friendships
for select to authenticated
using ((select auth.uid()) = user_a or (select auth.uid()) = user_b);

create policy blocks_select_own on public.blocks
for select to authenticated
using (blocker = (select auth.uid()));

create policy dm_members_select on public.dm_members
for select to authenticated
using (user_id = (select auth.uid()) or private.is_dm_member(channel_id));

create policy voice_members_select on public.voice_members
for select to authenticated
using (private.is_channel_member(channel_id));

create policy pins_select_own on public.server_pins
for select to authenticated
using (user_id = (select auth.uid()));

create policy reactions_select_visible on public.message_reactions
for select to authenticated
using (exists (
  select 1 from public.messages m
  where m.id = message_reactions.message_id
    and private.is_channel_member(m.channel_id)
));

create policy events_select_member on public.server_events
for select to authenticated
using (exists (
  select 1 from public.server_members sm
  where sm.server_id = server_events.server_id
    and sm.user_id = (select auth.uid())
));

create policy interest_select_member on public.event_interest
for select to authenticated
using (exists (
  select 1
  from public.server_events e
  join public.server_members sm on sm.server_id = e.server_id
  where e.id = event_interest.event_id
    and sm.user_id = (select auth.uid())
));
