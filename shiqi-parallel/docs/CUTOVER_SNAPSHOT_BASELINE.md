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
- Definições das 24 constraints das cinco tabelas foram capturadas via `pg_constraint` e estão resumidas no apêndice abaixo; repetir a captura integral imediatamente antes de qualquer cutover futuro.
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



## Apêndice — definições exatas capturadas

### Índices

- `channels`
  - `channels_community_id_name_key`: UNIQUE BTREE (`community_id, name`)
  - `channels_community_position_idx`: BTREE (`community_id, position`)
  - `channels_pkey`: UNIQUE BTREE (`id`)
- `communities`
  - `communities_owner_idx`: BTREE (`owner_id`)
  - `communities_pkey`: UNIQUE BTREE (`id`)
  - `communities_slug_key`: UNIQUE BTREE (`slug`)
- `community_members`
  - `community_members_pkey`: UNIQUE BTREE (`community_id, user_id`)
  - `community_members_user_idx`: BTREE (`user_id`)
- `messages`
  - `messages_author_idx`: BTREE (`author_id`)
  - `messages_channel_created_idx`: BTREE (`channel_id, created_at DESC`)
  - `messages_pkey`: UNIQUE BTREE (`id`)
- `profiles`
  - `profiles_pkey`: UNIQUE BTREE (`id`)
  - `profiles_username_key`: UNIQUE BTREE (`username`)

### Constraints

- `channels`: `channels_channel_type_check` CHECK (`channel_type IN ('text','voice')`); `channels_community_id_fkey` FOREIGN KEY (`community_id`) REFERENCES `communities(id)` ON DELETE CASCADE; `channels_community_id_name_key` UNIQUE (`community_id,name`); `channels_description_check` CHECK (`char_length(description) <= 300`); `channels_name_check` CHECK (`char_length(name) BETWEEN 1 AND 80`); `channels_pkey` PRIMARY KEY (`id`).
- `communities`: `communities_description_check` CHECK (`char_length(description) <= 500`); `communities_name_check` CHECK (`char_length(name) BETWEEN 2 AND 80`); `communities_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `auth.users(id)` ON DELETE RESTRICT; `communities_pkey` PRIMARY KEY (`id`); `communities_slug_check` CHECK (`slug ~ '^[a-z0-9-]{3,50}

- A captura é do estado pré-cutover observado em 2026-11-27, não uma autorização para alterar o banco.
- Não foi executado `CUTOVER_DRAFT.sql`, rollback, DDL ou DML.
- O rollback ainda precisa de teste transacional em PostgreSQL isolado. A validação estática e a captura real não substituem esse teste.
`); `communities_slug_key` UNIQUE (`slug`).
- `community_members`: `community_members_community_id_fkey` FOREIGN KEY (`community_id`) REFERENCES `communities(id)` ON DELETE CASCADE; `community_members_pkey` PRIMARY KEY (`community_id,user_id`); `community_members_role_check` CHECK (`role IN ('owner','admin','member')`); `community_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `auth.users(id)` ON DELETE CASCADE.
- `messages`: `messages_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `auth.users(id)` ON DELETE RESTRICT; `messages_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `channels(id)` ON DELETE CASCADE; `messages_content_check` CHECK (`char_length(content) >= 1 AND char_length(content) <= 10000`); `messages_pkey` PRIMARY KEY (`id`).
- `profiles`: `profiles_id_fkey` FOREIGN KEY (`id`) REFERENCES `auth.users(id)` ON DELETE CASCADE; `profiles_pkey` PRIMARY KEY (`id`); `profiles_username_format` CHECK (`username IS NULL OR username ~ '^[a-zA-Z0-9_]{3,24}

- A captura é do estado pré-cutover observado em 2026-11-27, não uma autorização para alterar o banco.
- Não foi executado `CUTOVER_DRAFT.sql`, rollback, DDL ou DML.
- O rollback ainda precisa de teste transacional em PostgreSQL isolado. A validação estática e a captura real não substituem esse teste.
`); `profiles_username_key` UNIQUE (`username`).

### Triggers

- `auth.users.on_auth_user_created_shiqi`: AFTER INSERT ON `auth.users` FOR EACH ROW EXECUTE FUNCTION `private.handle_new_user()`.
- `public.communities_add_owner`: AFTER INSERT ON `public.communities` FOR EACH ROW EXECUTE FUNCTION `private.add_community_owner()`.
- `public.profiles_set_updated_at`: BEFORE UPDATE ON `public.profiles` FOR EACH ROW EXECUTE FUNCTION `private.set_updated_at()`.

A definição integral de `private.handle_new_user()` foi consultada no catálogo e retornou sem erro; ela também pode ser recuperada antes de qualquer operação a partir do estado original, desde que o cutover ainda não tenha sido executado. Este apêndice preserva a assinatura/trigger e as definições de índices e constraints observadas.

## Limites

- A captura é do estado pré-cutover observado em 2026-11-27, não uma autorização para alterar o banco.
- Não foi executado `CUTOVER_DRAFT.sql`, rollback, DDL ou DML.
- O rollback ainda precisa de teste transacional em PostgreSQL isolado. A validação estática e a captura real não substituem esse teste.
