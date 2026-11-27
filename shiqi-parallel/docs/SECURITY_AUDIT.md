# SHIQI — auditoria de segurança

Data: 2026-11-27  
Branch: `shiqi-parallel-dev`  
Escopo desta rodada: contratos SQL de servidores, amizades/DMs, perfis, moderação, voz, RLS, Storage e Realtime.  
Status: revisão estática; nenhuma migration foi aplicada.

## Corrigido nesta rodada — amizade pendente liberando perfil

O helper `private.shares_server_with(p_user)` era verdadeiro quando existia qualquer linha em `public.friendships` entre as pessoas, sem exigir `status = 'accepted'`. O helper é usado pela policy `profiles_select_visible` e pela RPC `profiles_full`. Assim, uma solicitação pendente podia ser tratada como vínculo válido para leitura de perfil.

Correção aplicada em `CANONICAL_PRIVATE_FUNCTIONS.sql` e na cópia do helper dentro de `CUTOVER_DRAFT.sql`: o ramo de amizade agora exige `f.status = 'accepted'`. O compartilhamento por servidor em comum continua permitido. O teste estático `tests/auth-contract-static.js` verifica os dois arquivos.

## Risco pendente — anexos em bucket público

A configuração canônica define o bucket `attachments` com `public = true`. O frontend monta URLs no formato `/storage/v1/object/public/attachments/<path>`. Pela semântica do Supabase Storage, downloads de objetos em bucket público não são restringidos pelas policies de SELECT de `storage.objects`: qualquer pessoa que possua a URL consegue obter o arquivo.

Impacto: imagens anexadas a mensagens de canais privados ou DMs podem ser acessadas por terceiros caso a URL/caminho seja compartilhado ou exposto. As policies `attachments_select_own` não tornam o download privado enquanto o bucket continuar público. Isso é diferente do bucket `avatars`, que é público por ser mídia de perfil.

### Remediação recomendada antes do lançamento

1. Tornar `attachments` privado na configuração do bucket canônico e no `CUTOVER_DRAFT.sql`.
2. Substituir a montagem de URL pública em `apps/web/app.js` por geração/renovação de signed URLs autenticadas, com cache curto e tratamento de falha/expiração.
3. Ajustar a policy de leitura de `storage.objects` para permitir o download somente quando o usuário autenticado puder acessar a mensagem/canal associado ao caminho do anexo (incluindo membros válidos de DM e bloqueios).
4. Manter upload e exclusão restritos à pasta cujo primeiro segmento é o ID do próprio usuário.
5. Testar com dois usuários: membro do canal, não membro, participante de DM, pessoa bloqueada, usuário sem sessão e URL expirada.

Não tornar o bucket privado isoladamente: isso quebraria as imagens no frontend atual, que usa URLs públicas e elementos `img` sem cabeçalho Authorization. A mudança precisa ser coordenada entre bucket, RLS de Storage e frontend.

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
