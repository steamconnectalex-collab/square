-- SHIQI — snapshot somente leitura para preparar rollback.
-- Executar ANTES do CUTOVER_DRAFT.sql e guardar o resultado fora do banco.
-- Não contém INSERT/UPDATE/DELETE/DDL e não expõe dados pessoais de usuários.

-- 1) Donos e privilégios de tabela das cinco tabelas prototype.
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE schemaname='public'
  AND tablename IN ('profiles','communities','community_members','channels','messages')
ORDER BY tablename;

SELECT table_name, grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('profiles','communities','community_members','channels','messages')
ORDER BY table_name, grantee, privilege_type;

-- 2) Privilégios por coluna (não são restaurados por REVOKE de tabela).
SELECT table_name, column_name, grantee, privilege_type, is_grantable
FROM information_schema.column_privileges
WHERE table_schema='public'
  AND table_name IN ('profiles','communities','community_members','channels','messages')
ORDER BY table_name, column_name, grantee, privilege_type;

-- 3) Policies RLS das tabelas antigas (permanecem anexadas aos OIDs após rename).
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('profiles','communities','community_members','channels','messages')
ORDER BY tablename, policyname;

-- 4) Triggers e definições exatas nas tabelas antigas e em auth.users.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       t.tgname, pg_get_triggerdef(t.oid, true) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal
  AND ((n.nspname='public' AND c.relname IN ('profiles','communities','community_members','channels','messages'))
       OR (n.nspname='auth' AND c.relname='users'))
ORDER BY n.nspname, c.relname, t.tgname;

SELECT pg_get_functiondef('private.handle_new_user()'::regprocedure) AS old_auth_handler;

-- 5) Índices e constraints do protótipo; usados para restaurar nomes após rollback.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname='public'
  AND tablename IN ('profiles','communities','community_members','channels','messages')
ORDER BY tablename, indexname;

SELECT c.relname AS table_name, con.conname, con.contype,
       pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('profiles','communities','community_members','channels','messages')
ORDER BY c.relname, con.conname;

-- 6) Estado exato da publicação Realtime e do Storage.
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname='supabase_realtime'
ORDER BY schemaname, tablename;

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
ORDER BY id;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
ORDER BY policyname;

-- 7) Histórico de migrations (não apagar manualmente).
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 8) Helpers privados do protótipo que devem continuar preservados.
SELECT p.proname, pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='private'
  AND p.proname IN (
    'handle_new_user','add_community_owner','is_community_admin',
    'is_community_member','set_updated_at'
  )
ORDER BY p.proname;
