-- SHIQI — preflight somente leitura para a migração canônica.
-- Este arquivo NÃO altera o banco. Executar e revisar todos os resultados antes
-- de considerar CUTOVER_DRAFT.sql. Qualquer check false bloqueia a migração.

-- 1) As cinco tabelas prototype ainda existem e continuam vazias.
SELECT 'prototype_tables_exist' AS check_name,
       count(*) = 5 AS passed,
       string_agg(c.relname, ', ' ORDER BY c.relname) AS observed
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p')
  AND c.relname IN ('profiles','communities','community_members','channels','messages');

SELECT 'prototype_row_counts' AS check_name,
       bool_and(row_count = 0) AS passed,
       string_agg(table_name || '=' || row_count::text, ', ' ORDER BY table_name) AS observed
FROM (
  SELECT 'profiles' AS table_name, count(*) AS row_count FROM public.profiles
  UNION ALL SELECT 'communities', count(*) FROM public.communities
  UNION ALL SELECT 'community_members', count(*) FROM public.community_members
  UNION ALL SELECT 'channels', count(*) FROM public.channels
  UNION ALL SELECT 'messages', count(*) FROM public.messages
) counts;

-- 2) Nomes de legado livres; a migration usa esses nomes para preservar OIDs/dados.
SELECT 'legacy_names_free' AS check_name,
       bool_and(to_regclass('public.' || name) IS NULL) AS passed,
       string_agg(name, ', ' ORDER BY name) AS observed
FROM unnest(ARRAY[
  'legacy_profiles','legacy_communities','legacy_community_members',
  'legacy_channels','legacy_messages'
]) AS names(name);

-- 3) Tabelas canônicas que não colidem com as três tabelas prototype.
SELECT 'other_canonical_table_names_free' AS check_name,
       bool_and(to_regclass('public.' || name) IS NULL) AS passed,
       string_agg(name, ', ' ORDER BY name) AS observed
FROM unnest(ARRAY[
  'email_codes','rate_hits','servers','server_members','server_invites',
  'dm_members','friendships','blocks','voice_members','server_bans',
  'server_pins','mfa_recovery','message_reactions','server_events','event_interest'
]) AS names(name);

-- 4) Nenhuma conta Auth deve ser migrada implicitamente nesta fase.
SELECT 'auth_users_empty' AS check_name,
       count(*) = 0 AS passed,
       count(*)::text AS observed
FROM auth.users;

-- 5) Trigger prototype esperado e função antiga devem existir exatamente uma vez.
SELECT 'prototype_auth_trigger' AS check_name,
       count(*) = 1 AS passed,
       count(*)::text AS observed
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND t.tgname = 'on_auth_user_created_shiqi'
  AND NOT t.tgisinternal;

SELECT 'prototype_auth_trigger_function' AS check_name,
       to_regprocedure('private.handle_new_user()') IS NOT NULL AS passed,
       COALESCE(to_regprocedure('private.handle_new_user()')::text, 'missing') AS observed;

-- 6) A extensão pgcrypto precisa fornecer a função no schema usado pelo RPC create_invite.
SELECT 'pgcrypto_extensions_schema' AS check_name,
       EXISTS (
         SELECT 1 FROM pg_extension e
         JOIN pg_namespace n ON n.oid = e.extnamespace
         WHERE e.extname = 'pgcrypto' AND n.nspname = 'extensions'
       )
       AND to_regprocedure('extensions.gen_random_bytes(integer)') IS NOT NULL AS passed,
       COALESCE(to_regprocedure('extensions.gen_random_bytes(integer)')::text, 'missing') AS observed;

-- 7) A publicação deve ser a configuração conhecida: somente public.messages,
-- sem modo FOR ALL TABLES nem inclusão de schema inteiro.
SELECT 'realtime_publication_shape' AS check_name,
       EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_namespace pn
         JOIN pg_publication p ON p.oid = pn.pnpubid
         WHERE p.pubname = 'supabase_realtime'
       )
       AND (
         SELECT count(*) = 1
           AND bool_and(schemaname = 'public' AND tablename = 'messages')
         FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
       ) AS passed,
       COALESCE((
         SELECT string_agg(schemaname || '.' || tablename, ', ' ORDER BY schemaname, tablename)
         FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
       ), 'no tables') AS observed;

