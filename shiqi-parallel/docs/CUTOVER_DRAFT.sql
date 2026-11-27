-- Revisão transacional: qualquer erro reverte todo o cutover.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

-- PREFLIGHT TRANSACIONAL: qualquer divergência aborta antes de renomear.
DO $preflight$
DECLARE
  t text;
  n bigint;
  r record;
  target_name text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','communities','community_members','channels','messages'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'SHIQI preflight: tabela prototype public.% ausente', t;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n <> 0 THEN
      RAISE EXCEPTION 'SHIQI preflight: public.% possui % linhas; necessário plano de preservação/migração de dados', t, n;
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY['legacy_profiles','legacy_communities','legacy_community_members','legacy_channels','legacy_messages'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      RAISE EXCEPTION 'SHIQI preflight: nome de legado já ocupado: public.%', t;
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'email_codes','rate_hits','servers','server_members','server_invites','dm_members',
    'friendships','blocks','voice_members','server_bans','server_pins','mfa_recovery',
    'message_reactions','server_events','event_interest'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      RAISE EXCEPTION 'SHIQI preflight: tabela canônica public.% já existe', t;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
    RAISE EXCEPTION 'SHIQI preflight: auth.users contém contas; definir estratégia de perfis antes do cutover';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='auth' AND c.relname='users'
      AND t.tgname='on_auth_user_created_shiqi' AND NOT t.tgisinternal
  ) OR to_regprocedure('private.handle_new_user()') IS NULL THEN
    RAISE EXCEPTION 'SHIQI preflight: trigger/handler prototype de Auth não corresponde ao esperado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE e.extname='pgcrypto' AND n.nspname='extensions'
  ) OR to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
    RAISE EXCEPTION 'SHIQI preflight: pgcrypto.gen_random_bytes não está em extensions';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime' AND NOT puballtables)
     OR EXISTS (SELECT 1 FROM pg_publication_namespace pn JOIN pg_publication p ON p.oid=pn.pnpubid WHERE p.pubname='supabase_realtime')
     OR (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime') <> 1
     OR NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages') THEN
    RAISE EXCEPTION 'SHIQI preflight: publicação Realtime diverge da configuração conhecida';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='storage' AND c.relname='objects'
      AND p.polname = ANY(ARRAY[
        'attachments_delete_own','attachments_insert_own','attachments_select_message_member',
        'avatars_delete_own','avatars_insert_own','avatars_select_own','avatars_update_own'
      ])
  ) THEN
    RAISE EXCEPTION 'SHIQI preflight: policy Storage com nome canônico já existe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='realtime' AND c.relname='messages'
      AND p.polname = ANY(ARRAY['voice_topic_select','voice_topic_insert'])
  ) THEN
    RAISE EXCEPTION 'SHIQI preflight: policy de canal privado Realtime já existe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id='avatars' AND NOT (
      name='avatars' AND public IS TRUE AND file_size_limit=1048576
      AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[]
      AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']::text[]
    )
  ) OR EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id='attachments' AND NOT (
      name='attachments' AND public IS FALSE AND file_size_limit=3145728
      AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]
      AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]
    )
  ) THEN
    RAISE EXCEPTION 'SHIQI preflight: bucket existente com configuração divergente';
  END IF;

  FOR r IN
    SELECT idx.relname
    FROM pg_index ix
    JOIN pg_class tbl ON tbl.oid=ix.indrelid
    JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
    JOIN pg_class idx ON idx.oid=ix.indexrelid
    WHERE ns.nspname='public'
      AND tbl.relname IN ('profiles','communities','community_members','channels','messages')
  LOOP
    target_name := left('legacy_' || r.relname, 63);
    IF to_regclass('public.' || target_name) IS NOT NULL THEN
      RAISE EXCEPTION 'SHIQI preflight: índice de legado % colide com %', r.relname, target_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT left('legacy_' || idx.relname, 63)
    FROM pg_index ix
    JOIN pg_class tbl ON tbl.oid=ix.indrelid
    JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
    JOIN pg_class idx ON idx.oid=ix.indexrelid
    WHERE ns.nspname='public'
      AND tbl.relname IN ('profiles','communities','community_members','channels','messages')
    GROUP BY left('legacy_' || idx.relname, 63)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'SHIQI preflight: dois índices prototype gerariam o mesmo nome legacy truncado';
  END IF;

  IF (SELECT count(*) FROM supabase_migrations.schema_migrations) <> 5
     OR EXISTS (
       SELECT 1 FROM unnest(ARRAY[
         'shiqi_initial_community_chat_schema',
         'shiqi_harden_rls_and_private_helpers',
         'shiqi_optimize_profile_rls',
         'shiqi_auth_profile_triggers',
         'shiqi_tighten_column_permissions'
       ]) expected(name)
       WHERE NOT EXISTS (
         SELECT 1 FROM supabase_migrations.schema_migrations m WHERE m.name=expected.name
       )
     ) THEN
    RAISE EXCEPTION 'SHIQI preflight: histórico de migrations remoto diverge das cinco migrations prototype auditadas';
  END IF;

  IF to_regclass('public.messages_id_seq') IS NOT NULL THEN
    RAISE EXCEPTION 'SHIQI preflight: sequence public.messages_id_seq já existe';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role')
     OR to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'SHIQI preflight: papéis Supabase ou Storage ausentes';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class idx
    JOIN pg_namespace ns ON ns.oid=idx.relnamespace
    WHERE ns.nspname='public' AND idx.relkind='i'
      AND idx.relname = ANY(ARRAY['channels_server_idx','dm_members_user_idx','email_codes_expires_idx','email_codes_lookup_idx','friendships_b_idx','message_reactions_msg_idx','messages_author_created_idx','messages_author_idx','messages_channel_created_idx','messages_thread_idx','profiles_username_lower_key','rate_hits_key_at_idx','server_events_srv_idx','server_invites_creator_idx','server_invites_server_idx','server_members_user_idx','servers_owner_idx','voice_members_user_idx','profiles_pkey','email_codes_pkey','servers_pkey','server_members_pkey','channels_pkey','messages_pkey','server_invites_pkey','dm_members_pkey','friendships_pkey','blocks_pkey','voice_members_pkey','server_bans_pkey','server_pins_pkey','mfa_recovery_pkey','message_reactions_pkey','server_events_pkey','event_interest_pkey']::text[])
      AND NOT EXISTS (
        SELECT 1 FROM pg_index ix JOIN pg_class tbl ON tbl.oid=ix.indrelid
        WHERE ix.indexrelid=idx.oid
          AND tbl.relname IN ('profiles','communities','community_members','channels','messages')
      )
  ) THEN
    RAISE EXCEPTION 'SHIQI preflight: nome de índice canônico já ocupado fora do legado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='public' AND p.proname = ANY(ARRAY['is_server_member','create_server','create_channel','create_invite','join_public_server','join_server','block_user','change_username','get_my_settings','my_age_group','open_dm','profiles_full','remove_friend','respond_dm_request','respond_friend_request','save_my_settings','send_friend_request','set_my_presence','unblock_user','unsubscribe_marketing','ban_member','create_event','delete_event','featured_servers','kick_member','list_bans','list_public_servers','my_plan','pin_server','set_server_public','toggle_event_interest','toggle_reaction','unban_member','voice_join','voice_leave','voice_ping','voice_set_state','get_auth_user_by_email','get_login_email_by_username','purge_user_data','rate_check','reactivate_account','revoke_user_sessions','verify_email_code']::text[]))
       OR (n.nspname='private' AND p.proname = ANY(ARRAY['accept_on_reply','dm_allowed','can_post','can_voice_topic','can_read_attachment','check_thread_parent','is_channel_member','is_channel_owner','is_dm_member','messages_rate_limit','remove_from_server','shares_server_with','touch_edited_at','touch_profile']::text[]))
  ) THEN
    RAISE EXCEPTION 'SHIQI preflight: nome de função canônica já existe; não sobrescrever';
  END IF;

