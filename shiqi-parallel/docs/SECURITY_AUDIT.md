# SHIQI — auditoria de segurança

Data: 2026-11-27  
Branch: `shiqi-parallel-dev`  
Escopo desta rodada: contratos SQL de servidores, amizades/DMs, perfis, moderação, voz, RLS, Storage e Realtime.  
Status: revisão estática; nenhuma migration foi aplicada.

## Corrigido nesta rodada — amizade pendente liberando perfil

O helper `private.shares_server_with(p_user)` era verdadeiro quando existia qualquer linha em `public.friendships` entre as pessoas, sem exigir `status = 'accepted'`. O helper é usado pela policy `profiles_select_visible` e pela RPC `profiles_full`. Assim, uma solicitação pendente podia ser tratada como vínculo válido para leitura de perfil.

Correção aplicada em `CANONICAL_PRIVATE_FUNCTIONS.sql` e na cópia do helper dentro de `CUTOVER_DRAFT.sql`: o ramo de amizade agora exige `f.status = 'accepted'`. O compartilhamento por servidor em comum continua permitido. O teste estático `tests/auth-contract-static.js` verifica os dois arquivos.

## Corrigido nesta rodada — anexos privados com autorização por conversa

O bucket `attachments` agora é definido como privado nos SQLs canônicos e no `CUTOVER_DRAFT.sql`. O frontend não monta mais URLs públicas: solicita signed URLs autenticadas com validade de 60 segundos e mantém cache local por até 50 segundos. A renovação é feita quando a mensagem é renderizada novamente; falhas são exibidas como imagem indisponível, sem liberar URL pública.

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
- `voice_join`: locks por usuário e sala mantêm o limite de 10 participantes e uma sala por usuário.

As alterações foram aplicadas às referências SQL canônicas e às cópias correspondentes no `CUTOVER_DRAFT.sql`. O teste estático agora verifica a presença dos locks nos contratos canônicos e no draft. O teste passou em harness JavaScript em memória com os arquivos atuais da branch; a análise de sintaxe JS também passou. Ainda não foi executado teste de concorrência real em PostgreSQL, então a eficácia operacional deve ser confirmada antes do cutover.
