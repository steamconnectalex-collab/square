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
- O inventário detalhado retornado pela consulta ao catálogo lista 22 tabelas públicas no total: 19 permanecem no escopo e 3 são exclusivas de música.
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

A lista acima contém as 19 tabelas sem música identificadas no inventário remoto. Antes da migration definitiva, a contagem será reconfirmada diretamente no catálogo e cruzada com o inventário de dependências do frontend.

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


## Storage e Realtime — consulta complementar

### Buckets originais

| Bucket | Público | Limite | MIME permitidos |
|---|---:|---:|---|
| `attachments` | sim | 3 MiB | JPEG, PNG, WebP, GIF |
| `avatars` | sim | 1 MiB | JPEG, PNG, WebP |

Policies de `storage.objects` observadas:
- `attachments`: SELECT, INSERT e DELETE apenas no primeiro nível de pasta igual ao UUID do usuário autenticado.
- `avatars`: SELECT, INSERT, DELETE e UPDATE apenas no primeiro nível de pasta igual ao UUID do usuário autenticado.
- Não foi encontrada policy de UPDATE para `attachments`.
- A leitura pública dos arquivos decorre da configuração dos buckets públicos; as policies acima continuam definindo as operações autenticadas.

### Realtime

A publicação `supabase_realtime` inclui exatamente:
- `public.friendships`
- `public.messages`
- `public.voice_members`

O paralelo precisa reproduzir essa publicação para manter o comportamento em tempo real que o frontend espera. Não habilitar indiscriminadamente todas as tabelas.

## Auditoria de permissões das funções

Consulta de privilégios efetivos confirmou que as funções públicas de aplicação (por exemplo, `create_server`, `open_dm`, `voice_join`, `toggle_reaction`) são executáveis por `authenticated`, não por `anon`. Funções internas de backend como `purge_user_data`, `rate_check`, `verify_email_code`, `revoke_user_sessions`, `get_auth_user_by_email` e `get_login_email_by_username` são executáveis por `service_role`, não por `authenticated`.

**Ponto de segurança a revisar antes de replicar:** a consulta de privilégios efetivos também indicou execução por `anon` em algumas funções do schema `private`, incluindo `private.dm_allowed` e `private.is_dm_member`. Isso pode decorrer de grants herdados via PUBLIC. Não alterei o original. Antes de copiar as permissões, precisamos confirmar ACLs explícitas e decidir grants mínimos no destino. Funções de trigger aparecem com execução efetiva ampla, mas não devem ser expostas como RPC de aplicação.

## Contagem corrigida

O catálogo original retornou 22 tabelas públicas no total: 19 tabelas fora da funcionalidade de música e 3 tabelas de música (`music_favorites`, `playlists`, `playlist_tracks`). Todas as 22 têm RLS habilitado. O paralelo contém cinco tabelas públicas com RLS habilitado, mas seus contratos não são equivalentes ao original.


## Contrato estrutural detalhado (extração de colunas)

A consulta direta a `information_schema.columns` recuperou tipos, nulabilidade, defaults e identidade das 19 tabelas fora de música. Pontos críticos para a migration:
- `messages.id` é `bigint GENERATED ... AS IDENTITY`, não UUID; `message_reactions.message_id` e `messages.thread_of` também são bigint.
- `channels.server_id` aceita NULL exclusivamente para canais DM; constraint `channels_dm_shape` liga esse estado a `kind='dm'`.
- `profiles.id`, `servers.owner_id`, membros, amizades, bloqueios, bans, pins, eventos, MFA e presença referenciam identidades do Supabase Auth.
- `messages.author_id` e `server_pins.user_id` usam `auth.uid()` como default.
- `email_codes` guarda somente hash do código, tentativas, validade e consumo; nunca armazenar código em texto puro.
- `qr_sessions` guarda hashes separados para aprovação e polling, além do status e expiração.
- `rate_hits` é armazenamento de janela de rate limit.
- `server_invites` tem validade padrão de 7 dias, máximo padrão de 50 usos e contador.
- `profiles.settings` é JSONB e controla preferências de DM, compartilhamento de perfil e outros ajustes.

## Restrições de integridade recuperadas