END
$preflight$;

-- Preserva os cinco objetos prototype; nenhum dado, FK, policy ou trigger das tabelas
-- é descartado. Os índices são renomeados para liberar os nomes do schema canônico.
ALTER TABLE public.profiles RENAME TO legacy_profiles;
ALTER TABLE public.communities RENAME TO legacy_communities;
ALTER TABLE public.community_members RENAME TO legacy_community_members;
ALTER TABLE public.channels RENAME TO legacy_channels;
ALTER TABLE public.messages RENAME TO legacy_messages;

DO $rename_legacy_indexes$
DECLARE
  r record;
  target_name text;
BEGIN
  FOR r IN
    SELECT idx.relname
    FROM pg_index ix
    JOIN pg_class tbl ON tbl.oid=ix.indrelid
    JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
    JOIN pg_class idx ON idx.oid=ix.indexrelid
    WHERE ns.nspname='public'
      AND tbl.relname IN (
        'legacy_profiles','legacy_communities','legacy_community_members',
        'legacy_channels','legacy_messages'
      )
    ORDER BY idx.relname
  LOOP
    target_name := left('legacy_' || r.relname, 63);
    EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.relname, target_name);
  END LOOP;
END
$rename_legacy_indexes$;

-- O signup canônico cria o perfil explicitamente via Edge Function; o trigger prototype
-- duplicaria o INSERT e é removido. A função antiga fica preservada para reversão.
DROP TRIGGER on_auth_user_created_shiqi ON auth.users;

