# SHIQI — baseline do snapshot pré-cutover

**Projeto:** `shiqi-parallel` (`ujdosskjycrdkcgsswfa`), região `sa-east-1`, PostgreSQL 17.12.0.002  
**Conexão:** `Primary`  
**Data da captura:** 2026-11-27  
**Método:** consultas SELECT independentes a partir de `docs/CUTOVER_SNAPSHOT.sql`; nenhuma alteração remota.

> Este relatório resume a captura real. Antes de qualquer cutover futuro, executar novamente o snapshot e arquivar a saída integral atualizada. Não executar o draft com base apenas neste resumo.

## Estado das tabelas e dados

- As cinco tabelas prototype existem e pertencem a `postgres`: `profiles`, `communities`, `community_members`, `channels`, `messages`.
- Todas as cinco tabelas têm zero linhas.
- `auth.users` tem zero linhas.
- Nenhuma sequence existe em `public`.

## ACLs capturadas

- Em cada uma das cinco tabelas, grants explícitos para `anon`, `authenticated`, `postgres` e `service_role`.
- `anon` e `authenticated`: `DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE`.
- `postgres` e `service_role`: os mesmos privilégios, mais `UPDATE`.
- Nenhum grant explícito a `PUBLIC` nas cinco tabelas.
- Grants por coluna para `authenticated` (13 no total):
  - `channels`: UPDATE em `channel_type, description, name, position`.
  - `communities`: UPDATE em `description, name, slug`.
  - `messages`: UPDATE em `content, edited_at`.
  - `profiles`: UPDATE em `avatar_url, bio, display_name, username`.
  - `community_members`: nenhuma ACL explícita por coluna.
- Schema `private`: owner `postgres`; USAGE somente para `authenticated`; sem USAGE para `anon`, `service_role` ou `PUBLIC`.
- Schema `public`: owner `pg_database_owner`; USAGE para `PUBLIC`, `anon`, `authenticated`, `postgres` e `service_role`; CREATE/USAGE para `pg_database_owner`.

## Policies, triggers e helpers

- Policies RLS prototype: 4 em `channels`, 4 em `communities`, 3 em `community_members`, 4 em `messages` e 3 em `profiles`.
- Triggers: `communities_add_owner`, `profiles_set_updated_at` e `auth.users.on_auth_user_created_shiqi`.
- Definição do trigger Auth: `AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user()`.
- Corpo integral do handler e definições dos helpers privados `add_community_owner`, `handle_new_user`, `is_community_admin`, `is_community_member`, `set_updated_at` foram consultados e retornaram sem erro.

## Índices e constraints

- 13 índices prototype capturados, incluindo os índices de PK/UNIQUE e índices auxiliares.
- Definições de constraints das cinco tabelas capturadas via `pg_constraint`; verifique a saída integral do snapshot arquivada junto à execução desta sessão antes de qualquer reversão.
- Os alvos de renome `legacy_*` estão livres e os nomes de índices truncados a 63 bytes não colidem, conforme preflight.

## Storage, Realtime e migrations

- Buckets Storage: nenhum.
- Policies em `storage.objects`: nenhuma.
- Policies em `realtime.messages`: nenhuma.
- Publicação `supabase_realtime`: somente `public.messages`.
- Histórico remoto: cinco migrations:
  - `20261126151154` — `shiqi_initial_community_chat_schema`
  - `20261126151224` — `shiqi_harden_rls_and_private_helpers`
  - `20261126151237` — `shiqi_optimize_profile_rls`
  - `20261126151300` — `shiqi_auth_profile_triggers`
  - `20261126151623` — `shiqi_tighten_column_permissions`

## Preflight e advisors

- `CUTOVER_PREFLIGHT.sql`: 18/18 checks booleanos passaram em 2026-11-27; as duas consultas adicionais de definição do trigger/handler também retornaram.
- Supabase Advisors: zero lints de segurança e zero lints de saúde.
- Performance: cinco avisos INFO de índices não utilizados nas tabelas prototype vazias; não são tratados como defeitos nem justificam remover índices.

## Limites

- A captura é do estado pré-cutover observado em 2026-11-27, não uma autorização para alterar o banco.
- Não foi executado `CUTOVER_DRAFT.sql`, rollback, DDL ou DML.
- O rollback ainda precisa de teste transacional em PostgreSQL isolado. A validação estática e a captura real não substituem esse teste.
