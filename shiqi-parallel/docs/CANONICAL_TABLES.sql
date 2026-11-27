-- SHIQI — definição canônica das 18 tabelas (extraída do catálogo PostgreSQL original)
-- Somente referência de reconstrução. NÃO aplicar diretamente: ordem, RLS, grants,
-- funções, triggers, storage, realtime e preflight de legado estão em arquivos separados.
-- Música e QR foram intencionalmente excluídos.
-- Fonte: pg_attribute / pg_attrdef / pg_constraint, projeto original, 2026-11-26.

create table public.profiles (
  id uuid not null,
  username text not null,
  display_name text not null,
  birth_date date,
  marketing_opt_in boolean default false not null,
  created_at timestamptz default now() not null,
  bio text default ''::text not null,
  status_text text default ''::text not null,
  avatar_path text,
  accent text default '#9D8CCF'::text not null,
  last_seen timestamptz,
  terms_accepted_at timestamptz,
  plan text default 'free'::text not null,
  settings jsonb default '{}'::jsonb not null,
  presence text default 'online'::text not null,
  deactivated_at timestamptz,
  profile_updated_at timestamptz,
  constraint profiles_accent_check check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  constraint profiles_avatar_path_check check (avatar_path is null or char_length(avatar_path) <= 200),
  constraint profiles_bio_check check (char_length(bio) <= 190),
  constraint profiles_display_name_check check (char_length(display_name) between 1 and 40),
  constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade,
  constraint profiles_pkey primary key (id),
  constraint profiles_presence_check check (presence in ('online','idle','dnd','invisible')),
  constraint profiles_settings_size check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 8192),
  constraint profiles_status_text_check check (char_length(status_text) <= 60),
  constraint profiles_username_check check (username ~ '^[a-z0-9._]{3,20}$')
);

create table public.email_codes (
  id uuid default gen_random_uuid() not null,
  email text not null,
  purpose text not null,
  code_hash text not null,
  attempts integer default 0 not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz default now() not null,
  constraint email_codes_pkey primary key (id),
  constraint email_codes_purpose_check check (purpose in ('signup','reset','change'))
);

create table public.rate_hits (
  key text not null,
  at timestamptz default now() not null
);

create table public.servers (
  id uuid default gen_random_uuid() not null,
  name text not null,
  owner_id uuid not null,
  created_at timestamptz default now() not null,
  is_public boolean default false not null,
  level integer default 1 not null,
  constraint servers_level_check check (level between 1 and 10),
  constraint servers_name_check check (char_length(name) between 2 and 40),
  constraint servers_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete cascade,
  constraint servers_pkey primary key (id)
);