-- Cria as 18 tabelas canônicas, índices, funções, triggers e policies.
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


-- SHIQI — índices canônicos extraídos do catálogo PostgreSQL original.
-- Referência de reconstrução; PK indexes já são criados pelas constraints em CANONICAL_TABLES.sql.
-- Não executar este arquivo isoladamente antes das tabelas.

create index channels_server_idx on public.channels using btree (server_id, "position");
create index dm_members_user_idx on public.dm_members using btree (user_id);
create index email_codes_expires_idx on public.email_codes using btree (expires_at);
create index email_codes_lookup_idx on public.email_codes using btree (email, purpose, created_at desc);
create index friendships_b_idx on public.friendships using btree (user_b);
create index message_reactions_msg_idx on public.message_reactions using btree (message_id);
create index messages_author_created_idx on public.messages using btree (author_id, created_at desc);
create index messages_author_idx on public.messages using btree (author_id);
create index messages_channel_created_idx on public.messages using btree (channel_id, created_at desc);
create index messages_thread_idx on public.messages using btree (thread_of) where thread_of is not null;
create unique index profiles_username_lower_key on public.profiles using btree (lower(username));
create index rate_hits_key_at_idx on public.rate_hits using btree (key, at desc);
create index server_events_srv_idx on public.server_events using btree (server_id, starts_at);
create index server_invites_creator_idx on public.server_invites using btree (created_by);
create index server_invites_server_idx on public.server_invites using btree (server_id);
create index server_members_user_idx on public.server_members using btree (user_id);
create index servers_owner_idx on public.servers using btree (owner_id);
create index voice_members_user_idx on public.voice_members using btree (user_id);


-- SHIQI — helpers privados extraídos do catálogo PostgreSQL original.
-- Referência SQL. Criar schema private e tabelas antes; grants e triggers em arquivos próprios.
-- SECURITY DEFINER com search_path vazio, conforme catálogo original.

create schema if not exists private;

create or replace function private.accept_on_reply()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.dm_members set state = 'active'
  where channel_id = new.channel_id and user_id = new.author_id and state = 'request';
  return new;
end
$function$;

create or replace function private.dm_allowed(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select not exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  ) and (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted' and f.user_a = least(a, b) and f.user_b = greatest(a, b)
    ) or exists (
      select 1 from public.server_members x
      join public.server_members y on y.server_id = x.server_id
      where x.user_id = a and y.user_id = b
    )
  )
$function$;


create or replace function private.can_post(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.channels c
    join public.server_members m on m.server_id = c.server_id
    where c.id = p_channel and c.kind = 'text' and m.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.dm_members d1
    join public.dm_members d2 on d2.channel_id = d1.channel_id and d2.user_id <> d1.user_id
    where d1.channel_id = p_channel and d1.user_id = (select auth.uid())
      and private.dm_allowed(d1.user_id, d2.user_id)
  )
