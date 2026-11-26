# SHIQI — matriz funcional de paridade (primeira versão)

Data: 2026-11-26  
Branch: `shiqi-parallel-dev`  
Fonte de referência: cópia do frontend em `shiqi-parallel/apps/web/`, inventários `SCHEMA_DEPENDENCY_INVENTORY.md`, `REMOTE_SCHEMA_AUDIT.md`, `AUTH_CONTRACT_INVENTORY.md` e `COMPATIBILITY_AND_READINESS_AUDIT.md`.

## Objetivo e limites

Esta matriz não propõe novas funcionalidades. Ela registra o comportamento que já existe e que precisa ser preservado durante a migração. O frontend original é a referência de design e comportamento.

- Não alterar design, navegação, componentes, textos, espaçamentos ou interações sem autorização.
- Música está fora do escopo e não deve ser migrada.
- Login por QR está explicitamente fora desta atualização: não investigar, implementar, testar nem usar como critério de aceite. A existência de código legado na cópia não autoriza trabalhar nele.
- Não repetir o teste de voz com 10 participantes.
- Não alterar `main`, `site/`, `desktop/`, produção ou o Supabase original.
- Nenhuma migration ou Edge Function deve ser publicada no ambiente remoto sem revisão e autorização.

## Legenda de estado

- **No frontend**: a interface e a lógica cliente aparecem na cópia paralela.
- **Contrato conhecido**: a auditoria identificou tabela/RPC/regra no sistema original.
- **Bloqueado no paralelo**: o projeto Supabase paralelo ainda não tem estrutura/serviço compatível.
- **Pendente de prova**: falta teste de integração/regressão ou confirmação da operação real.
- **Fora do escopo**: decisão expressa do usuário.

## Matriz funcional

| Área | Comportamento existente a preservar | Dependências/contrato identificado | Situação da migração |
|---|---|---|---|
| Home pública | Landing page, navegação, chamadas para entrar e baixar o app | HTML gerado em `home.js`; páginas estáticas | No frontend; validar links e apresentação |
| Cadastro | E-mail, usuário, nome de exibição, senha, nascimento, marketing e aceite dos termos; validações e envio de código | Edge Function `/signup`, Auth, `profiles`, `email_codes`, rate limit | Contrato cliente identificado; backend paralelo é stub e está bloqueado |
| Verificação de e-mail | Código de seis caracteres, validade, reenvio e cooldown | `/verify`, `/resend`, `email_codes`, RPC `verify_email_code` | Bloqueado no paralelo |
| Login | E-mail ou usuário + senha; sessão, renovação e logout | `/login`, Supabase Auth, perfil e JWT | Bloqueado no paralelo |
| MFA | TOTP, códigos de recuperação, ativar/desativar e recuperação | `/login/totp`, `/mfa/recovery`, `/mfa/disable`, `mfa_recovery` | Contratos parcialmente documentados; backend paralelo bloqueado |
| Recuperação de senha | Solicitar código, reenviar e redefinir senha | `/forgot`, `/reset`, `email_codes`, revogação de sessões | Bloqueado no paralelo |
| Conta e e-mail | Trocar e-mail, senha, desativar e excluir conta; revogar sessões | Rotas de conta da função auth, Supabase Auth, `profiles`, storage e RPCs internas | A interface existe; backend e testes no paralelo pendentes |
| Perfil | Nome de usuário, nome de exibição, bio, status, cor/acento e avatar | `profiles`, RPC `change_username`, `profiles_full`, Storage `avatars` | Contrato original conhecido; schema paralelo incompatível |
| Presença | Online/ausente/ocupado/invisível e atualização de última atividade | `profiles.presence`, `last_seen`, RPC `set_my_presence` | Contrato conhecido; integração paralela pendente |
| Servidores | Criar, abrir, explorar públicos, entrar por convite, tornar público, fixar/favoritar e navegar | `servers`, `server_members`, `server_invites`, `server_pins`; RPCs de servidor | Bloqueado: tabelas equivalentes não existem no paralelo |
| Canais | Texto e voz, ordem, criação e navegação; canais DM | `channels` com `server_id` e `kind`; `create_channel` | Bloqueado: contrato atual paralelo usa campos diferentes |
| Membros e moderação | Lista de membros, expulsar, banir, listar banidos e desbanir | `server_members`, `server_bans`; RPCs `kick_member`, `ban_member`, `list_bans`, `unban_member` | Contrato original conhecido; backend paralelo pendente |
| Mensagens | Enviar, editar, apagar, histórico, paginação, não lidas, busca e menções | `messages` (ID bigint), RLS, triggers e limite 5/5s e 40/min | Bloqueado: tabela paralela tem ID UUID e colunas ausentes |
| Tempo real e digitação | Receber mensagens/alterações e indicador de digitação; reconexão/fallback | Supabase Realtime; publicação de `messages`; broadcast | Contrato conhecido; publicar/testar no paralelo pendente |
| Anexos | Enviar imagem, reduzir tamanho, legenda/alt e exibir anexo | `messages.attachment_path/attachment_alt`, Storage `attachments`, limite 3 MiB | Contrato conhecido; Storage e autorização no paralelo pendentes |
| Reações | Adicionar/remover emoji e exibir contagens | `message_reactions`, RPC `toggle_reaction(bigint,text)` | Bloqueado até schema de mensagens compatível |
| Tópicos/respostas | Criar e carregar respostas encadeadas e validar pai no mesmo canal | `messages.thread_of` bigint, trigger `check_thread_parent` | Bloqueado até schema compatível |
| Amigos | Enviar/aceitar/recusar/remover pedidos; notas e notificações | `friendships`, RPCs `send_friend_request`, `respond_friend_request`, `remove_friend` | Contrato conhecido; tabela ausente no paralelo |
| DMs | Abrir conversa, solicitações, aceitar/recusar e histórico privado | `channels` kind dm, `dm_members`, RPCs `open_dm`, `respond_dm_request` | Bloqueado: canal DM não suportado no schema paralelo atual |
| Bloqueios | Bloquear/desbloquear e impedir interação conforme regras atuais | `blocks`, RPCs `block_user`, `unblock_user`; regras DM | Tabela/RPC ausentes no paralelo |
| Voz | Entrar/sair, heartbeat, WebRTC P2P, mudo, ensurdecer, vídeo, tela e efeitos | `voice_members`, RPCs `voice_join/ping/leave/set_state`, Realtime privado | Contrato original conhecido; integração paralela pendente. Limite aprovado: 10 |
| Eventos | Criar, listar, excluir e marcar interesse | `server_events`, `event_interest`, RPCs `create_event`, `delete_event`, `toggle_event_interest` | SQL base de eventos incompleto; recuperar antes da migration |
| Configurações | Privacidade, DMs, amizade, notificações, voz/vídeo, aparência, acessibilidade, sistema, idioma e atividades | `profiles.settings`, `get_my_settings`, `save_my_settings`; preferências locais | Interface existe; validar quais opções persistem e quais são apenas locais |
| Loja e inventário | Loja, itens, editor/decoração de perfil, missões, pontos e Shiqi Plus | `loja.js`, `perfil.js`; parte do conteúdo aparenta ser estática/local; integrações de cobrança não comprovadas | Mapear comportamento atual; não inventar backend nem implementar pagamentos nesta etapa |
| GIFs e presentes | Ações e avisos de indisponibilidade existentes | UI indica “em breve”; serviço externo ainda não configurado | Preservar o estado atual; não implementar como nova funcionalidade |
| Notícias e jogos grátis | Cards/conteúdo na home/painel | Fonte atual e atualização real precisam ser verificadas | Pendente de classificar se é estático/demonstração; não ampliar escopo |
| Aplicativo para PC | Página de download e aplicativo Electron existente no projeto original | Diretório `desktop/` na raiz; cópia paralela não é o escopo atual de integração | Preservar; validar estratégia de apontamento só após site/backend estáveis |
| Termos e privacidade | Páginas legais e aceite no cadastro | `termos.html`, `privacidade.html`, `terms_accepted_at` | Arquivos existem; contato oficial e revisão jurídica são pendências de lançamento |
| QR login | Fluxo legado presente em arquivos da cópia | Não considerar dependência para esta atualização | **Fora do escopo por decisão do usuário** |
| Música | Player, playlists e favoritos legados | Tabelas/RPCs de música excluídas do escopo | **Fora do escopo por decisão do usuário** |