-- 8) Buckets existentes podem estar ausentes ou já ter exatamente a configuração alvo.
SELECT 'storage_bucket_settings_compatible' AS check_name,
       NOT EXISTS (
         SELECT 1 FROM storage.buckets
         WHERE id = 'avatars'
           AND NOT (
             name = 'avatars' AND public IS TRUE AND file_size_limit = 1048576
             AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[]
             AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']::text[]
           )
       )
       AND NOT EXISTS (
         SELECT 1 FROM storage.buckets
         WHERE id = 'attachments'
           AND NOT (
             name = 'attachments' AND public IS TRUE AND file_size_limit = 3145728
             AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]
             AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]
           )
       ) AS passed,
       COALESCE((
         SELECT string_agg(id || ':' || public::text || ':' || COALESCE(file_size_limit::text,'null'), ', ')
         FROM storage.buckets WHERE id IN ('avatars','attachments')
       ), 'no buckets') AS observed;

-- 9) Nenhuma policy Storage com os nomes que a migration pretende criar.
SELECT 'storage_policy_names_free' AS check_name,
       count(*) = 0 AS passed,
       count(*)::text AS observed
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'storage'
  AND c.relname = 'objects'
  AND p.polname IN (
    'attachments_delete_own','attachments_insert_own','attachments_select_own',
    'avatars_delete_own','avatars_insert_own','avatars_select_own','avatars_update_own'
  );

-- 10) Os nomes prefixados para índices antigos precisam estar livres antes do rename.
SELECT 'legacy_index_rename_targets_free' AS check_name,
       NOT EXISTS (
         SELECT 1
         FROM pg_index ix
         JOIN pg_class tbl ON tbl.oid = ix.indrelid
         JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
         JOIN pg_class idx ON idx.oid = ix.indexrelid
         WHERE ns.nspname = 'public'
           AND tbl.relname IN ('profiles','communities','community_members','channels','messages')
           AND to_regclass('public.' || left('legacy_' || idx.relname, 63)) IS NOT NULL
       ) AS passed,
       COALESCE((
         SELECT string_agg(idx.relname || ' -> ' || left('legacy_' || idx.relname,63), ', ')
         FROM pg_index ix
         JOIN pg_class tbl ON tbl.oid = ix.indrelid
         JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
         JOIN pg_class idx ON idx.oid = ix.indexrelid
         WHERE ns.nspname = 'public'
           AND tbl.relname IN ('profiles','communities','community_members','channels','messages')
       ), 'no indexes') AS observed;

-- 11) Confirma a presença das tabelas do Storage e dos papéis Supabase usados no ACL.
SELECT 'supabase_roles_and_storage' AS check_name,
       to_regclass('storage.buckets') IS NOT NULL
       AND to_regclass('storage.objects') IS NOT NULL
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AS passed,
       'storage.buckets/storage.objects + anon/authenticated/service_role' AS observed;

-- 12) Histórico remoto é apenas informativo; comparar com os cinco IDs esperados.
SELECT 'remote_migration_history' AS check_name,
       count(*) = 5 AS passed,
       string_agg(version || ':' || name, ', ' ORDER BY version) AS observed
FROM supabase_migrations.schema_migrations;


-- 13) Os nomes de índices/PK canônicos não podem estar ocupados por objetos
-- fora das cinco tabelas prototype (os índices do legado serão renomeados).
SELECT 'canonical_index_names_available' AS check_name,
       NOT EXISTS (
         SELECT 1 FROM pg_class idx
         JOIN pg_namespace ns ON ns.oid = idx.relnamespace
         WHERE ns.nspname = 'public'
           AND idx.relkind = 'i'
           AND idx.relname = ANY(ARRAY['channels_server_idx','dm_members_user_idx','email_codes_expires_idx','email_codes_lookup_idx','friendships_b_idx','message_reactions_msg_idx','messages_author_created_idx','messages_author_idx','messages_channel_created_idx','messages_thread_idx','profiles_username_lower_key','rate_hits_key_at_idx','server_events_srv_idx','server_invites_creator_idx','server_invites_server_idx','server_members_user_idx','servers_owner_idx','voice_members_user_idx','profiles_pkey','email_codes_pkey','servers_pkey','server_members_pkey','channels_pkey','messages_pkey','server_invites_pkey','dm_members_pkey','friendships_pkey','blocks_pkey','voice_members_pkey','server_bans_pkey','server_pins_pkey','mfa_recovery_pkey','message_reactions_pkey','server_events_pkey','event_interest_pkey']::text[])
           AND NOT EXISTS (
             SELECT 1 FROM pg_index ix
             JOIN pg_class tbl ON tbl.oid = ix.indrelid
             WHERE ix.indexrelid = idx.oid
               AND tbl.relname IN ('profiles','communities','community_members','channels','messages')
           )
       ) AS passed,
       COALESCE((
         SELECT string_agg(idx.relname, ', ')
         FROM pg_class idx
         JOIN pg_namespace ns ON ns.oid = idx.relnamespace
         WHERE ns.nspname = 'public' AND idx.relkind = 'i'
           AND idx.relname = ANY(ARRAY['channels_server_idx','dm_members_user_idx','email_codes_expires_idx','email_codes_lookup_idx','friendships_b_idx','message_reactions_msg_idx','messages_author_created_idx','messages_author_idx','messages_channel_created_idx','messages_thread_idx','profiles_username_lower_key','rate_hits_key_at_idx','server_events_srv_idx','server_invites_creator_idx','server_invites_server_idx','server_members_user_idx','servers_owner_idx','voice_members_user_idx','profiles_pkey','email_codes_pkey','servers_pkey','server_members_pkey','channels_pkey','messages_pkey','server_invites_pkey','dm_members_pkey','friendships_pkey','blocks_pkey','voice_members_pkey','server_bans_pkey','server_pins_pkey','mfa_recovery_pkey','message_reactions_pkey','server_events_pkey','event_interest_pkey']::text[])
       ), 'no collisions') AS observed;