$function$;

create or replace function private.can_voice_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_topic !~ '^voice:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return exists (
    select 1 from public.channels c
    join public.server_members m on m.server_id = c.server_id
    where c.id = substring(p_topic from 7)::uuid and c.kind = 'voice'
      and m.user_id = (select auth.uid())
  );
end;
$function$;

create or replace function private.check_thread_parent()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare pc uuid; pt bigint;
begin
  if new.thread_of is null then return new; end if;
  select channel_id, thread_of into pc, pt from public.messages where id = new.thread_of;
  if pc is null or pc <> new.channel_id or pt is not null then raise exception 'invalid_thread'; end if;
  return new;
end
$function$;


create or replace function private.is_channel_member(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.channels c
    join public.server_members m on m.server_id = c.server_id
    where c.id = p_channel and m.user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.dm_members d
    join public.dm_members other_member
      on other_member.channel_id = d.channel_id and other_member.user_id <> d.user_id
    where d.channel_id = p_channel
      and d.user_id = (select auth.uid())
      and private.dm_allowed(d.user_id, other_member.user_id)
  )
$function$;

create or replace function private.is_channel_owner(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.channels c
    join public.servers s on s.id = c.server_id
    where c.id = p_channel and s.owner_id = (select auth.uid())
  )
$function$;

create or replace function private.is_dm_member(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.dm_members d
    join public.dm_members other_member
      on other_member.channel_id = d.channel_id and other_member.user_id <> d.user_id
    where d.channel_id = p_channel
      and d.user_id = (select auth.uid())
      and private.dm_allowed(d.user_id, other_member.user_id)
  )
$function$;

create or replace function private.can_read_attachment(p_path text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.messages m
    join public.channels c on c.id = m.channel_id
    where m.attachment_path = p_path
      and split_part(p_path, '/', 1) = m.author_id::text
      and split_part(p_path, '/', 2) <> ''
      and (
        (
          c.kind = 'text'
          and exists (
            select 1 from public.server_members sm
            where sm.server_id = c.server_id
              and sm.user_id = (select auth.uid())
          )
        )
        or (
          c.kind = 'dm'
          and exists (
            select 1
            from public.dm_members mine
            where mine.channel_id = c.id
              and mine.user_id = (select auth.uid())
              and mine.state = 'active'
              and exists (
                select 1
                from public.dm_members other_member
                where other_member.channel_id = c.id
                  and other_member.user_id <> (select auth.uid())
                  and private.dm_allowed((select auth.uid()), other_member.user_id)
                  and (m.author_id = (select auth.uid()) or other_member.state = 'active')
              )
          )
        )
      )
  )
$function$;

create or replace function private.messages_rate_limit()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:messages:rate:' || new.author_id::text, 0));
  if (select count(*) from public.messages
      where author_id = new.author_id and created_at > now() - interval '5 seconds') >= 5
     or (select count(*) from public.messages
         where author_id = new.author_id and created_at > now() - interval '60 seconds') >= 40 then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$function$;

create or replace function private.remove_from_server(p_server uuid, p_user uuid, p_ban boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.servers s where s.id = p_server and s.owner_id = uid) then raise exception 'not_owner'; end if;
  if p_user = uid then raise exception 'cannot_remove_self'; end if;
  delete from public.server_members where server_id = p_server and user_id = p_user;
  delete from public.voice_members
  where user_id = p_user and channel_id in (select id from public.channels where server_id = p_server);
  if p_ban then
    insert into public.server_bans (server_id, user_id)
    values (p_server, p_user) on conflict do nothing;
  end if;
end;
$function$;

create or replace function private.shares_server_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.server_members a
    join public.server_members b on b.server_id = a.server_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  ) or exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and f.user_a = least((select auth.uid()), p_user)
      and f.user_b = greatest((select auth.uid()), p_user)
  )
$function$;

create or replace function private.touch_edited_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.content is distinct from old.content then new.edited_at := now(); end if;
  return new;
