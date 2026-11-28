# SHIQI — auditoria de segurança

Data: 2026-11-27  
Branch: `shiqi-parallel-dev`  
Escopo desta rodada: contratos SQL de servidores, amizades/DMs, perfis, moderação, voz, RLS, Storage e Realtime.  
Status: revisão estática; nenhuma migration foi aplicada.

## Corrigido nesta rodada — amizade pendente liberando perfil

O helper `private.shares_server_with(p_user)` era verdadeiro quando existia qualquer linha em `public.friendships` entre as pessoas, sem exigir `status = 'accepted'`. O helper é usado pela policy `profiles_select_visible` e pela RPC `profiles_full`. Assim, uma solicitação pendente podia ser tratada como vínculo válido para leitura de perfil.

Correção aplicada em `CANONICAL_PRIVATE_FUNCTIONS.sql` e na cópia do helper dentro de `CUTOVER_DRAFT.sql`: o ramo de amizade agora exige `f.status = 'accepted'`. O compartilhamento por servidor em comum continua permitido. O teste estático `tests/auth-contract-static.js` verifica os dois arquivos.

## Corrigido nesta rodada — anexos privados com autorização por conversa

O bucket `attachments` agora é definido como privado nos SQLs canônicos e no `CUTOVER_DRAFT.sql`. O frontend não monta mais URLs públicas: solicita signed URLs autenticadas com validade de 60 segundos e mantém cache local por até 50 segundos. A renovação automática é agendada antes da expiração enquanto a tela de conversa está aberta; falhas são exibidas como imagem indisponível, sem liberar URL pública.

A policy de SELECT foi trocada de `attachments_select_own` para `attachments_select_message_member`, que chama `private.can_read_attachment(name)`. O helper só autoriza caminhos associados a uma mensagem existente. Em canais de servidor, exige associação atual ao servidor. Em DMs, exige que a pessoa esteja com estado `active`; quem enviou uma solicitação ainda pode ver o próprio anexo, mas o destinatário não recebe acesso até aceitar. Depois do aceite, ambos precisam passar por `private.dm_allowed`, que respeita bloqueios e regras existentes. Upload e exclusão continuam limitados à pasta do próprio usuário.

O helper foi incluído na ACL com EXECUTE apenas para `authenticated`; o total de REVOKEs nominais sobe de 58 para 59. O teste estático foi ampliado para verificar o bucket privado, helper, policy, frontend, cópia do draft e validação do caminho do autor em INSERT/UPDATE. O teste passou em um harness JavaScript em memória usando os 16 arquivos exatos da branch; também passaram a análise de sintaxe JavaScript de `app.js` e do próprio teste. Isso não equivale a executar Node no checkout nem a validar PostgreSQL/Storage em runtime.

### Limite residual

Uma signed URL já emitida funciona como um link portador até expirar. A janela foi reduzida a 60 segundos; revogação imediata exige remover o objeto. O cache no navegador é de 50 segundos, mas abas já abertas podem manter a imagem carregada em memória. Testes de integração com usuários reais ainda são necessários antes do lançamento.

## Pontos verificados nesta rodada

- `ban_member` e `kick_member` delegam a `private.remove_from_server`, que exige sessão e propriedade do servidor e impede remover a si próprio.
- `create_event`, `delete_event`, `list_bans`, `unban_member` e `set_server_public` verificam propriedade do servidor.
- RPCs sociais revisadas vinculam alterações ao usuário autenticado ou à solicitação correspondente.
- `voice_join` exige associação ao servidor e respeita limite de 10 participantes; `voice_ping`, `voice_leave` e `voice_set_state` operam sobre registros do próprio usuário.
- Realtime proposto inclui `friendships`, `messages` e `voice_members`; as tabelas possuem policies RLS específicas.
- Nenhum teste de runtime PostgreSQL, Storage ou Realtime foi executado; estes pontos continuam sujeitos a testes de integração antes de liberar o cutover.

## Limites

Esta auditoria é estática e não prova o comportamento do banco em runtime. O `CUTOVER_DRAFT.sql` continua sem autorização para execução. Nenhum dado, usuário, bucket, policy, função, trigger ou publicação remota foi alterado.


## Corrigido nesta rodada — concorrência no limite de voz

A RPC `voice_join` verificava a quantidade de participantes e inseria o usuário sem bloquear entradas concorrentes. Duas entradas simultâneas poderiam observar a mesma contagem e ultrapassar o limite de 10; chamadas simultâneas do mesmo usuário para salas diferentes também poderiam deixar registros duplicados em mais de uma sala.

