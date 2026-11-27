# Shiqi — inventário de dependências do schema

Data da auditoria: 2026-11-26  
Branch: `shiqi-parallel-dev`  
Escopo: leitura do frontend original em `main/site`, migrations versionadas em `shiqi-parallel/supabase/migrations` e schema remoto do projeto paralelo `ujdosskjycrdkcgsswfa`.

## Decisão de escopo: funcionalidade de música

O usuário confirmou que desistiu da funcionalidade de música. Portanto:
- Música está **fora do escopo do produto e da migração**.
- Não é necessário recuperar o SQL ausente da migration `0011_musica_base.sql`.
- As migrations copiadas 0011 e 0012 foram excluídas da pasta paralela para evitar aplicação acidental; os originais em `main` permanecem intactos.
- Referências de música encontradas no frontend serão identificadas para exclusão apenas na cópia paralela, sem tocar em `main/site` e sem remover recursos não relacionados.
- Não apagar objetos/tabelas remotos por enquanto; não há dados a migrar nem necessidade de operações destrutivas para simplesmente deixar a funcionalidade fora do produto.

## Regras de segurança desta preparação

- O aplicativo original em `main/site`, `main/desktop` e a produção permanecem intocados.
- Nenhuma migration foi aplicada nesta auditoria.
- Nenhum usuário, dado pessoal, segredo ou chave de produção foi copiado.
- O banco paralelo já contém tabelas com nomes e contratos diferentes; não aplicar migrations antigas em lote.
- Não publicar Edge Function nem deploy Vercel nesta etapa.
- Preservar fielmente o design e todos os fluxos que continuam no escopo; a única exclusão funcional autorizada neste momento é música.

## Estado remoto observado no projeto paralelo

Tabelas públicas observadas (todas com RLS habilitado, zero linhas):
- `profiles`
- `communities`
- `community_members`
- `channels`
- `messages`

O schema remoto é um protótipo de comunidades/chat e não representa o modelo original completo de servidores, amizades, DMs, eventos, reações e voz.

## Dependências de tabelas do frontend original

Referências REST estáticas encontradas em `site/app.js` e `site/settings-pages.js`:

| Recurso | Tabelas/objetos lidos ou escritos | Escopo |
|---|---|---|
| Servidores e canais | `servers`, `server_members`, `channels` | Manter |
| Mensagens | `messages` | Manter |
| Perfil e presença | `profiles` | Manter |
| Amizades | `friendships` | Manter |
| Mensagens diretas | `channels` com kind `dm`, `dm_members` | Manter |
| Bloqueios | `blocks` | Manter |
| Presença de voz | `voice_members` | Manter |
| Eventos | `server_events`, `event_interest` | Manter |
| Reações | `message_reactions` | Manter |
| Música | `music_favorites`, `playlists`, `playlist_tracks` | **Excluir do produto/migração** |

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
2. **Eventos:** `0021_eventos.sql` é apenas um resumo; não contém o SQL completo de `server_events`, `event_interest` e das funções de eventos.

A inspeção adicional dos arquivos originais na raiz confirmou que 0001, 0002, 0003, 0005, 0021 e 0024 estão disponíveis em Git. 0002 contém a implementação de messages e helpers, mas apenas resume a migration-base `servidores_e_canais`; 0021 continua sendo apenas um resumo. Isso reduz a lacuna: não é necessário solicitar um dump completo por enquanto; primeiro recuperar as definições ausentes do catálogo autorizado e comparar os demais arquivos versionados.

O alvo contém **18 tabelas**, excluindo `qr_sessions` e as três tabelas de música.

As migrations 0011 e 0012 foram excluídas somente da cópia paralela. Os arquivos originais em `main` não foram alterados. A recuperação do SQL de música está dispensada.

## Divergências confirmadas entre original e banco paralelo

- `profiles` no paralelo tem colunas e constraints diferentes do modelo descrito em `0001` e migrations subsequentes.
- `channels` no paralelo usa `community_id` e `channel_type`; o original usa `server_id` e `kind`, além de canais DM sem servidor.
- `communities` e `community_members` não são substitutos comprovados para `servers` e `server_members`.
- O paralelo não lista as tabelas de amizades, DMs, bloqueios, convites, bans, voz, eventos, reações, códigos de e-mail ou QR.

Não tentar corrigir essas diferenças com renames, drops ou migrations antigas diretamente no schema paralelo.

## Recuperação concluída das lacunas principais (26/11/2026)

O catálogo vivo do banco original forneceu as definições que faltavam para:
- schema base `servers`, `server_members`, `channels`;
- RPCs `create_server` e `is_server_member`;
- tabelas `server_events`, `event_interest`;
- RPCs `create_event`, `delete_event`, `toggle_event_interest`;
- constraints e policies de leitura dessas tabelas.

Assim, não é necessário pedir ao usuário um dump completo neste momento. O próximo trabalho é consolidar essas definições com os SQLs versionados 0001–0024, extrair as definições completas dos objetos adicionais que ainda estejam resumidos/incompletos e revisar o plano de preservação dos cinco objetos atuais do destino.

## Próximas etapas técnicas seguras

1. Completar o mapa de campos e operações lendo as chamadas e componentes do frontend original, sem editar esses arquivos.
2. Recuperar o SQL ausente do schema base de servidores e eventos por histórico Git autorizado ou export/documentação disponibilizada pelo proprietário do banco original. A recuperação do SQL de música está dispensada. O histórico Git consultado não contém o SQL base.
3. Montar um schema alvo completo e versionado, com plano de compatibilidade para o banco paralelo atual, excluindo música.
4. Revisar constraints, RLS, grants, funções SECURITY DEFINER, Storage policies e publicações Realtime.
5. Se não houver outra fonte autorizada, solicitar ao proprietário um dump SQL somente de estrutura (sem dados) do banco original, incluindo schemas public/private, funções, policies, triggers, grants e configuração Realtime/Storage.
6. Só depois preparar migrations incrementais e validar em ambiente paralelo isolado, com aprovação antes de qualquer aplicação remota.

## Critério de aceite

O banco paralelo só será considerado compatível quando todos os objetos usados pelo frontend original que continuam no escopo estiverem mapeados, suas estruturas e permissões estiverem comprovadas, e os fluxos originais tiverem testes de contrato/regressão. A conclusão deste inventário não significa que a migração esteja pronta nem que qualquer funcionalidade esteja ativa em produção.