Constraints funcionais confirmadas no catálogo (além de PK/FK/NOT NULL):
- `blocks`: usuário não pode bloquear a si mesmo.
- `channels`: kind limitado a text/voice/dm; nome 1–30; forma de DM exige `server_id IS NULL` se `kind='dm'`, e servidor não nulo para os outros tipos.
- `dm_members`: state active/request.
- `email_codes`: purpose signup/reset/change.
- `friendships`: ordenação `user_a < user_b`; requester deve ser um dos dois; status limitado; note até 120 caracteres.
- `messages`: conteúdo e metadados de anexo limitados por constraints; preservar bigint identity e relação de thread.
- `profiles`: username, display name, bio, status, accent, plan e presence validados por constraints; preservar todos os checks exatos ao criar migration.
- `server_events`: título 2–80, descrição até 500 e local até 80.
- `servers`: nome 2–40 e level 1–10.
- `server_members`: role owner/member.
- `voice_members`: chave composta por canal/usuário e estados booleanos de áudio/vídeo/tela.

A listagem integral de constraints inclui entradas internas de NOT NULL e repetições por coluna em PK/FK, portanto não deve ser copiada diretamente como SQL. As constraints funcionais nomeadas e as definições de PK/FK serão reconstruídas de forma normalizada em migration revisada.


## Inventário integral das funções — consulta complementar

A extração direta de `pg_get_functiondef` foi concluída em lotes pequenos no projeto original. O inventário fora de música contém 13 funções em `private` e 45 em `public`. As definições preservam `SECURITY DEFINER` e `search_path = ''` onde indicado no original; não basta recriar apenas nomes e assinaturas.

### Funções privadas (13)

- Triggers: `accept_on_reply()`, `check_thread_parent()`, `messages_rate_limit()`, `touch_edited_at()`, `touch_profile()`.
- Autorização/membership: `can_post(uuid)`, `can_voice_topic(text)`, `dm_allowed(uuid,uuid)`, `is_channel_member(uuid)`, `is_channel_owner(uuid)`, `is_dm_member(uuid)`, `shares_server_with(uuid)`.
- Moderação: `remove_from_server(uuid,uuid,boolean)`.

### Funções públicas (45)

`ban_member`, `block_user`, `change_username`, `create_channel`, `create_event`, `create_invite`, `create_server`, `delete_event`, `featured_servers`, `get_auth_user_by_email`, `get_login_email_by_username`, `get_my_settings`, `is_server_member`, `join_public_server`, `join_server`, `kick_member`, `list_bans`, `list_public_servers`, `my_age_group`, `my_plan`, `open_dm`, `pin_server`, `profiles_full`, `purge_user_data`, `rate_check`, `reactivate_account`, `remove_friend`, `respond_dm_request`, `respond_friend_request`, `revoke_user_sessions`, `save_my_settings`, `send_friend_request(text)`, `send_friend_request(text,text)`, `set_my_presence`, `set_server_public`, `toggle_event_interest`, `toggle_reaction(bigint,text)`, `unban_member`, `unblock_user`, `unsubscribe_marketing`, `verify_email_code`, `voice_join`, `voice_leave`, `voice_ping`, `voice_set_state`.

As duas funções públicas de playlist e as três funções privadas de limite de música não entram na migration. A definição original de `voice_join` tem limite 6; a migration específica aprovada para o paralelo deve alterar para 10.

### ACLs efetivas observadas

A consulta de privilégios efetivos no catálogo, excluídas as cinco funções de música, retornou:

| Schema | Funções | SECURITY DEFINER | EXECUTE anon | EXECUTE authenticated | EXECUTE service_role |
|---|---:|---:|---:|---:|---:|
| private | 13 | 12 | 7 | 12 | 7 |
| public | 45 | 45 | 0 | 39 | 45 |

Esses números são privilégios efetivos (incluem herança/PUBLIC), não uma lista de grants explícitos. O paralelo não deve reproduzir automaticamente permissões amplas: é necessário reconstruir grants mínimos por assinatura e separar RPCs de usuário das rotinas internas de backend. Em particular, funções privadas com execução efetiva por `anon` exigem revisão individual; funções públicas de backend como `purge_user_data`, `rate_check`, `verify_email_code`, `revoke_user_sessions`, `get_auth_user_by_email` e `get_login_email_by_username` não devem ser expostas ao cliente.

## Edge Function auth — versão atualmente implantada

A leitura direta do projeto original confirmou a função `auth` ativa, versão 9, com `verify_jwt=false`, contendo os arquivos `index.ts` (30.424 caracteres) e `mail.ts` (7.951 caracteres). Esta é a versão implantada no momento da auditoria; a migration deve manter os contratos e os templates de e-mail, apenas adequando a marca SHIQI onde necessário.

