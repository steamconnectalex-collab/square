# SHIQI — relatório de execução do cutover

**Data:** 2026-11-27  
**Destino:** Supabase paralelo `shiqi-parallel` — `ujdosskjycrdkcgsswfa` — região `sa-east-1`  
**Conexão:** `Primary`  
**Branch:** `shiqi-parallel-dev`  
**Migration:** `20261127112309_shiqi_canonical_schema_cutover`  
**Status:** aplicada com sucesso; pós-check estrutural aprovado.

## Execução

1. Projeto confirmado como `ACTIVE_HEALTHY`; histórico remoto continha as cinco migrations prototype esperadas.
2. Preflight somente leitura: 18/18 checks booleanos passaram. As cinco tabelas prototype e `auth.users` estavam vazias; nomes canônicos livres; publicação Realtime e Storage compatíveis.
3. Snapshot completo repetido imediatamente antes da execução, incluindo ACLs de tabela/coluna/schema/sequence, policies, triggers, handler Auth, índices, constraints, Realtime, Storage e histórico de migrations.
4. Primeira tentativa falhou ao encontrar ausência de ponto e vírgula em definições de funções. A consulta posterior confirmou que tabelas, trigger e histórico permaneceram no estado anterior; nenhuma alteração parcial foi observada.
5. Foram corrigidos os 39 terminadores ausentes nas 59 funções do draft. O arquivo foi conferido novamente e a migration foi aplicada com sucesso.

## Pós-check estrutural

| Verificação | Resultado |
|---|---:|
| Tabelas canônicas | 18/18 |
| Tabelas canônicas com RLS | 18/18 |
| Policies públicas | 17 |
| Policies Storage | 7 |
| Policies Realtime para voz | 2 |
| Tabelas na publicação Realtime | 3: `messages`, `friendships`, `voice_members` |
| Buckets | 2: `avatars` público; `attachments` privado |
| Tabelas prototype preservadas como `legacy_*` | 5/5 |
| Linhas nas 18 tabelas canônicas | 0 |
| Linhas nas 5 tabelas legacy | 0 |
| Usuários em `auth.users` | 0 |
| Objetos em Storage | 0 |
| Trigger Auth prototype | removido |
| Handler `private.handle_new_user()` | preservado |
| Registro da migration | presente |

As funções sensíveis conferidas usam `SECURITY DEFINER` e `search_path = ''`. O schema `private` concede USAGE a `authenticated` e `service_role`, conforme o desenho canônico.

## Limites e próximos passos

- Nenhuma alteração no Supabase original/produção.
- Nenhum deploy da Vercel ou Edge Function.
- Não foram criados usuários de teste nem enviados e-mails.
- A aplicação estrutural não equivale a testes runtime. Ainda validar Auth/JWT, RLS com dois usuários, RPCs, upload/download de anexos com signed URL, Realtime e concorrência antes de conectar a UI.
- O rollback não foi testado em PostgreSQL isolado. Não executar reversão destrutiva; manter as tabelas `legacy_*` preservadas e priorizar correções para frente.

Arquivos relacionados: `CUTOVER_DRAFT.sql`, `CUTOVER_PREFLIGHT.sql`, `CUTOVER_SNAPSHOT.sql`, `CUTOVER_SNAPSHOT_BASELINE.md`, `CUTOVER_ROLLBACK_PLAN.md`.
