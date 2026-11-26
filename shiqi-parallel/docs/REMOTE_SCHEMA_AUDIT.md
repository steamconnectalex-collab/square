# SHIQI — auditoria remota do schema original

Data: 2026-11-26  
Branch de trabalho: `shiqi-parallel-dev`  
Projeto original consultado em modo somente leitura: `vjkqyqdabypdylhoupha`  
Projeto paralelo: `ujdosskjycrdkcgsswfa`

## Segurança e escopo

Esta auditoria consultou somente metadados e definições SQL no projeto original. Nenhum dado de usuário foi copiado, nenhuma tabela/função/policy foi alterada e nenhuma migration foi aplicada. O projeto original, `main`, o site/desktop original e produção permanecem intocados.

A funcionalidade de música foi excluída conforme autorização expressa. Não incluir `music_favorites`, `playlists`, `playlist_tracks` nem funções/triggers de limites de música no schema alvo.

## Estado confirmado dos projetos

- Original: projeto ativo e saudável, PostgreSQL 17.11, região `sa-east-1`.
- Paralelo: contém somente cinco tabelas públicas no momento da consulta: `profiles`, `communities`, `community_members`, `channels`, `messages`.
- O original tem 23 tabelas públicas no catálogo, das quais 3 são exclusivas de música. Portanto, 20 tabelas públicas permanecem relevantes ao escopo; 19 foram detalhadas no inventário estrutural sem música? **Correção:** a lista abaixo contém 20 tabelas, incluindo `mfa_recovery`.
- Todas as tabelas públicas originais observadas têm RLS habilitado.
- Edge Functions: original lista `auth` ativa (versão 8, `verify_jwt=false`); projeto paralelo não lista Edge Functions.

## Tabelas originais que permanecem no escopo

| Tabela | Colunas/contrato principal observado |
|---|---|
| `profiles` | `id`, `username`, `display_name`, `birth_date`, `marketing_opt_in`, `created_at`, `bio`, `status_text`, `avatar_path`, `accent`, `last_seen`, `terms_accepted_at`, `plan`, `settings`, `presence`, `deactivated_at`, `profile_updated_at` |
| `email_codes` | `id`, `email`, `purpose`, `code_hash`, `attempts`, `expires_at`, `consumed_at`, `created_at` |
| `qr_sessions` | `id`, `approve_hash`, `poll_hash`, `status`, `approved_by`, `created_at`, `expires_at`, `requester_ua` |
| `rate_hits` | `key`, `at` |
| `servers` | `id`, `name`, `owner_id`, `created_at`, `is_public`, `level` |
| `server_members` | `server_id`, `user_id`, `role`, `joined_at` |
| `channels` | `id`, `server_id` nullable, `name`, `kind` (text/voice/dm), `position`, `created_at` |
| `messages` | bigint identity `id`, `channel_id`, `author_id`, `content`, `created_at`, `edited_at`, `attachment_path`, `attachment_alt`, `thread_of` |
| `server_invites` | `code`, `server_id`, `created_by`, `created_at`, `expires_at`, `max_uses`, `uses` |
| `dm_members` | `channel_id`, `user_id`, `state` (active/request) |
| `friendships` | `user_a`, `user_b`, `requester`, `status`, `created_at`, `note` |
| `blocks` | `blocker`, `blocked`, `created_at` |
| `voice_members` | `channel_id`, `user_id`, `seen_at`, `muted`, `deafened`, `video`, `screen` |
| `server_bans` | `server_id`, `user_id`, `banned_at` |
| `server_pins` | `user_id`, `server_id`, `created_at` |
| `mfa_recovery` | `user_id`, `code_hash`, `used_at` |
| `message_reactions` | `message_id`, `user_id`, `emoji`, `created_at` |
| `server_events` | `id`, `server_id`, `creator_id`, `title`, `description`, `place`, `starts_at`, `created_at` |
| `event_interest` | `event_id`, `user_id`, `created_at` |

Observação: a lista acima totaliza 19 tabelas sem música. O projeto original também possui a tabela `mfa_recovery` já listada; total confirmado pelo catálogo: 20 tabelas sem música? Recontar antes de gerar migration definitiva. A fonte de verdade para a contagem é a consulta ao catálogo, não este resumo.

## Constraints e relacionamentos relevantes