Foi adicionada uma trava transacional por usuário e outra por sala, sempre na mesma ordem (usuário → sala), antes da limpeza/contagem/inserção. Isso serializa as entradas conflitantes e protege o limite de 10, além da regra de uma sala por usuário. A mudança está tanto em `CANONICAL_MODERATION_EVENTS_VOICE_RPCS.sql` quanto no `CUTOVER_DRAFT.sql`; o teste estático verifica as duas travas e o limite. A confirmação de comportamento concorrente ainda depende de teste PostgreSQL de runtime.


## Corrigido nesta rodada — limites sujeitos a concorrência

A revisão encontrou contadores com padrão "consultar quantidade e depois inserir", que podiam ser ultrapassados por requisições simultâneas. Foram adicionados advisory transaction locks com namespaces separados e chaves por entidade:

- `private.messages_rate_limit`: serializa por autor antes de contar 5 mensagens/5 segundos e 40/60 segundos.
- `public.rate_check`: serializa por chave antes de limpar/contar/inserir hits, protegendo os limites usados pelo Auth.
- `create_server`: serializa o limite de 10 servidores próprios por usuário.
- `create_channel`: serializa o limite de 30 canais por servidor.
- `join_public_server` e `join_server`: compartilham lock por usuário para o limite de 20 servidores associados.
- `block_user` e `send_friend_request`: serializam os limites por usuário (200 bloqueios e 30 solicitações pendentes).
- `create_event`: serializa o limite de 25 eventos futuros por servidor.
- `pin_server`: serializa o limite de 4 servidores fixados por usuário.
- `toggle_reaction`: serializa o limite de 20 emojis distintos por mensagem.
- `toggle_event_interest`: serializa a alternância por combinação evento/usuário, evitando conflito de duas chamadas simultâneas.
- `voice_join`: locks por usuário e sala mantêm o limite de 10 participantes e uma sala por usuário.

As alterações foram aplicadas às referências SQL canônicas e às cópias correspondentes no `CUTOVER_DRAFT.sql`. O teste estático agora verifica a presença dos locks nos contratos canônicos e no draft. O teste passou em harness JavaScript em memória com os arquivos atuais da branch; a análise de sintaxe JS também passou. Ainda não foi executado teste de concorrência real em PostgreSQL, então a eficácia operacional deve ser confirmada antes do cutover.


## Corrigido nesta rodada — bloqueio também restringe leitura de DMs

A RPC `block_user` impedia novos envios por meio de `private.dm_allowed`, mas as funções usadas nas policies de SELECT (`private.is_channel_member` e `private.is_dm_member`) aceitavam qualquer linha de `dm_members` sem consultar bloqueios. Isso permitia continuar lendo o histórico de uma DM após bloquear ou ser bloqueado.

Os dois helpers agora exigem `private.dm_allowed` entre os participantes. Isso respeita bloqueios e mantém a regra existente de elegibilidade (amizade aceita ou servidor em comum). Solicitações de DM ainda pendentes continuam visíveis enquanto não houver bloqueio, permitindo que o destinatário avalie a solicitação. O helper de anexos também foi alinhado: o remetente ativo pode acessar seu próprio anexo pendente, mas somente se não houver bloqueio; o destinatário só acessa depois que o estado dele for `active`.

Alterados `CANONICAL_PRIVATE_FUNCTIONS.sql` e `CUTOVER_DRAFT.sql`; teste estático ampliado para verificar os três helpers. Nenhuma mudança foi aplicada ao Supabase remoto.


## Corrigido nesta rodada — policies de canal privado do Realtime

A migration original `0008_voz.sql` foi recuperada do GitHub. Ela confirma que a sinalização WebRTC usa canal privado `voice:<channel-id>` e depende das policies `voice_topic_select` e `voice_topic_insert` em `realtime.messages`, ambas delegando a autorização a `private.can_voice_topic(realtime.topic())`. A função existia na referência canônica, mas as duas policies não tinham sido incluídas no pacote de cutover.

As policies foram restauradas em `CANONICAL_REALTIME.sql` e `CUTOVER_DRAFT.sql`. O preflight agora bloqueia colisões dos dois nomes e também inclui `private.can_read_attachment` na verificação de colisões de funções. Corrigidos ainda os checks de bucket e policy Storage para refletir `attachments` privado e `attachments_select_message_member`.

Consulta somente leitura ao projeto Supabase paralelo confirmou que não existem policies em `realtime.messages` nem a função antiga `private.can_voice_topic` no estado atual (esperado antes do cutover). A nova consulta de nomes de policy retornou zero linhas. O preflight completo atualizado ainda não foi executado em bloco; nenhum DDL/DML remoto foi realizado.


## Revisão final estática do pacote de banco — 2026-11-27

