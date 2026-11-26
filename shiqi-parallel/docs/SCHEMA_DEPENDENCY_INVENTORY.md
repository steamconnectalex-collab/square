# Shiqi — inventário de dependências do schema

Data da auditoria: 2026-11-26  
Branch: `shiqi-parallel-dev`  
Escopo: leitura do frontend original em `main/site`, migrations versionadas em `shiqi-parallel/supabase/migrations` e schema remoto do projeto paralelo `ujdosskjycrdkcgsswfa`.

## Regras de segurança desta preparação

- O aplicativo original em `main/site`, `main/desktop` e a produção permanecem intocados.
- Nenhuma migration foi aplicada nesta auditoria.
- Nenhum usuário, dado pessoal, segredo ou chave de produção foi copiado.
- O banco paralelo já contém tabelas com nomes e contratos diferentes; não aplicar migrations antigas em lote.
- Não publicar Edge Function nem deploy Vercel nesta etapa.
- A interface, os fluxos e as funcionalidades originais são a referência obrigatória; nenhuma alteração visual/funcional é autorizada por este inventário.

## Estado remoto observado no projeto paralelo

Tabelas públicas observadas (todas com RLS habilitado, zero linhas):
- `profiles`
- `communities`
- `community_members`
- `channels`
- `messages`

O schema remoto é um protótipo de comunidades/canais e não representa o modelo original completo de servidores, amizades, DMs, música, eventos, reações e voz.

## Dependências de tabelas do frontend original

Referências REST estáticas encontradas em `site/app.js` e `site/settings-pages.js`:

| Recurso | Tabelas/objetos lidos ou escritos |
|---|---|
| Servidores e canais | `servers`, `server_members`, `channels` |
| Mensagens | `messages` |
| Perfil e presença | `profiles` |
| Amizades | `friendships` |
| Mensagens diretas | `channels` com kind `dm`, `dm_members` |
| Bloqueios | `blocks` |
| Presença de voz | `voice_members` |
| Eventos | `server_events`, `event_interest` |
| Reações | `message_reactions` |
| Histórico de música/configurações | `music_favorites`, `playlists`, `playlist_tracks` |

As tabelas acima são dependências observadas no código ou explicitamente descritas nas migrations. O inventário ainda precisa ser cruzado com todos os arquivos/scripts e fluxos de UI para confirmar campos, filtros e operações de cada uma.

## RPCs identificadas no frontend

Chamadas encontradas no código:
- Perfil/conta: `profiles_full`, `set_my_presence`, `change_username`
- Servidores: `create_server`, `create_invite`, `set_server_public`, `join_server`, `join_public_server`, `list_public_servers`, `list_bans`, `unban_member`
- Canais: `create_channel`
- Amizades/DMs: `send_friend_request`, `respond_friend_request`, `remove_friend`, `open_dm`, `respond_dm_request`
- Bloqueios: `block_user`, `unblock_user`
- Mensagens/reações: `toggle_reaction`
- Voz: `voice_join`, `voice_ping`, `voice_set_state`, `voice_leave`
- Eventos: `create_event`, `toggle_event_interest`, `delete_event`
- Configurações: `get_my_settings`, `save_my_settings`, `my_age_group`, `unsubscribe_marketing`

A lista de RPCs é um inventário estático inicial, não uma declaração de que todos os contratos já foram integralmente verificados.

## Migrations versionadas e lacunas

### SQL disponível para leitura

As migrations `0001`–`0010`, `0012`–`0020`, `0022`–`0025` contêm SQL versionado no branch. Elas descrevem, entre outros itens:
- perfil, códigos de e-mail, sessões QR e rate limiting;
- mensagens, canais, convites, presença e políticas;
- fotos, anexos, voz e estado de chamada;
- amizades, DMs, bloqueios, bans;
- explorar/fixar servidores, configurações, preferências e reações;
- tópicos de mensagens e limite de 10 participantes por sala de voz.

### SQL ausente/incompleto no repositório

1. **Schema base de servidores:** `0002_chat_e_perfil.sql` declara que as tabelas `servers`, `server_members`, `channels` e funções `create_server` / `is_server_member` já existiam em uma migration anterior chamada `servidores_e_canais`, mas o SQL dessa migration base não está versionado no diretório.
2. **Música:** `0011_musica_base.sql` é apenas um resumo de migrations já aplicadas; não contém o SQL de criação de `music_favorites`, `playlists`, `playlist_tracks` nem seus triggers/policies.
3. **Eventos:** `0021_eventos.sql` é apenas um resumo; não contém o SQL completo de `server_events`, `event_interest` e das funções de eventos.

Esses três blocos são bloqueadores para reconstruir o schema completo com equivalência. Não inventar definições, constraints, triggers ou policies a partir dos nomes.

## Divergências confirmadas entre original e banco paralelo

- `profiles` no paralelo tem colunas e constraints diferentes do modelo descrito em `0001` e migrations subsequentes.
- `channels` no paralelo usa `community_id` e `channel_type`; o original usa `server_id` e `kind`, além de canais DM sem servidor.
- `communities` e `community_members` não são substitutos comprovados para `servers` e `server_members`.
- O paralelo não lista as tabelas de amizades, DMs, bloqueios, convites, bans, voz, música, eventos, reações, códigos de e-mail ou QR.

Não tentar corrigir essas diferenças com renames, drops ou migrations antigas diretamente sobre o schema paralelo.

## Próximas etapas técnicas seguras

1. Completar o mapa de campos e operações lendo as chamadas e componentes do frontend original, sem editar esses arquivos.
2. Recuperar o SQL ausente a partir de histórico Git autorizado ou export/documentação disponibilizada pelo proprietário do banco original. O projeto Supabase original não está acessível pela conexão atual; não tentar contornar isso.
3. Montar um schema alvo completo e versionado, com plano de compatibilidade para o banco paralelo atual.
4. Revisar constraints, RLS, grants, funções SECURITY DEFINER, Storage policies e publicações Realtime.
5. Só depois preparar migrations incrementais e validar em ambiente paralelo isolado, com aprovação antes de qualquer aplicação remota.

## Critério de aceite

O banco paralelo só será considerado compatível quando todos os objetos usados pelo frontend original estiverem mapeados, suas estruturas e permissões estiverem comprovadas, e os fluxos originais tiverem testes de contrato/regressão. A conclusão deste inventário não significa que a migração esteja pronta nem que qualquer funcionalidade esteja ativa em produção.
