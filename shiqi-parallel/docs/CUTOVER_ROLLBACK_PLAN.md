# SHIQI — plano de rollback do cutover canônico

**Status: NÃO LIBERADO PARA EXECUÇÃO.** Snapshot real conferido em 2026-11-27; o rollback continua sem teste transacional em PostgreSQL isolado. O arquivo `CUTOVER_DRAFT.sql` é apenas uma proposta de revisão. Este plano registra as condições para reverter sem perda; não autoriza aplicar nem desfazer o banco.

## Por que o rollback ainda não é executável

O cutover preserva as cinco tabelas prototype renomeando-as para `legacy_*`, mas revoga os privilégios de `anon` e `authenticated` nessas tabelas e troca a publicação Realtime. Para reverter com exatidão, precisamos ter o snapshot anterior de:

- ACLs de tabela, coluna e schema (especialmente `private`), incluindo `PUBLIC` e privilégios específicos do PostgreSQL 17, além das ACLs de todas as sequences do schema `public` (o snapshot consulta os catálogos diretamente);
- definição exata do trigger `on_auth_user_created_shiqi` e do handler `private.handle_new_user()`;
- índices, constraints, policies e triggers prototype;
- policies da tabela `realtime.messages` (sinalização privada de voz), além da publicação;
- membros da publicação Realtime, estado prévio dos buckets e todas as policies de `storage.objects`;
- histórico de migrations.

A leitura do Supabase foi restabelecida usando a conexão `Primary` (projeto `ujdosskjycrdkcgsswfa`, status `ACTIVE_HEALTHY`). A definição exata do trigger `on_auth_user_created_shiqi` foi capturada: `AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user()`. O corpo completo do handler também foi capturado. O preflight foi executado em modo somente leitura e todos os 18 checks booleanos atualizados retornaram `passed=true`. O snapshot real confirmou cinco tabelas vazias, zero usuários Auth, zero sequences no schema `public`, nenhum bucket/policy Storage e Realtime somente em `public.messages`. As ACLs brutas foram lidas pelos catálogos PostgreSQL; há grants amplos de tabela para `anon` e `authenticated` nas cinco tabelas prototype, além de grants por coluna de UPDATE para `authenticated`. Nenhum DDL/DML foi executado.

## Snapshot obrigatório antes de qualquer cutover

Preflight e snapshot foram consultados no projeto paralelo em 2026-11-27, somente leitura. A primeira versão de `CUTOVER_SNAPSHOT.sql` usava `information_schema.sequence_privileges`, visão inexistente neste PostgreSQL; foi corrigida para consultar ACLs diretamente via `pg_class`/`aclexplode`. O snapshot corrigido foi executado em consultas independentes em 2026-11-27 e todas as seções retornaram sem erro. O baseline resumido está em `CUTOVER_SNAPSHOT_BASELINE.md`; antes de um cutover futuro, repetir e arquivar a saída integral atualizada. Não executar `CUTOVER_DRAFT.sql`.

## Condições mínimas para um rollback futuro

O rollback só poderá ser considerado se:

1. O app e a Edge Function estiverem desconectados do schema canônico durante a janela.
2. Todas as 18 tabelas canônicas estiverem vazias.
3. `auth.users` continuar sem contas criadas no destino.
4. Os buckets `avatars` e `attachments` não tiverem objetos enviados durante a janela.
5. O snapshot original estiver disponível e tiver sido comparado com o estado atual.
6. O histórico de migrations for revertido pelo mecanismo oficial do Supabase CLI, não por DELETE manual da tabela de histórico.

## Ordem de reversão a implementar e testar em PostgreSQL isolado

1. Confirmar as condições acima e abortar se qualquer tabela canônica ou bucket tiver dados.
2. Retirar da publicação Realtime as tabelas canônicas e recolocar `public.legacy_messages`.
3. Remover as policies `voice_topic_select` e `voice_topic_insert` de `realtime.messages`, além das policies e triggers criados para as tabelas canônicas.
4. Remover as RPCs públicas e helpers privados canônicos, incluindo `private.can_read_attachment(text)`, usando assinaturas exatas e sem `CASCADE`.
5. Remover as 18 tabelas canônicas nesta ordem, sem `CASCADE`, derivada das FKs atuais em `CANONICAL_TABLES.sql`: `profiles`, `email_codes`, `rate_hits`, `server_members`, `server_invites`, `dm_members`, `friendships`, `blocks`, `voice_members`, `server_bans`, `server_pins`, `mfa_recovery`, `message_reactions`, `event_interest`, `messages`, `server_events`, `channels`, `servers`. A FK autorreferente de `messages.thread_of` desaparece com a própria tabela; `message_reactions` deve sair antes de `messages`, e `event_interest` antes de `server_events`.
6. Renomear as cinco tabelas `legacy_*` para os nomes originais.
7. Remover as sete policies Storage criadas pelo cutover (`attachments_delete_own`, `attachments_insert_own`, `attachments_select_message_member` e as quatro `avatars_*`); manter os buckets somente se estiverem vazios e a decisão de preservá-los estiver documentada.
8. Restaurar os nomes dos 13 índices prototype conforme `CUTOVER_SNAPSHOT_BASELINE.md`; verificar no catálogo os nomes das constraints PK/UNIQUE associadas após cada rename.
9. Restaurar os privilégios de tabela, coluna e sequence exatamente conforme o snapshot, incluindo entradas concedidas a `PUBLIC` e privilégios PG17 como `MAINTAIN`.
10. Restaurar a ACL do schema `private` ao estado capturado (USAGE somente para `authenticated`, além do proprietário).
11. Recriar o trigger Auth usando a definição exata capturada — não aproximar evento, timing ou condição.
12. Validar policies, triggers, FKs, índices, grants de tabela/coluna/sequence/schema, Realtime, Storage e histórico de migrations.

Restaurar também a ACL do schema `private`: no estado capturado antes do cutover, `authenticated` tem `USAGE`; `anon`, `service_role` e `PUBLIC` não têm `USAGE`. O draft concede `USAGE` temporariamente a `service_role`, portanto o rollback deve revogá-lo e manter o grant somente para `authenticated`.

Os buckets podem ser mantidos durante o rollback se estiverem vazios e com configuração compatível; as sete policies Storage criadas pela migration devem ser removidas para restaurar o estado anterior. Não excluir linhas de `storage.buckets` diretamente. Se for necessário removê-los, usar o fluxo oficial do Storage após confirmar que não há objetos.

## Regra de segurança

Se dados de usuário, perfis, mensagens, objetos Storage ou outras informações forem criados após o cutover, este rollback destrutivo deixa de ser permitido. Nesse cenário, fazer correção para frente ou planejar migração de dados; nunca apagar dados para voltar ao protótipo.