**Divergência importante a resolver:** a versão 9 recuperada do Supabase não contém rotas `/qr/create`, `/qr/poll`, `/qr/info` ou `/qr/approve` no código-fonte de `index.ts`, apesar de essas chamadas constarem no inventário do frontend previamente analisado. Não assumir que QR login está operacional nem inventar endpoints na migração: precisamos localizar a implementação real no código original ou confirmar se o recurso foi desativado.

A função implantada usa Supabase Auth Admin e cliente anon, funções RPC internas, códigos por e-mail com HMAC-SHA256, verificação TOTP e códigos de recuperação, limite de tentativas e Resend. Não foram alteradas secrets, templates, endpoints nem a função remota.

## Próximo passo técnico

Com as definições SQL recuperadas, a próxima etapa é comparar cada RPC/tabela/coluna com as chamadas reais no frontend original e com as rotas da Edge Function, depois montar um plano de migrations incrementais para o banco paralelo. O banco paralelo ainda tem cinco tabelas incompatíveis; nenhuma delas será apagada ou renomeada nesta fase. Nenhuma migration remota foi aplicada.


### Resultado do rastreamento do QR no repositório original

A busca no código original confirmou que `site/app.js` realmente chama:
- `POST /qr/create` ao abrir o painel QR no login;
- `POST /qr/poll` a cada 2 segundos para acompanhar o status;
- `POST /qr/info` no dispositivo que vai aprovar;
- `POST /qr/approve` para aceitar ou negar.

A lista completa de Edge Functions do projeto original, porém, contém somente `auth`; não existe uma Edge Function separada chamada `qr`. O arquivo de testes `tests/smoke.js` simula respostas dessas rotas, mas isso não comprova que o backend real as implementa. Portanto, QR login é uma dependência real da interface, mas sua implementação remota não foi localizada nesta auditoria. O recurso precisa ser tratado como pendência funcional de alta prioridade, e não removido nem considerado operacional. Não alterei o frontend.


## Extração de definições SQL em lotes — 26/11/2026

A extração que antes excedia o limite de saída foi refeita em consultas pequenas, diretamente em `pg_get_functiondef`, no projeto original e somente com SELECT. Foram recuperadas sem truncamento as definições das **13 funções privadas e 45 assinaturas públicas** do escopo (incluindo as duas sobrecargas de `send_friend_request`). O conjunto consultado excluiu música. QR não foi pesquisado nesta retomada, conforme a decisão de escopo vigente.

Grupos cujos corpos foram recuperados:
- Privadas: helpers de autorização e membership (`can_post`, `can_voice_topic`, `dm_allowed`, `is_channel_member`, `is_channel_owner`, `is_dm_member`, `shares_server_with`), triggers (`accept_on_reply`, `check_thread_parent`, `messages_rate_limit`, `touch_edited_at`, `touch_profile`) e moderação (`remove_from_server`).
- Públicas: criação e entrada em servidores/canais/convites; exploração, destaque e fixação; amizades, bloqueios e DMs; moderação; eventos; perfil, presença e configurações; reações; voz; e rotinas internas de autenticação/limite de tentativas.

### Regras e pontos de atenção confirmados nos corpos

- `create_server`: limite de 10 por proprietário; cria associação owner e canais Geral/Sala principal.
- `create_channel`: somente proprietário; tipos text/voice; nome até 30; máximo 30 canais.
- `join_server` e `join_public_server`: limite de 20 servidores por usuário e respeito a banimentos.
- `create_invite`: gera código aleatório; a validade e máximo de usos são defaults/constraints da tabela.
- `send_friend_request`: verifica bloqueios, preferências de recebimento, amigos em comum/servidor compartilhado e limite de pedidos pendentes.
- `open_dm`: exige amizade aceita ou servidor compartilhado; respeita bloqueios e preferências de DM, podendo criar estado request.
- `toggle_reaction`: requer permissão para postar no canal, limita emoji a 16 caracteres e até 20 emojis distintos por mensagem.
- `create_event`: somente proprietário, título 2–80, descrição até 500, local até 80, até 25 eventos futuros.
- `voice_set_state`: ensurdecer força microfone mutado.
- **Exceção obrigatória do destino:** a função viva original `voice_join` limita a 6 participantes. A branch paralela tem decisão aprovada de 10; a futura definição do destino deve usar 10, não copiar o limite 6.
- Rotinas internas como `purge_user_data`, `rate_check`, `verify_email_code`, `revoke_user_sessions`, `get_auth_user_by_email` e `get_login_email_by_username` não devem receber EXECUTE público/anon por conveniência; grants serão definidos individualmente.

