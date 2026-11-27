-- SHIQI — verificações pós-migration (somente SELECT).
-- Executar no projeto paralelo após aplicar a migration aprovada.
-- Cada linha deve retornar true/valor esperado; não altera dados.

WITH expected(table_name) AS (
  VALUES
  ('profiles'),('email_codes'),('rate_hits'),('servers'),('server_members'),
  ('channels'),('messages'),('server_invites'),('dm_members'),('friendships'),
  ('blocks'),('voice_members'),('server_bans'),('server_pins'),('mfa_recovery'),
  ('message_reactions'),('server_events'),('event_interest')
)
SELECT 'canonical_tables_present' AS check_name,
       count(*) = 18 AS passed,
       count(*)::text || '/18' AS observed
FROM expected e
JOIN information_schema.tables t
  ON t.table_schema='public' AND t.table_type='BASE TABLE' AND t.table_name=e.table_name;

WITH expected(table_name) AS (
  VALUES
  ('profiles'),('email_codes'),('rate_hits'),('servers'),('server_members'),
  ('channels'),('messages'),('server_invites'),('dm_members'),('friendships'),
  ('blocks'),('voice_members'),('server_bans'),('server_pins'),('mfa_recovery'),
  ('message_reactions'),('server_events'),('event_interest')
)
SELECT 'rls_enabled_all_canonical' AS check_name,
       count(*) = 18 AND bool_and(c.relrowsecurity) AS passed,
       count(*) FILTER (WHERE c.relrowsecurity)::text || '/18 RLS' AS observed
FROM expected e
JOIN pg_class c ON c.oid = to_regclass('public.' || e.table_name);

SELECT 'canonical_policy_count' AS check_name,
       count(*) = 17 AS passed, count(*)::text || '/17' AS observed
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN (
    'profiles','email_codes','rate_hits','servers','server_members','channels',
    'messages','server_invites','dm_members','friendships','blocks','voice_members',
    'server_bans','server_pins','mfa_recovery','message_reactions','server_events','event_interest'
  );

SELECT 'function_inventory' AS check_name,
       (count(*) FILTER (WHERE n.nspname='public') = 45
        AND count(*) FILTER (WHERE n.nspname='private') = 13) AS passed,
       'public=' || count(*) FILTER (WHERE n.nspname='public')::text ||
       ', private=' || count(*) FILTER (WHERE n.nspname='private')::text AS observed
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='public' AND p.proname IN (
  'ban_member','block_user','change_username','create_channel','create_event',
  'create_invite','create_server','delete_event','featured_servers','get_my_settings',
  'get_auth_user_by_email','get_login_email_by_username','is_server_member',
  'join_public_server','join_server','kick_member','list_bans','list_public_servers',
  'my_age_group','my_plan','open_dm','pin_server','profiles_full','purge_user_data',
  'rate_check','reactivate_account','remove_friend','respond_dm_request',
  'respond_friend_request','revoke_user_sessions','save_my_settings',
  'send_friend_request','set_my_presence','set_server_public','toggle_event_interest',
  'toggle_reaction','unban_member','unblock_user','unsubscribe_marketing',
  'verify_email_code','voice_join','voice_leave','voice_ping','voice_set_state'
))
OR (n.nspname='private' AND p.proname IN (
  'accept_on_reply','can_post','can_voice_topic','check_thread_parent','dm_allowed',
  'is_channel_member','is_channel_owner','is_dm_member','messages_rate_limit',
  'remove_from_server','shares_server_with','touch_edited_at','touch_profile'
));

SELECT 'storage_buckets' AS check_name,
       count(*) = 2 AS passed, count(*)::text AS observed
FROM storage.buckets
WHERE id IN ('avatars','attachments');

SELECT 'realtime_tables' AS check_name,
       count(*) = 3 AND
       bool_and(tablename IN ('friendships','messages','voice_members')) AS passed,
       string_agg(tablename, ', ' ORDER BY tablename) AS observed
FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND schemaname='public';

-- Trigger Auth prototype deve estar ausente: a Edge Function v10 cria o perfil explicitamente.
SELECT 'no_auth_profile_trigger' AS check_name,
       NOT EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgrelid='auth.users'::regclass
           AND NOT tgisinternal
           AND tgname='on_auth_user_created_shiqi'
       ) AS passed;

-- O escopo do produto não deve recriar música nem QR.
SELECT 'excluded_objects_absent' AS check_name,
       NOT EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relkind IN ('r','v','m')
           AND c.relname IN ('music_favorites','playlists','playlist_tracks','qr_sessions')
       ) AS passed;