end;
$function$;

create or replace function private.touch_profile()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (new.bio is distinct from old.bio or new.display_name is distinct from old.display_name
      or new.avatar_path is distinct from old.avatar_path or new.accent is distinct from old.accent
      or new.status_text is distinct from old.status_text)
     and coalesce((new.settings->>'share_profile_update')::boolean, true) then
    new.profile_updated_at := now();
  end if;
  return new;
end
$function$;


-- SHIQI — RPC/helper público e triggers do schema original.
-- Referência de reconstrução. Funções privadas devem existir antes dos triggers.

create or replace function public.is_server_member(p_server uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.server_members m
    where m.server_id = p_server and m.user_id = (select auth.uid())
  )
$function$;

create trigger messages_check_thread
before insert on public.messages
for each row execute function private.check_thread_parent();

create trigger messages_rate_limit
before insert on public.messages
for each row execute function private.messages_rate_limit();

create trigger messages_touch_edited
before update on public.messages
for each row execute function private.touch_edited_at();

create trigger trg_accept_on_reply
after insert on public.messages
for each row execute function private.accept_on_reply();

create trigger trg_touch_profile
before update on public.profiles
for each row execute function private.touch_profile();


-- SHIQI — RPCs de servidores/canais/convites extraídas do PostgreSQL original.
-- Referência SQL; tabelas, helpers e extensão pgcrypto/namespace extensions devem existir.

