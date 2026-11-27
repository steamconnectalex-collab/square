# SHIQI — plano de rollback do cutover canônico

**Status: NÃO LIBERADO PARA EXECUÇÃO.** O arquivo `CUTOVER_DRAFT.sql` é apenas uma proposta de revisão. Este plano registra as condições para reverter sem perda; não autoriza aplicar nem desfazer o banco.

## Por que o rollback ainda não é executável

O cutover preserva as cinco tabelas prototype renomeando-as para `legacy_*`, mas revoga os privilégios de `anon` e `authenticated` nessas tabelas e troca a publicação Realtime. Para reverter com exatidão, precisamos ter o snapshot anterior de:

- privilégios de tabela (incluindo grants a `PUBLIC`), privilégios por coluna e privilégios de todas as sequences do schema `public` (o cutover revoga `anon`/`authenticated` em todas elas);
- definição exata do trigger `on_auth_user_created_shiqi` e do handler `private.handle_new_user()`;
- índices, constraints, policies e triggers prototype;
- membros da publicação Realtime, estado prévio dos buckets e todas as policies de `storage.objects`;
- histórico de migrations.

O trigger antigo ainda não foi capturado em uma saída consultável nesta sessão, e o conector do Supabase está negando até operações de leitura. Não vamos inventar a definição do trigger nem presumir os grants.

## Snapshot obrigatório antes de qualquer cutover

Executar `docs/CUTOVER_PREFLIGHT.sql` e `docs/CUTOVER_SNAPSHOT.sql` no projeto paralelo, salvar os resultados com segurança e revisar todos os checks. Os snapshots são somente leitura. Não executar `CUTOVER_DRAFT.sql` ainda.

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
3. Remover policies e triggers criados para as tabelas canônicas.
4. Remover as RPCs públicas e helpers privados canônicos, usando assinaturas exatas e sem `CASCADE`.
5. Remover as 18 tabelas canônicas em ordem inversa das FKs, sem `CASCADE`.
6. Renomear as cinco tabelas `legacy_*` para os nomes originais.
7. Remover as sete policies Storage criadas pelo cutover (`attachments_*` e `avatars_*`); manter os buckets somente se estiverem vazios e a decisão de preservá-los estiver documentada.
8. Restaurar os nomes dos índices/constraints conforme o snapshot.
9. Restaurar os privilégios de tabela, coluna e sequence exatamente conforme o snapshot, incluindo entradas concedidas a `PUBLIC`.
10. Recriar o trigger Auth usando a definição exata capturada — não aproximar evento, timing ou condição.
11. Validar policies, triggers, FKs, índices, grants de tabela/coluna/sequence, Realtime, Storage e histórico de migrations.

Os buckets podem ser mantidos durante o rollback se estiverem vazios e com configuração compatível; as sete policies Storage criadas pela migration devem ser removidas para restaurar o estado anterior. Não excluir linhas de `storage.buckets` diretamente. Se for necessário removê-los, usar o fluxo oficial do Storage após confirmar que não há objetos.

## Regra de segurança

Se dados de usuário, perfis, mensagens, objetos Storage ou outras informações forem criados após o cutover, este rollback destrutivo deixa de ser permitido. Nesse cenário, fazer correção para frente ou planejar migração de dados; nunca apagar dados para voltar ao protótipo.