- O snapshot pré-cutover foi executado por seções e registrado em `CUTOVER_SNAPSHOT_BASELINE.md`; o preflight atualizado passou em 18/18 checks booleanos. Nenhuma alteração remota foi feita.
- O teste `tests/auth-contract-static.js` foi executado em harness JavaScript em memória com os arquivos atuais da branch e passou. A análise de sintaxe de `apps/web/app.js` e do próprio teste também passou. Isso não valida SQL em PostgreSQL, Deno, JWT, Auth, Storage ou Realtime em runtime.
- Conferência cruzada das assinaturas: 59 definições de funções públicas/privadas correspondem exatamente a 59 REVOKEs na ACL; 52 GRANTs apontam para funções existentes. Não foram encontradas assinaturas sem REVOKE, REVOKEs excedentes ou GRANTs para funções ausentes.
- Foram encontradas 58 funções `SECURITY DEFINER`; todas declaram `SET search_path TO ''`. A única função sem SECURITY DEFINER permanece fora dessa contagem.
- O `CUTOVER_DRAFT.sql` mantém BEGIN/COMMIT e não contém `DROP ... CASCADE` nem `TRUNCATE` de nível superior. Isso é uma verificação estática, não uma prova de que a transação executará sem erro.
- Supabase Advisors no projeto paralelo: zero lints de segurança e zero de saúde. Há cinco avisos INFO de índices não utilizados nas tabelas prototype vazias; não remover esses índices por esse motivo.
- O pacote continua bloqueado para aplicação: não houve validação transacional em PostgreSQL isolado, testes de concorrência real, testes Auth/JWT, Storage ou Realtime. Não executar `CUTOVER_DRAFT.sql` nem aplicar DDL/DML remoto sem autorização explícita.

- Auditoria adicional de acesso às tabelas: 18/18 tabelas canônicas têm RLS habilitada; as 17 policies estão distribuídas em 13 tabelas. As cinco tabelas internas (`email_codes`, `rate_hits`, `server_invites`, `server_bans`, `mfa_recovery`) não recebem grants diretos para `authenticated`; o acesso permanece mediado pelas RPCs/Edge Function.
- A revisão de grants do draft encontrou zero GRANTs para `anon`. Para `authenticated`, os grants diretos de tabela/coluna são limitados a leitura de tabelas sociais/conversas sob RLS, campos selecionados de perfil, escrita limitada de mensagens e a sequence identity necessária. `service_role` recebe privilégios administrativos para o backend.

- Correção durante a revisão final: removido o GRANT redundante de `USAGE` do schema `private` para `authenticated`, que já estava coberto pelo grant conjunto a `authenticated, service_role`. ACL canônica e draft agora têm exatamente uma concessão de USAGE do schema.
- Reexecutado o teste estático após a correção: passou; as 59 revogações continuam alinhadas e a análise de sintaxe de `app.js` passou.

- Cruzamento de contratos do frontend: 30 RPCs distintas chamadas pelos módulos web foram encontradas nas definições canônicas; nenhuma chamada aponta para função ausente. As 13 tabelas referenciadas diretamente por REST também existem no schema canônico; as cinco tabelas internas permanecem mediadas pelo backend/RPC.
- Comparação do draft com as referências: 18/18 tabelas com RLS, 17/17 policies públicas presentes sem duplicatas, sete policies Storage e as duas policies privadas de voz Realtime presentes.


## Complemento de auditoria — 2026-11-28

- A Edge Function `auth` do Supabase paralelo foi atualizada para versão 2. A fonte publicada foi conferida: usa a configuração própria do paralelo, não contém origens do site principal e inclui limpeza recursiva/paginada do Storage para exclusão de conta. `verify_jwt=false` permanece intencional, pois a função valida o JWT nas rotas protegidas por `admin.auth.getUser` e mantém rotas públicas de cadastro/login.
- A exclusão de conta agora percorre subpastas, pagina listagens de até 1.000 itens, remove em lotes de até 1.000 e interrompe antes do purge/Auth delete se o Storage retornar erro. A operação distribuída Storage + Postgres + Auth não é transacional; falha posterior ao Storage ainda pode exigir repetição/recuperação operacional.
- **Lacuna MFA identificada:** os SQLs canônicos não contêm checagem de `auth.jwt()->>'aal'` nem política RLS `AS RESTRICTIVE` que exija `aal2` quando o usuário possui fator verificado em `auth.mfa_factors`. Como 39 funções SECURITY DEFINER são executáveis por `authenticated`, políticas RLS isoladas não bastariam para proteger todas as RPCs que ignoram RLS. O fluxo de UI/TOTP não deve ser tratado como enforcement completo contra chamadas diretas ao Auth/PostgREST.
- Consulta somente leitura confirmou zero fatores MFA verificados cadastrados no projeto paralelo no momento da auditoria. Isso reduz o impacto atual, mas não remove a lacuna para futuras contas que ativarem MFA.
- Não foi aplicada alteração SQL para MFA: requer desenho abrangente para RLS, Storage, Realtime e RPCs SECURITY DEFINER, além de teste isolado com tokens AAL1/AAL2 antes de qualquer DDL remoto.