create or replace function public.create_server(p_name text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := (select auth.uid());
  nm text := btrim(coalesce(p_name, ''));
  sid uuid;
  n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(nm) < 2 or char_length(nm) > 40 then raise exception 'invalid_name'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:server:create:' || uid::text, 0));
  select count(*) into n from public.servers where owner_id = uid;
  if n >= 10 then raise exception 'too_many_servers'; end if;
  insert into public.servers (name, owner_id) values (nm, uid) returning id into sid;
  insert into public.server_members (server_id, user_id, role) values (sid, uid, 'owner');
  insert into public.channels (server_id, name, kind, position)
    values (sid, 'Geral', 'text', 0), (sid, 'Sala principal', 'voice', 1);
  return sid;
end;
$function$;

create or replace function public.create_channel(p_server uuid, p_name text, p_kind text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  nm text := btrim(coalesce(p_name, ''));
  n integer;
  pos integer;
  cid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('text', 'voice') then raise exception 'invalid_kind'; end if;
  if char_length(nm) < 1 or char_length(nm) > 30 then raise exception 'invalid_name'; end if;
  if not exists (select 1 from public.servers s where s.id = p_server and s.owner_id = uid) then
    raise exception 'not_owner';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:channel:create:' || p_server::text, 0));
  select count(*), coalesce(max(position), -1) + 1 into n, pos
  from public.channels where server_id = p_server;
  if n >= 30 then raise exception 'too_many_channels'; end if;
  insert into public.channels (server_id, name, kind, position)
  values (p_server, nm, p_kind, pos) returning id into cid;
  return cid;
end;
$function$;

create or replace function public.create_invite(p_server uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  c text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.server_members m where m.server_id = p_server and m.user_id = uid
  ) then raise exception 'not_member'; end if;
  c := encode(extensions.gen_random_bytes(5), 'hex');
  insert into public.server_invites (code, server_id, created_by) values (c, p_server, uid);
  return c;
end;
$function$;

create or replace function public.join_public_server(p_server uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.servers s where s.id = p_server and s.is_public) then
    raise exception 'invalid_invite';
  end if;
  if exists (select 1 from public.server_bans b where b.server_id = p_server and b.user_id = uid) then
    raise exception 'banned';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:membership:limit:' || uid::text, 0));
  if exists (select 1 from public.server_members m where m.server_id = p_server and m.user_id = uid) then
    return p_server;
  end if;
  select count(*) into n from public.server_members where user_id = uid;
  if n >= 20 then raise exception 'too_many_servers'; end if;
  insert into public.server_members (server_id, user_id, role)
  values (p_server, uid, 'member') on conflict do nothing;
  return p_server;
end;
$function$;

create or replace function public.join_server(p_code text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  inv public.server_invites%rowtype;
  n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into inv from public.server_invites
  where code = lower(btrim(coalesce(p_code, ''))) for update;
  if not found or inv.expires_at < now() or inv.uses >= inv.max_uses then
    raise exception 'invalid_invite';
  end if;
  if exists (select 1 from public.server_bans b where b.server_id = inv.server_id and b.user_id = uid) then
    raise exception 'banned';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:membership:limit:' || uid::text, 0));
  if exists (select 1 from public.server_members m where m.server_id = inv.server_id and m.user_id = uid) then
    return inv.server_id;
  end if;
  select count(*) into n from public.server_members where user_id = uid;
  if n >= 20 then raise exception 'too_many_servers'; end if;
  insert into public.server_members (server_id, user_id, role)
  values (inv.server_id, uid, 'member') on conflict do nothing;
  update public.server_invites set uses = uses + 1 where code = inv.code;
  return inv.server_id;
end;
$function$;


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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:event:create:' || p_server::text, 0));
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:pins:limit:' || uid::text, 0));
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:event-interest:' || p_event::text || ':' || me::text, 0));
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:reaction:message:' || p_message::text, 0));
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
  -- Serializa entradas concorrentes do mesmo usuário e da mesma sala.
  -- A ordem (usuário -> sala) é fixa para evitar deadlocks entre chamadas.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:voice:user:' || uid::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:voice:channel:' || p_channel::text, 0));
  delete from public.voice_members where channel_id = p_channel and seen_at < now() - interval '45 seconds';
  delete from public.voice_members where user_id = uid and channel_id <> p_channel;
  select count(*) into n from public.voice_members where channel_id = p_channel and user_id <> uid;
  if n >= 10 then raise exception 'voice_full'; end if;
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:rate:' || coalesce(p_key, ''), 0));
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
with check (
  author_id = (select auth.uid())
  and private.can_post(channel_id)
  and (attachment_path is null or (
    split_part(attachment_path, '/', 1) = (select auth.uid())::text
    and split_part(attachment_path, '/', 2) <> ''
  ))
);

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


-- Revoga também privilégios por coluna eventualmente deixados no protótipo.
DO $revoke_legacy_column_acl$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT format('%I.%I', ns.nspname, tbl.relname) AS table_name,
           string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum) AS column_names
    FROM pg_class tbl
    JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
    JOIN pg_attribute a ON a.attrelid=tbl.oid
    WHERE ns.nspname='public'
      AND tbl.relkind IN ('r','p')
      AND a.attnum > 0 AND NOT a.attisdropped
    GROUP BY ns.nspname, tbl.relname
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES (%s) ON TABLE %s FROM anon, authenticated',
      r.column_names, r.table_name
    );
  END LOOP;
END
$revoke_legacy_column_acl$;

-- SHIQI — tabela/coluna/sequence ACL de referência.
-- Extraído de information_schema.role_table_grants e column_privileges
-- do Supabase original em 2026-11-26; exclui música e QR.
-- Hardened: nunca conceder acesso a anon. RLS continua obrigatória.
-- Aplicar somente depois de validar cada coluna contra CANONICAL_TABLES.sql.

-- Revoke grants amplos/defaults antes dos grants específicos.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

REVOKE ALL PRIVILEGES (id, username, display_name, birth_date, marketing_opt_in,
  created_at, bio, status_text, avatar_path, accent, last_seen,
  terms_accepted_at, plan, settings, presence, deactivated_at, profile_updated_at)
ON TABLE public.profiles FROM anon, authenticated;
REVOKE ALL PRIVILEGES (id, channel_id, author_id, content, created_at, edited_at,
  attachment_path, attachment_alt, thread_of)
ON TABLE public.messages FROM anon, authenticated;

-- Leitura direta permitida pelo original; todas as tabelas permanecem sob RLS.
GRANT SELECT ON public.blocks, public.channels, public.dm_members,
  public.event_interest, public.friendships, public.message_reactions,
  public.messages, public.server_events, public.server_members,
  public.server_pins, public.servers, public.voice_members