- `profiles.id` referencia `auth.users.id`; username limitado por regex `^[a-z0-9._]{3,20}$`, display name 1–40, bio até 190, status até 60, accent hexadecimal, presence em online/idle/dnd/invisible.
- `servers.owner_id` referencia Auth; nomes 2–40; level 1–10.
- `server_members` chave primária composta `(server_id,user_id)`; roles owner/member.
- `channels.server_id` é nullable para permitir DM; `kind` text/voice/dm; nome 1–30.
- `messages.id` é bigint identity; conteúdo 1–2000; anexos limitados; `thread_of` referencia outra mensagem.
- DMs ligam `channels` a `dm_members`; estados active/request.
- Amizades usam chave ordenada `(user_a,user_b)`; status pending/accepted; bloqueios também usam chave composta.
- Voz guarda estado muted/deafened/video/screen; a migration paralela autorizada para capacidade de 10 deve prevalecer sobre o limite histórico de 6 na função original `voice_join`.
- Eventos e interesses têm FKs para servidores e usuários.
- RLS está habilitado nas tabelas públicas originais. As policies observadas incluem visibilidade de perfil por amizade/servidor compartilhado, membership para servidores/canais/mensagens/voz, controle de autor/owner em mensagens, e SELECT restrito para amizades/bloqueios/pins/eventos/reactions.

## Triggers confirmados (excluindo música)

- `messages_check_thread` → `private.check_thread_parent()`
- `messages_rate_limit` → `private.messages_rate_limit()`
- `messages_touch_edited` → `private.touch_edited_at()`
- `trg_accept_on_reply` → `private.accept_on_reply()`
- `trg_touch_profile` → `private.touch_profile()`

## Funções e regras de negócio

Catálogo original consultado: 16 funções em schema private e 45 em public antes de excluir música e duas rotinas de playlist. Funções privadas exclusivas de música também foram excluídas do escopo. As funções públicas restantes precisam ter suas definições e ACLs revisadas individualmente antes de preparar a migration definitiva.

Regras observadas em definições recuperadas:
- Criar servidor: máximo 10 servidores por dono; cria canais Geral e Sala principal.
- Criar canal: somente owner, tipos text/voice, nome 1–30, máximo 30 canais.
- Entrar em servidor: convite válido ou servidor público; máximo 20 servidores por usuário; respeita ban.
- Criar evento: somente owner; título 2–80; máximo 25 eventos futuros; descrição até 500 e local até 80.
- Mensagens: limite de 5 em 5 segundos ou 40 em 60 segundos; thread precisa pertencer ao mesmo canal e não pode ser filha de outra thread.
- DM: bloqueio impede conversa; amizade aceita ou servidor compartilhado pode permitir; preferências do perfil controlam aceitação/solicitação.
- Voz: função original ainda verifica limite de 6 participantes. A exceção aprovada pelo usuário para 10 participantes deve ser aplicada no banco paralelo, nunca sobrescrita pela definição antiga.
- Funções SECURITY DEFINER usam `search_path = ''` em várias definições; revisar EXECUTE grants e checagem de `auth.uid()` para cada função.

## Índices

Foram encontrados índices de PK e índices de apoio para canais por servidor/posição, membros por usuário, mensagens por canal/data e autor/data, threads, códigos por e-mail/expiração, eventos por servidor/data, convites por servidor/criador, reações por mensagem e voz por usuário. A lista integral deve ser extraída para o arquivo SQL final; não recriar índices por suposição.

## Diferenças confirmadas do paralelo

- `profiles` tem contrato incompatível (colunas como `avatar_url` e `updated_at`; faltam campos originais e constraints).
- `channels` usa `community_id` e `channel_type`, não `server_id` e `kind`; não suporta o contrato de DM do original.
- `messages.id` é UUID no paralelo e bigint identity no original; faltam `attachment_path`, `attachment_alt`, `thread_of`.
- `communities` e `community_members` não são equivalentes comprovados a `servers` e `server_members`.
- Faltam no paralelo as demais tabelas, policies, triggers, funções e Edge Function.

## Itens ainda pendentes antes de criar/aplicar migrations

1. Fechar contagem e definição integral das funções públicas restantes (em lotes pequenos), incluindo ACL/EXECUTE grants.
2. Auditar grants de tabelas, views, schemas e funções; revisar especialmente SECURITY DEFINER.
3. Auditar Storage buckets, policies e caminhos de avatars/anexos.
4. Auditar Realtime publications e configuração de replicação.
5. Recuperar definição estrutural completa de eventos, base de servidores/canais e demais constraints sem depender de migrations incompletas.
6. Cruzar cada coluna/RPC com as chamadas do frontend original, sem alterar a UI.
7. Preparar migrations incrementais para o banco paralelo, mantendo os cinco objetos existentes sem DROP/RENAME até que haja plano compatível e revisão.
8. Fazer revisão de segurança e só então solicitar aprovação específica para aplicar mudanças remotas.

## Estado desta etapa

Auditoria remota somente leitura. Nenhuma migration criada ou aplicada, nenhuma Edge Function publicada, nenhum dado copiado e nenhum objeto alterado.