-- 14) Nenhuma RPC/helper canônica pode sobrescrever funções preexistentes.
SELECT 'canonical_function_names_available' AS check_name,
       NOT EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE (n.nspname = 'public' AND p.proname = ANY(ARRAY['is_server_member','create_server','create_channel','create_invite','join_public_server','join_server','block_user','change_username','get_my_settings','my_age_group','open_dm','profiles_full','remove_friend','respond_dm_request','respond_friend_request','save_my_settings','send_friend_request','set_my_presence','unblock_user','unsubscribe_marketing','ban_member','create_event','delete_event','featured_servers','kick_member','list_bans','list_public_servers','my_plan','pin_server','set_server_public','toggle_event_interest','toggle_reaction','unban_member','voice_join','voice_leave','voice_ping','voice_set_state','get_auth_user_by_email','get_login_email_by_username','purge_user_data','rate_check','reactivate_account','revoke_user_sessions','verify_email_code']::text[]))
            OR (n.nspname = 'private' AND p.proname = ANY(ARRAY['accept_on_reply','dm_allowed','can_post','can_voice_topic','check_thread_parent','is_channel_member','is_channel_owner','is_dm_member','messages_rate_limit','remove_from_server','shares_server_with','touch_edited_at','touch_profile']::text[]))
       ) AS passed,
       COALESCE((
         SELECT string_agg(n.nspname || '.' || p.proname, ', ' ORDER BY n.nspname, p.proname)
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE (n.nspname = 'public' AND p.proname = ANY(ARRAY['is_server_member','create_server','create_channel','create_invite','join_public_server','join_server','block_user','change_username','get_my_settings','my_age_group','open_dm','profiles_full','remove_friend','respond_dm_request','respond_friend_request','save_my_settings','send_friend_request','set_my_presence','unblock_user','unsubscribe_marketing','ban_member','create_event','delete_event','featured_servers','kick_member','list_bans','list_public_servers','my_plan','pin_server','set_server_public','toggle_event_interest','toggle_reaction','unban_member','voice_join','voice_leave','voice_ping','voice_set_state','get_auth_user_by_email','get_login_email_by_username','purge_user_data','rate_check','reactivate_account','revoke_user_sessions','verify_email_code']::text[]))
            OR (n.nspname = 'private' AND p.proname = ANY(ARRAY['accept_on_reply','dm_allowed','can_post','can_voice_topic','check_thread_parent','is_channel_member','is_channel_owner','is_dm_member','messages_rate_limit','remove_from_server','shares_server_with','touch_edited_at','touch_profile']::text[]))
       ), 'no collisions') AS observed;

-- 15) Captura a definição exata do trigger e do handler antigo para documentar
-- o rollback; não altera nenhum objeto.
SELECT 'prototype_auth_trigger_definition' AS check_name,
       pg_get_triggerdef(t.oid, true) AS observed
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth' AND c.relname = 'users'
  AND t.tgname = 'on_auth_user_created_shiqi' AND NOT t.tgisinternal;

SELECT 'prototype_auth_trigger_function_definition' AS check_name,
       pg_get_functiondef('private.handle_new_user()'::regprocedure) AS observed;