TO authenticated;

-- Mensagens: exclusão permitida por RLS (autor ou proprietário).
GRANT DELETE ON public.messages TO authenticated;

-- Perfil: leitura apenas dos campos públicos/de presença.
GRANT SELECT (id, username, display_name, avatar_path, deactivated_at,
  last_seen, presence, profile_updated_at)
ON public.profiles TO authenticated;

-- Perfil: escrita apenas dos campos editáveis/presença.
GRANT UPDATE (accent, avatar_path, bio, display_name, last_seen, status_text)
ON public.profiles TO authenticated;

-- Mensagens: inserção/edição limitada aos campos usados pelo cliente.
-- author_id não é concedido para INSERT; deve ser preenchido por default seguro.
GRANT INSERT (attachment_alt, attachment_path, channel_id, content, thread_of)
ON public.messages TO authenticated;
GRANT UPDATE (content) ON public.messages TO authenticated;

-- Identity sequence: apenas USAGE necessário para geração automática do id.
GRANT USAGE ON SEQUENCE public.messages_id_seq TO authenticated;

-- service_role recebe privilégios administrativos sobre tabelas e sequences
-- através do modelo Supabase padrão; não conceder anon.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Tabelas internas sem grants diretos a authenticated:
-- email_codes, rate_hits, server_invites, server_bans, mfa_recovery.
-- Escritas/leituras dessas áreas permanecem mediadas por RPCs/Edge Function.