A extração dos corpos está completa para o inventário listado. Ainda falta transformar os corpos e os metadados exatos em migrations revisadas e cruzá-los com policies, constraints, índices, grants e chamadas frontend. **Isso não significa que o schema esteja pronto.**

Nenhuma tabela, função, policy, grant, trigger, bucket, publicação Realtime, usuário, dado ou Edge Function foi alterado. Nenhum DDL foi executado.


## RLS, constraints e privilégios — extração complementar (26/11/2026)

### Policies RLS recuperadas

Policies públicas encontradas no original (todas permissive e direcionadas a `authenticated`):
- `profiles`: SELECT do próprio perfil ou perfil ativo de pessoa com servidor compartilhado; UPDATE apenas do próprio perfil, com `USING` e `WITH CHECK`.
- `servers` e `server_members`: SELECT apenas para membro do servidor.
- `channels`: SELECT se membro do servidor ou membro da DM.
- `messages`: SELECT para membro do canal; INSERT exige autor igual a `auth.uid()` e `private.can_post`; UPDATE somente autor, com verificação de canal no `WITH CHECK`; DELETE pelo autor ou proprietário do servidor.
- `friendships`: SELECT apenas se usuário participa da relação.
- `blocks`: SELECT apenas de bloqueios feitos pelo usuário.
- `dm_members`: SELECT do próprio registro ou de participantes da mesma DM.
- `voice_members`: SELECT por membro do canal.
- `server_pins`: SELECT próprio.
- `message_reactions`: SELECT se a mensagem pertence a canal visível.
- `server_events` e `event_interest`: SELECT para membros do servidor correspondente.
- Não foram encontradas policies públicas nas tabelas internas `email_codes`, `rate_hits`, `server_invites`, `server_bans` e `mfa_recovery`; seu acesso é mediado por rotinas privilegiadas.

### Constraints recuperadas

A consulta a `pg_constraint` recuperou as definições funcionais e PK/FK, sem os pseudo-checks internos de NOT NULL. Foram confirmados, entre outros:
- `profiles`: username 3–20 e regex minúscula; display_name 1–40; bio até 190; status até 60; accent hexadecimal; presence em online/idle/dnd/invisible; settings JSON object com limite de tamanho; avatar_path até 200.
- `channels`: kind text/voice/dm, nome 1–30, formato DM exige `server_id IS NULL`; FK para servers com cascade.
- `messages`: conteúdo 1–2000 após trim; attachment_path até 200; attachment_alt até 300; thread_of referencia messages; ID bigint identity ALWAYS.
- `friendships`: user_a < user_b; requester precisa ser uma das pessoas; status pending/accepted; note até 120.
- `dm_members`: state active/request.
- `blocks`: blocker diferente de blocked.
- `servers`: nome 2–40 e level 1–10.
- `server_invites`: validade padrão 7 dias, max_uses 50 e uses 0.
- `message_reactions`: emoji de 1–16 caracteres.
- `server_events`: título 2–80, descrição até 500, place até 80.
- PK/FKs das 18 tabelas-alvo foram recuperadas, incluindo cascades para Auth, canais, servidores, mensagens e eventos. Os tipos/defaults/nulabilidade das colunas também foram consultados em três lotes; `messages.id` é `bigint GENERATED ALWAYS AS IDENTITY`.

### Grants de tabelas observados no original

- Nenhum grant direto de tabela para `anon` apareceu na consulta de `information_schema.role_table_grants`.
- `authenticated` tem SELECT nas tabelas de leitura direta protegidas por RLS e DELETE em `messages`; INSERT/UPDATE de negócio são mediados por policies/RPCs conforme cada tabela.
- `service_role` e `postgres` têm privilégios administrativos nas tabelas.
- A futura migration deve começar por revogar defaults amplos e conceder apenas o necessário; não copiar grants amplos do protótipo paralelo.

A extração de policies, constraints, colunas e grants foi feita somente por SELECT. Não houve alteração no banco original ou paralelo.