create table public.server_members (
  server_id uuid not null,
  user_id uuid not null,
  role text default 'member'::text not null,
  joined_at timestamptz default now() not null,
  constraint server_members_pkey primary key (server_id,user_id),
  constraint server_members_role_check check (role in ('owner','member')),
  constraint server_members_server_id_fkey foreign key (server_id) references public.servers(id) on delete cascade,
  constraint server_members_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create table public.channels (
  id uuid default gen_random_uuid() not null,
  server_id uuid,
  name text not null,
  kind text not null,
  "position" integer default 0 not null,
  created_at timestamptz default now() not null,
  constraint channels_dm_shape check ((kind = 'dm') = (server_id is null)),
  constraint channels_kind_check check (kind in ('text','voice','dm')),
  constraint channels_name_check check (char_length(name) between 1 and 30),
  constraint channels_pkey primary key (id),
  constraint channels_server_id_fkey foreign key (server_id) references public.servers(id) on delete cascade
);

create table public.messages (
  id bigint generated always as identity not null,
  channel_id uuid not null,
  author_id uuid default auth.uid() not null,
  content text not null,
  created_at timestamptz default now() not null,
  edited_at timestamptz,
  attachment_path text,
  attachment_alt text,
  thread_of bigint,
  constraint messages_alt_len check (attachment_alt is null or length(attachment_alt) <= 300),
  constraint messages_attachment_path_check check (attachment_path is null or char_length(attachment_path) <= 200),
  constraint messages_author_id_fkey foreign key (author_id) references auth.users(id) on delete cascade,
  constraint messages_channel_id_fkey foreign key (channel_id) references public.channels(id) on delete cascade,
  constraint messages_content_check check (char_length(btrim(content)) between 1 and 2000),
  constraint messages_pkey primary key (id),
  constraint messages_thread_of_fkey foreign key (thread_of) references public.messages(id) on delete cascade
);

create table public.server_invites (
  code text not null,
  server_id uuid not null,
  created_by uuid not null,
  created_at timestamptz default now() not null,
  expires_at timestamptz default (now() + interval '7 days') not null,
  max_uses integer default 50 not null,
  uses integer default 0 not null,
  constraint server_invites_created_by_fkey foreign key (created_by) references auth.users(id) on delete cascade,
  constraint server_invites_pkey primary key (code),
  constraint server_invites_server_id_fkey foreign key (server_id) references public.servers(id) on delete cascade
);

create table public.dm_members (
  channel_id uuid not null,
  user_id uuid not null,
  state text default 'active'::text not null,
  constraint dm_members_channel_id_fkey foreign key (channel_id) references public.channels(id) on delete cascade,
  constraint dm_members_pkey primary key (channel_id,user_id),
  constraint dm_members_state_chk check (state in ('active','request')),
  constraint dm_members_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create table public.friendships (
  user_a uuid not null,
  user_b uuid not null,
  requester uuid not null,
  status text default 'pending'::text not null,
  created_at timestamptz default now() not null,
  note text,
  constraint friendships_check check (user_a < user_b),
  constraint friendships_check1 check (requester = user_a or requester = user_b),
  constraint friendships_note_check check (note is null or char_length(note) <= 120),
  constraint friendships_pkey primary key (user_a,user_b),
  constraint friendships_status_check check (status in ('pending','accepted')),
  constraint friendships_user_a_fkey foreign key (user_a) references auth.users(id) on delete cascade,
  constraint friendships_user_b_fkey foreign key (user_b) references auth.users(id) on delete cascade
);

create table public.blocks (
  blocker uuid not null,
  blocked uuid not null,
  created_at timestamptz default now() not null,
  constraint blocks_blocked_fkey foreign key (blocked) references auth.users(id) on delete cascade,
  constraint blocks_blocker_fkey foreign key (blocker) references auth.users(id) on delete cascade,
  constraint blocks_check check (blocker <> blocked),
  constraint blocks_pkey primary key (blocker,blocked)
);

create table public.voice_members (
  channel_id uuid not null,
  user_id uuid not null,
  seen_at timestamptz default now() not null,
  muted boolean default false not null,
  deafened boolean default false not null,
  video boolean default false not null,
  screen boolean default false not null,
  constraint voice_members_channel_id_fkey foreign key (channel_id) references public.channels(id) on delete cascade,
  constraint voice_members_pkey primary key (channel_id,user_id),
  constraint voice_members_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create table public.server_bans (
  server_id uuid not null,
  user_id uuid not null,
  banned_at timestamptz default now() not null,
  constraint server_bans_pkey primary key (server_id,user_id),
  constraint server_bans_server_id_fkey foreign key (server_id) references public.servers(id) on delete cascade,
  constraint server_bans_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create table public.server_pins (
  user_id uuid default auth.uid() not null,
  server_id uuid not null,
  created_at timestamptz default now() not null,
  constraint server_pins_pkey primary key (user_id,server_id),
  constraint server_pins_server_id_fkey foreign key (server_id) references public.servers(id) on delete cascade,
  constraint server_pins_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create table public.mfa_recovery (
  user_id uuid not null,
  code_hash text not null,
  used_at timestamptz,
  constraint mfa_recovery_pkey primary key (user_id,code_hash),
  constraint mfa_recovery_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create table public.message_reactions (
  message_id bigint not null,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz default now() not null,
  constraint message_reactions_emoji_check check (char_length(emoji) between 1 and 16),
  constraint message_reactions_message_id_fkey foreign key (message_id) references public.messages(id) on delete cascade,
  constraint message_reactions_pkey primary key (message_id,user_id,emoji),
  constraint message_reactions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create table public.server_events (
  id uuid default gen_random_uuid() not null,
  server_id uuid not null,
  creator_id uuid not null,
  title text not null,
  description text default ''::text not null,
  place text default ''::text not null,
  starts_at timestamptz not null,
  created_at timestamptz default now() not null,
  constraint server_events_creator_id_fkey foreign key (creator_id) references auth.users(id) on delete cascade,
  constraint server_events_description_check check (char_length(description) <= 500),
  constraint server_events_pkey primary key (id),
  constraint server_events_place_check check (char_length(place) <= 80),
  constraint server_events_server_id_fkey foreign key (server_id) references public.servers(id) on delete cascade,
  constraint server_events_title_check check (char_length(title) between 2 and 80)
);

create table public.event_interest (
  event_id uuid not null,
  user_id uuid not null,
  created_at timestamptz default now() not null,
  constraint event_interest_event_id_fkey foreign key (event_id) references public.server_events(id) on delete cascade,
  constraint event_interest_pkey primary key (event_id,user_id),
  constraint event_interest_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);