-- SHIQI function ACL policy reference, based on has_function_privilege() in original.
-- This is a hardened target policy, not a byte-for-byte copy of permissive defaults.
-- All SECURITY DEFINER functions must retain SET search_path = '' and schema-qualify references.
-- Revoke PUBLIC/anon explicitly; then grant only the roles listed below.
-- Explicitly clear inherited/default API execution before granting the allow-list.
REVOKE USAGE ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.ban_member(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.change_username(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_channel(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_event(uuid,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_invite(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_server(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.delete_event(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.featured_servers() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_my_settings() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_server_member(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.join_public_server(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.join_server(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.kick_member(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.list_bans(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.list_public_servers() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.my_age_group() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.my_plan() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.open_dm(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pin_server(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.profiles_full(uuid[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.reactivate_account() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.remove_friend(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.respond_dm_request(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.respond_friend_request(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.save_my_settings(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.send_friend_request(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.send_friend_request(text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_my_presence(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_server_public(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.toggle_event_interest(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.toggle_reaction(bigint,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unban_member(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unblock_user(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unsubscribe_marketing() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.voice_join(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.voice_leave() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.voice_ping(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.voice_set_state(boolean,boolean,boolean,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_auth_user_by_email(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_login_email_by_username(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.purge_user_data(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rate_check(text,integer,integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.verify_email_code(text,text,text,integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.can_post(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.can_voice_topic(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.is_channel_member(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.is_channel_owner(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.is_dm_member(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.can_read_attachment(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.shares_server_with(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.accept_on_reply() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.check_thread_parent() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.dm_allowed(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.messages_rate_limit() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.remove_from_server(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.touch_edited_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.touch_profile() FROM PUBLIC, anon, authenticated, service_role;


-- Client-callable public RPCs: EXECUTE for authenticated and service_role.
GRANT EXECUTE ON FUNCTION public.ban_member(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_username(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_channel(uuid,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_event(uuid,text,text,text,timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_invite(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_server(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_event(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.featured_servers() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_server_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_public_server(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_server(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kick_member(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_bans(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_public_servers() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_age_group() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_plan() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.open_dm(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pin_server(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.profiles_full(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_account() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_friend(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_dm_request(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_my_settings(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_friend_request(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_friend_request(text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_my_presence(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_server_public(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_event_interest(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_reaction(bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unban_member(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unsubscribe_marketing() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.voice_join(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.voice_leave() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.voice_ping(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.voice_set_state(boolean,boolean,boolean,boolean) TO authenticated, service_role;

-- Backend-only public routines: service_role only (not exposed to browser users).
GRANT EXECUTE ON FUNCTION public.get_auth_user_by_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_login_email_by_username(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_user_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rate_check(text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_email_code(text,text,text,integer) TO service_role;
-- Private helpers referenced directly by RLS policies.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_voice_topic(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_channel_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_channel_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_dm_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_attachment(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.shares_server_with(uuid) TO authenticated;

-- Trigger-only functions remain executable by their owner/postgres, not API roles.
-- Do not grant authenticated/anon on accept_on_reply, check_thread_parent,
-- dm_allowed, messages_rate_limit, touch_edited_at or touch_profile.
-- private.is_dm_member is required by channels_select_member and is granted above.
-- private.can_read_attachment is required by the private attachments Storage SELECT policy.
-- private.remove_from_server is callable only from its owning privileged routines.
-- Apply REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated, service_role first,
-- then grants above. Confirm trigger execution and policy calls with role tests.


-- SHIQI — configuração canônica dos buckets Storage.
-- Referência para a migration revisada; NÃO executar isoladamente.
-- Requer Storage habilitado no projeto e deve ser aplicada após o preflight.
-- Não sobrescreve buckets existentes: falha se encontrar configuração divergente.

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'avatars', 'avatars', true, 1048576,
      ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'avatars'
      AND name = 'avatars'
      AND public IS TRUE
      AND file_size_limit = 1048576
      AND allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
      AND allowed_mime_types <@ ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
  ) THEN
    RAISE EXCEPTION 'SHIQI: bucket avatars existe com configuração divergente';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'attachments') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'attachments', 'attachments', false, 3145728,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'attachments'
      AND name = 'attachments'
      AND public IS FALSE
      AND file_size_limit = 3145728
      AND allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
      AND allowed_mime_types <@ ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  ) THEN
    RAISE EXCEPTION 'SHIQI: bucket attachments existe com configuração divergente';
  END IF;
END
$migration$;


-- SHIQI canonical Storage reference (extracted from original project catalog)
-- Buckets:
-- attachments: public, 3 MiB, image/jpeg,image/png,image/webp,image/gif
-- avatars: public, 1 MiB, image/jpeg,image/png,image/webp
-- The bucket metadata is descriptive; create/update is deferred to the reviewed migration.

CREATE POLICY attachments_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY attachments_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY attachments_select_message_member ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND private.can_read_attachment(name));

CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY avatars_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);


-- SHIQI — publicação Realtime canônica.
-- Referência para a migration revisada; NÃO executar isoladamente.
-- Executar somente depois de criar as tabelas canônicas e renomear o protótipo.
-- A tabela antiga messages passa a legacy_messages; removê-la da publicação
-- antes de adicionar a nova public.messages.

DO $migration$
DECLARE
  target_table text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'SHIQI: publicação supabase_realtime não existe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'legacy_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.legacy_messages';
  END IF;

  FOREACH target_table IN ARRAY ARRAY['friendships', 'messages', 'voice_members'] LOOP
    IF to_regclass('public.' || target_table) IS NULL THEN
      RAISE EXCEPTION 'SHIQI: tabela Realtime public.% ainda não existe', target_table;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = target_table
    ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        target_table
      );
    END IF;
  END LOOP;
END
$migration$;

-- Sinalização WebRTC em canal privado: somente membros atuais do servidor
-- dono do canal voice podem ler e publicar mensagens de broadcast.
DROP POLICY IF EXISTS voice_topic_select ON realtime.messages;
DROP POLICY IF EXISTS voice_topic_insert ON realtime.messages;
CREATE POLICY voice_topic_select ON realtime.messages
  FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND private.can_voice_topic((SELECT realtime.topic())));
CREATE POLICY voice_topic_insert ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (extension = 'broadcast' AND private.can_voice_topic((SELECT realtime.topic())));


NOTIFY pgrst, 'reload schema';

-- ATENÇÃO: este é um artefato de revisão, não uma autorização para executar.
-- Não aplicar no projeto remoto até que o rollback tenha sido completado e testado
-- em PostgreSQL isolado e o usuário aprove explicitamente a janela de cutover.

COMMIT;