## Inventário técnico observado no frontend

### RPCs do app principal

`block_user`, `create_channel`, `create_event`, `create_invite`, `create_server`, `delete_event`, `join_public_server`, `join_server`, `list_bans`, `list_public_servers`, `open_dm`, `remove_friend`, `respond_dm_request`, `respond_friend_request`, `send_friend_request`, `set_my_presence`, `set_server_public`, `toggle_event_interest`, `toggle_reaction`, `unban_member`, `unblock_user`, `voice_join`, `voice_leave`, `voice_ping`, `voice_set_state`, além de `profiles_full`.

### RPCs das configurações

`get_my_settings`, `save_my_settings`, `change_username`, `my_age_group`, `unsubscribe_marketing`.

### Tabelas REST observadas no app principal

`blocks`, `channels`, `dm_members`, `event_interest`, `friendships`, `message_reactions`, `messages`, `profiles`, `server_events`, `server_members`, `servers`, `voice_members`.

### Contratos críticos já identificados

- `messages.id` e `thread_of` são bigint no original; não converter para UUID.
- Canais de DM usam `channels.server_id IS NULL` e `kind='dm'`.
- A tabela `profiles` está ligada a `auth.users`.
- `messages`, `friendships` e `voice_members` participam do Realtime original.
- Buckets originais: `avatars` (1 MiB) e `attachments` (3 MiB), com policies por pasta do usuário.
- A função original `voice_join` tem limite histórico de 6; o destino deve aplicar a exceção aprovada de 10, sem repetir o teste já feito pelo usuário.
- Funções SECURITY DEFINER e grants precisam de revisão individual; não copiar privilégios efetivos amplos automaticamente.

## Lacunas de validação desta matriz

1. A matriz foi montada por leitura estática do código e dos inventários existentes. Ainda não significa que cada botão/fluxo foi executado contra o backend paralelo.
2. O teste `tests/smoke.js` na raiz aponta para `../site` (site original), não para `shiqi-parallel/apps/web`. Precisamos criar/adaptar um harness de regressão isolado para a cópia paralela, sem alterar o teste original.
3. Ações de configurações com aviso “em breve”, conteúdos estáticos e recursos sem persistência precisam ser classificados por inspeção dos handlers antes de definir aceite.
4. O schema remoto paralelo tem somente `profiles`, `communities`, `community_members`, `channels`, `messages`, com contratos incompatíveis. Não conectar o app a esse schema antes do plano de compatibilidade.
5. Esta matriz deve ser revisada com as definições SQL completas e com os testes de contrato. Marcar item como concluído apenas após evidência verificável.

## Critério de aceite da etapa 1

A etapa 1 estará concluída quando:
- todas as telas e operações do frontend que permanecem no escopo estiverem mapeadas;
- cada operação estiver ligada a tabela/RPC/Storage/Realtime ou identificada claramente como local/estática;
- os itens sem backend ou com comportamento “em breve” estiverem explicitamente classificados;
- existir uma lista de testes de regressão correspondente;
- nenhuma tela ou funcionalidade tiver sido alterada nesta etapa.
