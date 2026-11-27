# SHIQI — acompanhamento

Última atualização: 2026-11-27

## Requisito central
**Migrar tecnologia sem mudar design, layout, identidade visual, navegação ou qualquer funcionalidade do aplicativo original que permaneça no escopo.** O diretório `site/` da raiz é a fonte de verdade. Música foi explicitamente retirada do produto pelo usuário e poderá ser removida somente da cópia paralela. Nenhuma outra simplificação/remoção de função sem autorização expressa.

## Em andamento agora
- [ ] Revisar concorrência das RPCs de mensagens, reações, canais e limites por usuário. Anexos privados implementados e teste estático passou em harness em memória. Depois continuar contratos Realtime/DMs e revisar rollback. Validação PostgreSQL local dispensada; não aplicar DDL remoto.
- [x] 2026-11-27 — Ampliado o snapshot para incluir grants de tabela concedidos a PUBLIC e privilégios de todas as sequences; o plano de rollback agora inclui remoção das sete policies Storage do cutover e restauração dos grants de sequence. Removidos grants duplicados do draft.

## Bloqueios atuais (27/11/2026)
- A RPC `private.messages_rate_limit()` conta envios sem lock por autor; inserções simultâneas podem ultrapassar os limites de 5 mensagens/5s e 40/60s. Em auditoria para correção transacional.
- O limite de 10 participantes por voz agora tem locks transacionais por usuário e sala no SQL canônico e no draft; a proteção foi verificada estaticamente, mas ainda depende de teste concorrente em PostgreSQL. 
- Anexos agora estão preparados para bucket privado, signed URLs de 60s e policy por acesso à mensagem nos SQLs/draft/frontend. Falta teste de integração com usuários reais e validação runtime do helper/Storage antes de liberar cutover.
- A validação de runtime dos SQLs segue pendente. O helper `private.shares_server_with` foi endurecido para considerar apenas amizades aceitas; a verificação estática cobre o helper e o cutover draft, mas não substitui teste RLS com dois usuários.
- Os fluxos MFA ainda não foram executados contra Supabase Auth; a correção foi estática. O comportamento de revogação de sessões ao excluir um fator verificado exige novo login no desligamento e sessão nova após recuperação.
- Leitura do Supabase restabelecida em 2026-11-27 usando a conexão `Primary`; projeto `ujdosskjycrdkcgsswfa` confirmado `ACTIVE_HEALTHY`. A falha anterior era a conexão incorreta (`shiqi` apontava para o projeto antigo). O preflight foi executado somente com SELECT e todos os 17 checks retornaram true. Nenhum DDL/DML foi executado.
- A validação de parser/runtime em PostgreSQL isolado foi dispensada pelo usuário para evitar aprofundamento em configuração local. Os SQLs continuam sem validação de runtime; manter bloqueio de execução remota até revisão e autorização.
- A Vercel continua com a última implantação READY, mas ela aponta para o commit 1a6f6706, anterior às alterações recentes de frontend. A proteção SSO está habilitada. Não disparar novo deploy enquanto a restrição/janela de limite registrada no projeto não terminar.
- O smoke test existente na raiz aponta para o site original e não valida a cópia paralela; não foi executado para evitar testar/altear o alvo errado.

## Concluído
- [x] 2026-11-27 — Anexos protegidos por conversa: bucket `attachments` privado; signed URLs autenticadas de 60s no frontend; policy `attachments_select_message_member` baseada em `private.can_read_attachment`, exigindo membro atual de servidor ou participante ativo de DM (com bloqueios respeitados). Upload/exclusão seguem restritos à pasta do usuário. Mensagens também validam que o caminho do anexo pertence ao autor em INSERT e UPDATE. Teste estático passou em harness em memória com 16 arquivos; integração/runtime pendentes.
- [x] 2026-11-27 — Endurecida a concorrência de `voice_join`: locks transacionais por usuário e sala evitam que entradas simultâneas ultrapassem 10 participantes ou mantenham o mesmo usuário em duas salas. Atualizados SQL canônico, draft e teste estático.
- [x] 2026-11-27 — Corrigida exposição de perfis por amizade pendente: `private.shares_server_with()` agora só reconhece amizades com `status = 'accepted'`, tanto no helper canônico quanto no `CUTOVER_DRAFT.sql`. O helper alimenta `profiles_select_visible` e `profiles_full`; a correção impede que uma solicitação pendente seja tratada como amizade para liberar perfil. Adicionada verificação ao teste estático de contrato.
- [x] 2026-11-27 — Corrigida a consulta de ACLs do snapshot: removida a referência à visão inexistente `information_schema.sequence_privileges`; agora usa `pg_class`/`aclexplode` para capturar grants de tabelas, colunas e sequences, inclusive PUBLIC e privilégios PG17. Incluída também a ACL dos schemas `private`/`public`.
- [x] 2026-11-27 — Leitura real do projeto paralelo restabelecida via `Primary`; projeto confirmado ACTIVE_HEALTHY. Os 17 checks do preflight retornaram true: cinco tabelas prototype vazias, zero usuários Auth, nomes livres, pgcrypto disponível, Realtime somente em `public.messages`, sem buckets/policies Storage conflitantes e sem colisões de funções/índices.
- [x] 2026-11-27 — Capturadas definições exatas do trigger `auth.users` e do handler `private.handle_new_user()`. ACLs atuais identificadas: grants amplos de tabela para anon/authenticated nas cinco tabelas prototype; UPDATE por coluna para authenticated em 13 colunas; nenhuma sequence em `public`; nenhuma ACL de sequence para restaurar.
- [x] 2026-11-27 — Corrigido voice_join para o limite aprovado de 10 participantes (a referência canônica ainda estava em 6).
- [x] 2026-11-27 — Corrigida ACL de funções: schema private com USAGE para authenticated/service_role e as seis RPCs internas de conta/autenticação com EXECUTE somente para service_role.
- [x] 2026-11-27 — Criado CUTOVER_PREFLIGHT.sql (somente leitura), com verificações de tabelas/dados, colisões, trigger Auth, pgcrypto, Realtime, Storage, índices, funções e papéis.
- [x] 2026-11-27 — Montado CUTOVER_DRAFT.sql em transação, com renomeação das cinco tabelas prototype, renomeação de índices legados, remoção do trigger Auth conflitante e criação do schema canônico completo. É somente rascunho de revisão, não aplicado.
- [x] 2026-11-27 — Criados CUTOVER_SNAPSHOT.sql e CUTOVER_ROLLBACK_PLAN.md. O rollback executável continua bloqueado até validar snapshot corrigido em todas as seções e testar em PostgreSQL isolado.
- [x] 2026-11-27 — Corrigidos dois pontos na referência canônica: voice_join agora respeita o limite aprovado de 10 participantes; ACL concede USAGE do schema private aos papéis que precisam executar policies/helpers e EXECUTE service_role às seis RPCs internas de autenticação/conta.
- [x] 2026-11-27 — Revisão estática cruzada dos SQLs canônicos, ACLs, funções, triggers, Storage, Realtime e dependências: 18 tabelas, 17 policies, 45 RPCs públicas, 13 funções privadas e 46 referências de colunas verificadas.
- [x] 2026-11-27 — Removida a funcionalidade musical da cópia paralela: exportação não consulta mais music_favorites/playlists; campo de última música removido do editor de perfil; integrações Spotify/Amazon Music e textos promocionais de atividade musical removidos. Arquivos originais em site/ e branch main preservados.
- [x] Branch isolada `shiqi-parallel-dev` e pasta `shiqi-parallel/`.
- [x] Projeto Vercel paralelo `shiqi-parallel`, Root Directory `shiqi-parallel/apps/web`.
- [x] Projeto Supabase paralelo `ujdosskjycrdkcgsswfa`, região São Paulo.
- [x] Copiados para `apps/web/` os arquivos originais do site: `index.html`, `app.js`, CSS, módulos JS, páginas legais, favicon e demais recursos.
- [x] `config.js` aponta para o Supabase paralelo, com chave publicável exclusiva.
- [x] CSP atualizada para permitir conexão ao Supabase paralelo, não ao projeto original.
- [x] README e arquitetura corrigidos para registrar preservação visual/funcional como requisito obrigatório.

## Em andamento
- [x] 2026-11-26 — Etapa 1 concluída por inspeção estática: matriz funcional, pontos de entrada, famílias de ações, contratos REST/RPC/Storage/Realtime/local e lista de regressão registrados em docs/FEATURE_PARITY_MATRIX.md. Não representa teste funcional real.
- [x] 2026-11-26 — Inventário de dependências do schema documentado em `docs/SCHEMA_DEPENDENCY_INVENTORY.md`.
- [x] 2026-11-26 — Contratos iniciais de autenticação documentados em `docs/AUTH_CONTRACT_INVENTORY.md`.
- [x] 2026-11-26 — Música excluída do escopo: migrations 0011 e 0012 removidas somente da pasta paralela; originals em `main` preservados.
- [x] Matriz de paridade funcional concluída em `docs/FEATURE_PARITY_MATRIX.md` em 2026-11-26, incluindo rotas, ações, persistência, contratos e critérios de regressão. Execução dos testes fica para a etapa de regressão.
- [ ] **Etapa 2 — reconciliação/migração do banco:** auditoria e recuperação de schema/ACLs concluídas documentalmente; cinco tabelas prototype incompatíveis, cinco migrations remotas e grants amplos a anon foram identificados. Próximo: consolidar migration/rollback, validar em PostgreSQL isolado e revalidar o destino antes de qualquer DDL.
- [x] 2026-11-27 — Edge Function Auth completa restaurada em `shiqi-parallel/supabase/functions/auth/index.ts` a partir da fonte versionada na raiz; origens antigas de produção removidas, URL padrão ajustada para o projeto paralelo e chave anon exigida por variável de ambiente. Sem deploy.
- [ ] Validar contratos da Edge Function Auth restaurada, dependências, JWT e variáveis de ambiente antes de conectar a UI. Revisão estática MFA concluída em 2026-11-27; testes de runtime continuam pendentes.
- [ ] Completar testes JWT assinados/negativos e validar algoritmo/chaves do projeto destino antes de integrar middleware.
- [ ] Preparar migrations incrementais, RLS, grants, Storage e Realtime; não aplicar remotamente sem revisão.
- [ ] Regressão de todos os fluxos que permanecem no produto.
- [ ] Preview Vercel depois que a janela de limite terminar; não contornar limite.

## Alinhamento de trabalho conjunto (2026-11-26)
- O usuário informou que Claude está preparado para acompanhar esta branch paralela e receber continuamente as atualizações. Trabalhar de forma coordenada: manter os arquivos de acompanhamento atualizados e registrar decisões para que qualquer IA continue do ponto correto.
- Antes de cada sessão/tarefa, ler integralmente `task.md` e `agents.md` da raiz; reler os arquivos de código relevantes antes de editá-los.
- Login por QR: decisão do usuário — deixar completamente de lado nesta grande atualização. Não investigar, reconstruir, implementar nem testar QR nesta etapa. Não remover nem alterar a interface original por causa disso; só retomar se o usuário pedir.
- As regras de isolamento desta branch e a preservação do app original prevalecem sobre qualquer instrução genérica de publicação em `main`: alterações desta migração ficam em `shiqi-parallel-dev`, sem tocar produção.

## Restrições
- Não alterar `main`, `site/`, `desktop/`, domínio principal ou produção.
- Preservar visual, navegação e funções restantes.
- Não repetir o teste de voz com 10 participantes, já realizado pelo usuário.
- Não aplicar migration no banco paralelo até schema compatível e plano revisado.
- Não publicar Edge Function, criar usuário de teste ou enviar e-mail sem preparação e autorização específicas.
- Não acessar o Supabase original sem acesso explicitamente concedido.

## Próximas ações técnicas
1. Inspecionar os componentes/scripts que ainda referenciam música e removê-los apenas da cópia paralela, preservando o restante do layout.
2. Continuar inventário de schema e contratos para servidores, canais, eventos, amizades, DMs, bloqueios, mensagens, anexos, voz e configurações.
3. Recuperar a migration base ausente de servidores e eventos; pedir ao usuário dump SQL somente de estrutura (sem dados) se não houver fonte Git autorizada.
4. Corrigir e testar autenticação antes de conectar a UI.
5. Expandir testes de JWT e middleware Rust; validar algoritmo e chaves antes da integração.
### 2026-11-26 — Recuperação de schema ausente via catálogo PostgreSQL
- Consultado o banco original somente com SELECT para recuperar as definições ausentes de `servers`, `server_members`, `channels`, `create_server`, `is_server_member`, `server_events`, `event_interest`, `create_event`, `delete_event` e `toggle_event_interest`.
- Recuperados também constraints, policies e colunas dessas tabelas. Regras de servidor, canais e eventos agora estão documentadas.
- Atualizados os docs de reconciliação e dependências. Não foi necessário pedir dump SQL ao usuário nesta fase.
- Banco original e paralelo continuam sem alterações.

### 2026-11-26 — Recuperação de migrations versionadas para etapa 2
- Inspecionados os diretórios de migrations na raiz e na cópia paralela da branch. Os SQLs originais 0001–0024 estão na raiz; a cópia paralela omite 0011/0012 (música) e contém a exceção de voz 0025.
- Lidos integralmente 0001, 0002, 0003, 0005, 0021 e 0024. 0002 contém a estrutura de mensagens e helpers, mas apenas resume a migration-base `servidores_e_canais`; 0021 é resumo, não SQL executável de eventos.
- Confirmada contagem de 18 tabelas-alvo sem música e sem QR. QR não será reconstruído.
- Atualizados `docs/DATABASE_RECONCILIATION_PLAN.md` e `docs/SCHEMA_DEPENDENCY_INVENTORY.md` com os achados e lacunas.
- Nenhum banco remoto foi alterado; nenhum SQL/DDL executado.

### 2026-11-26 — Etapa 2: auditoria do destino e plano inicial
- Consultados somente metadados do Supabase paralelo: tabelas/colunas/FKs, histórico de migrations, policies, funções, triggers, grants, buckets e publicação Realtime.
- Confirmadas incompatibilidades em profiles/channels/messages e que communities/community_members são modelo próprio. Cinco tabelas estão vazias; cinco migrations já constam no histórico remoto.
- Detectados: nenhum bucket no destino; Realtime apenas para messages; nenhuma RPC pública do app original; policies de communities; concessões diretas amplas a anon que precisam ser revistas/revogadas no hardening.
- Criado `docs/DATABASE_RECONCILIATION_PLAN.md` com inventário, estratégia sem perda, fases, decisões pendentes e bloqueio explícito de DDL até revisão.
- Nenhum SQL/DDL, migration, grant, bucket, policy, trigger, função, Realtime, dado ou Edge Function foi alterado.

### 2026-11-26 — Fechamento da etapa 1 e início da etapa 2
- Etapa 1 encerrada por inspeção estática: telas, rotas, grupos de ações, persistência local, REST/RPC, Storage, Realtime, APIs do navegador e placeholders foram registrados na matriz.
- Confirmado adapter de perfil: saveProfile faz PATCH em profiles; avatar é JPEG 256×256 no bucket avatars, com remoção do objeto anterior; anexos usam attachments e messages.attachment_path/attachment_alt.
- A lista de regressão foi consolidada. O smoke test da raiz aponta para ../site (app original), inclui fluxos legados e não serve como teste da cópia paralela; será criada/ajustada cobertura isolada na etapa de regressão.
- Limitação explícita: etapa 1 foi inspeção estática, sem teste real no navegador/banco paralelo. O app não está declarado funcional na nova infraestrutura.
- Iniciada a etapa 2 apenas como planejamento e recuperação de schema; nenhum SQL/DDL foi executado nem aplicado remotamente.

### 2026-11-26 — Continuação da etapa 1 (inspeção do app principal)
- Cruzadas as rotinas de loadWorld, mensagens/histórico, Realtime/polling, reações, tópicos, busca/menções, servidores/canais/convites, amizades/DMs/bloqueios, eventos e voz com as tabelas/RPCs correspondentes.
- Confirmado que favoritos de servidores e várias preferências ficam em localStorage; modais, navegação e controles visuais são estado local. Ações de negócio continuam delegadas a REST/RPC/RLS.
- Confirmado que a integração depende do schema original, inclusive messages bigint/thread_of, DMs e tabelas sociais ausentes no banco paralelo atual.
- QR permaneceu fora da inspeção e música fora do escopo. Nenhuma interface, funcionalidade, banco remoto ou produção foi alterada.

### 2026-11-26 — Continuação da etapa 1 (inspeção de módulos)
- Lidos os handlers de settings.js, settings-pages.js, settings-pages2.js, perfil.js, loja.js, home.js, baixar.js e mobile.js na cópia paralela.
- Documentado que preferências usam localStorage e sincronização RPC get_my_settings/save_my_settings; nome de usuário, senha, troca de e-mail e MFA têm rotas/RPCs próprios.
- Documentado que perfil salva dados/avatar pelo adapter SQ_API; avatares recentes, widgets e lista de desejos são locais; catálogo, missões, compras, Plus e pagamentos são placeholders/demonstrações sem persistência comercial.
- Documentados os comportamentos do download desktop e da dica mobile. Nenhum código de produto, interface, banco remoto ou produção foi alterado.

### 2026-11-26 — Início da execução da sequência aprovada
- **Escopo confirmado pelo usuário:** não criar novas funcionalidades; executar as etapas na ordem aprovada; preservar design e recursos existentes, com música excluída e QR fora do escopo.
- **Etapa 1 iniciada:** leitura integral de `task.md` e `agents.md` da raiz e do acompanhamento paralelo; inspeção estática dos scripts principais da cópia paralela.
- **Entregue nesta sessão:** primeira versão de `docs/FEATURE_PARITY_MATRIX.md` com áreas funcionais, contratos observados, dependências, bloqueios e lacunas de teste. Nenhum arquivo de interface, banco remoto, produção ou `main` foi alterado.
- **Achados iniciais:** o app paralelo referencia as tabelas e RPCs do produto original, mas o Supabase paralelo continua com cinco tabelas incompatíveis; autenticação versionada continua stub; `tests/smoke.js` na raiz aponta para `../site` (site original), portanto não valida a cópia paralela.
- **Próximo passo:** completar o cruzamento da matriz com todos os handlers e estados, separar persistência real de preferências locais/itens “em breve”, e elaborar a lista de regressão antes de marcar a etapa 1 concluída.

### 2026-11-26 — Continuação da reconciliação e dependências do protótipo
- Relidos os arquivos de acompanhamento e as regras permanentes antes de continuar.
- Revalidadas por SELECT as cinco tabelas atuais do destino: todas continuam com zero linhas.
- Recuperados os triggers e policies do protótipo: communities_add_owner, profiles_set_updated_at, o handler de auth.users e policies baseadas em is_community_admin/is_community_member. O handler atual cria perfis com username possivelmente nulo e precisa ser adaptado antes do schema canônico.
- Definida como estratégia preferida para revisão a preservação das cinco tabelas por renomeação controlada, sem conversão destrutiva de UUID para bigint e sem reutilizar as policies do protótipo. Ainda não há migration DDL nem autorização para executar alterações remotas.
- Encontrada diferença na função original voice_join: banco original usa 6; a branch paralela tem a exceção aprovada de 10 participantes. A migração manterá 10.
- A extração de todas as definições de função original em uma única consulta foi truncada pelo limite de saída; será refeita em lotes menores antes de produzir SQL consolidado.
- Nenhuma alteração remota em Supabase, produção, UI, domínio, main ou Vercel.

### 2026-11-26 — Continuação da extração automática de funções
- Relidos integralmente os arquivos de acompanhamento e o manual de trabalho antes da retomada.
- Refeita em lotes pequenos a extração por `pg_get_functiondef` no banco original, somente SELECT: 13 funções privadas e 45 assinaturas públicas (incluindo as duas sobrecargas de `send_friend_request`), sem truncamento.
- Recuperados corpos de servidores/canais/convites, exploração/destaques/fixados, amizades/DMs/bloqueios, moderação, eventos, perfil/configurações, reações, voz e rotinas internas de autenticação.
- Confirmada novamente a diferença: `voice_join` original = 6; destino paralelo deve manter 10 conforme autorização anterior.
- Registrados limites e pontos de segurança em `docs/REMOTE_SCHEMA_AUDIT.md`.
- QR não foi investigado; música continua excluída.
- Nenhum DDL, migration, grant, policy, bucket, trigger, Realtime, usuário, dado ou Edge Function foi alterado.
- Próximo passo: completar a auditoria estrutural exata de policies/constraints/grants e fechar a estratégia reversível para preservar o protótipo antes de gerar migrations do destino.

### 2026-11-26 — Policies, constraints e grants do original
- Recuperadas por SELECT as policies RLS das 18 tabelas-alvo, constraints funcionais/PK/FK, definições de colunas (tipo, nulabilidade, default e identidade) e grants efetivos de tabela.
- Confirmado que o original não concede acesso direto de tabela a `anon`; leitura direta do cliente é concedida a `authenticated` nas tabelas apropriadas, com RLS, e mutações sensíveis são mediadas por RPCs.
- Confirmado que `messages.id` é BIGINT identity ALWAYS; channels e DMs preservam a constraint de formato; settings, reações, mensagens e eventos têm limites exatos registrados.
- Atualizados `docs/REMOTE_SCHEMA_AUDIT.md` e `docs/DATABASE_RECONCILIATION_PLAN.md`.
- Nenhum DDL, migration ou alteração remota foi executado.
- Próximo passo: fechar índices/ACLs de função e confirmar o plano reversível de preservação do protótipo; só depois preparar migrations para revisão.

### 2026-11-26 — Índices e ACLs de funções
- Extraídos os índices reais das 18 tabelas-alvo e as ACLs explícitas por assinatura de função.
- Diferenciados grants explícitos de permissões herdadas via PUBLIC; identificados helpers privados e rotinas internas que exigem hardening no destino.
- Registrada a diretriz de não reproduzir grants históricos amplos de helpers/rotinas internas.
- Próximo passo: fechar o desenho reversível para isolar as cinco tabelas incompatíveis do protótipo e iniciar a montagem local do schema canônico, ainda sem executar DDL remoto.

### 2026-11-26 — Desenho reversível de preservação do protótipo
- Documentada proposta de isolamento das cinco tabelas incompatíveis por renomeação controlada para `legacy_*`, preservando OIDs, constraints, FKs, índices, policies, triggers e dados.
- Mapeadas dependências obrigatórias da mesma janela: trigger `auth.users`, grants legados, publicação Realtime e validação PostgREST.
- Documentado rollback separado, sem `DROP CASCADE` e sem remoção automática de dados.
- A proposta ainda exige conferência final dos objetos/colisões e revisão do SQL. Nenhuma renomeação ou DDL foi executada.
- Próximo passo: revisar o trigger de criação de perfil e a dependência da publicação Realtime; depois montar migrations locais para revisão.

### 2026-11-26 — Conferência final do trigger Auth no destino
- Recuperada integralmente a definição de `private.handle_new_user()` do Supabase paralelo.
- Confirmado conflito concreto: fallback atual insere username NULL, mas a tabela canônica exige username válido e NOT NULL; regex atual também difere.
- A função do trigger precisa ser adaptada na mesma migration que cria a nova `public.profiles`; os helpers de communities ficam associados ao legado.
- Nenhuma função, trigger, usuário ou dado foi alterado remotamente.

### 2026-11-26 — Storage, Realtime e trigger Auth
- Revalidados buckets/policies Storage e tabelas na publicação Realtime do original.
- Confirmado que o original não apresenta trigger não interno em `auth.users`, ao contrário do protótipo paralelo, que possui `on_auth_user_created_shiqi`.
- Revalidado destino: ativo/consultável, cinco tabelas públicas, zero linhas e zero buckets; histórico remoto segue com cinco migrations prototype.
- Corrigida a estratégia: inspecionar signup da Edge Function original antes de decidir o destino do trigger; não copiar nem remover o trigger às cegas.
- Nenhuma alteração remota.

### 2026-11-26 — Signup original e trigger prototype
- Inspecionada a Edge Function `auth` ativa v9 diretamente no Supabase.
- Confirmado que signup cria usuário via Admin API e insere o perfil explicitamente; o original não usa trigger Auth.
- Identificado conflito: trigger prototype no destino cria perfil antes do INSERT explícito da Edge Function, gerando duplicate key.
- Estratégia corrigida: remover o trigger prototype e função associada na migration de corte, sem criar trigger novo; manter criação explícita pela Edge Function.
- Achado adicional: `supabase/functions/auth/index.ts` versionado na branch está incompleto (2.259 bytes), enquanto v9 ativa é completa. Não publicar/sobrescrever; recuperar e reconciliar na etapa do backend.
- Nenhuma alteração remota.

### 2026-11-26 — DDL das tabelas e índices
- Gerado DDL de referência das 18 tabelas canônicas a partir de `pg_attribute`, `pg_attrdef` e `pg_constraint`; inclui identity, defaults, nullability, checks, PK/FK e ON DELETE.
- Gerados os índices não-PK diretamente de `pg_indexes`.
- Criados `docs/CANONICAL_TABLES.sql` e `docs/CANONICAL_INDEXES.sql` na branch paralela.
- Confirmados pontos sensíveis: `rate_hits` sem PK; `messages.id` bigint identity ALWAYS; dependências de ordem para canais/mensagens/reactions/eventos.
- Estes arquivos são referências, ainda não migrations prontas nem aplicadas.
- Próximo passo: gerar definições completas de RLS/funções/triggers e revisar o frontend/backend contra o contrato canônico; só depois montar a migration atômica e seu rollback.

### 2026-11-26 — Policies RLS exatas
- Extraídas as expressões completas de `pg_policies` em três lotes.
- Criado `docs/CANONICAL_RLS_POLICIES.sql` com as 17 policies existentes e RLS nas 18 tabelas.
- Confirmado que tabelas internas `email_codes`, `rate_hits`, `server_invites`, `server_bans`, `mfa_recovery` não possuem policies públicas; não adicionar policies genéricas.
- Arquivo depende de helpers privados/RPCs criadas previamente e é referência, não migration pronta.
- Próximo passo: revisar as definições dos helpers e das funções públicas para produzir SQL executável, ACLs e testes de contrato.

### 2026-11-26 — Helpers e triggers
- Recuperadas integralmente as 13 funções privadas do original e salvas em `docs/CANONICAL_PRIVATE_FUNCTIONS.sql`.
- Recuperada `public.is_server_member(uuid)` e os cinco triggers reais; salvos em `docs/CANONICAL_TRIGGERS.sql`.
- Definida ordem de montagem: tabelas → funções/helpers → triggers → RLS → grants.
- Arquivos são referências; ainda faltam RPCs públicas/ACLs para fechar migration completa.
- Nenhum DDL remoto.

### 2026-11-26 — RPCs de servidores
- Extraídas as definições completas de `create_server`, `create_channel`, `create_invite`, `join_server` e `join_public_server`.
- Criado `docs/CANONICAL_SERVER_RPCS.sql` como referência.
- Confirmados limites de servidores/canais, defaults de convite, lock de convite, bloqueio por ban e limites de membership.
- Próximo grupo: RPCs de amizade/DM e bloqueios; depois demais funções públicas e ACLs.
- Nenhuma alteração remota.


### 2026-11-26 — Continuação da recuperação das RPCs canônicas
- Relidos `task.md` e `agents.md` da raiz, além do acompanhamento paralelo e do plano de reconciliação.
- Consultado o catálogo do projeto original somente com SELECT e extraídas as definições completas de 40 funções públicas não relacionadas a música/QR, em lotes menores para evitar truncamento.
- Criados na branch `shiqi-parallel-dev`:
  - `docs/CANONICAL_SOCIAL_PROFILE_RPCS.sql` — amizades, DMs, bloqueios, perfil e configurações (15 definições, incluindo sobrecarga).
  - `docs/CANONICAL_MODERATION_EVENTS_VOICE_RPCS.sql` — moderação, reações, eventos, voz, exploração e destaques (17 definições).
  - `docs/CANONICAL_AUTH_ACCOUNT_RPCS.sql` — rotinas internas de autenticação e ciclo de vida da conta (8 definições).
- As definições foram extraídas com `pg_get_functiondef` do banco original; são referências para reconciliação, não migrations prontas.
- QR e música permaneceram excluídos. Nenhum DDL, migration, grant, policy, bucket, trigger, Realtime, usuário ou dado foi alterado em qualquer banco.
- Próximo passo: validar que a lista de funções extraídas cobre exatamente o inventário público não musical, revisar dependências e ACLs por assinatura, e auditar Storage policies/grants/Realtime antes de consolidar a migration reversível.


### 2026-11-26 — Storage e segurança das funções
- Reextraídas por SELECT as sete policies reais de `storage.objects` e os metadados dos buckets originais.
- Criado `docs/CANONICAL_STORAGE_POLICIES.sql` com as policies de leitura, envio, atualização e remoção limitadas à pasta do próprio usuário.
- Confirmados buckets públicos: `attachments` (3 MiB; JPEG/PNG/WebP/GIF) e `avatars` (1 MiB; JPEG/PNG/WebP).
- Extraído o inventário de ACLs e propriedades de segurança das funções `public` e `private`: SECURITY DEFINER, search_path e permissões explícitas. As rotinas internas de autenticação ficam restritas a `service_role`; funções de cliente usam `authenticated` conforme o contrato original.
- Ainda falta transformar a ACL em referência revisável por assinatura e validar o comportamento efetivo de privilégios herdados de PUBLIC. Nenhuma alteração remota foi feita.
- Próximo passo: concluir a matriz de ACLs e fazer preflight atualizado no destino (colisões `legacy_*`, contagens, migrations, grants, policies e Realtime), sem executar DDL.


### 2026-11-26 — ACLs de funções e preflight do destino
- Consultado `has_function_privilege` no original para verificar permissões efetivas por função, além da ACL gravada. Isso revelou que algumas funções privadas com ACL NULL herdam EXECUTE de PUBLIC no original; a cópia paralela não repetirá essa exposição.
- Criado `docs/CANONICAL_FUNCTION_ACL.sql` com a matriz de permissões planejada: RPCs de cliente para `authenticated`, rotinas internas de autenticação somente `service_role`, helpers chamados diretamente por RLS com EXECUTE para `authenticated`, e funções exclusivas de trigger sem grants de API. É referência de hardening e precisa de teste de chamadas sob os papéis reais.
- Preflight somente leitura no destino `ujdosskjycrdkcgsswfa`: as cinco tabelas prototype continuam presentes; cinco nomes `legacy_*` estão livres; nenhuma colisão de nomes detectada; bucket nenhum; Realtime ainda contém apenas `public.messages`; trigger `on_auth_user_created_shiqi` permanece em `auth.users`; cinco migrations prototype continuam registradas.
- As cinco tabelas continuam sem dados na última auditoria; ainda será exigida nova contagem imediatamente antes de qualquer corte.
- Não foi executado DDL nem alterado qualquer banco. A migration ainda não está pronta para aplicação: faltam validar cada arquivo SQL de referência contra o catálogo, resolver todas as dependências de funções privadas/trigger e fechar o rollback/testes de permissões.

### 2026-11-26 — Continuação: inventário completo de funções e grants

- Relidos os três arquivos de acompanhamento antes da retomada. Mantidas as regras de isolamento da branch e preservação integral da interface/funcionalidades restantes.
- Consultado novamente o catálogo do Supabase original por SELECT: confirmadas as 13 funções privadas e 45 assinaturas públicas fora de música (inclui as duas sobrecargas de send_friend_request). Foram conferidos schema, argumentos, SECURITY DEFINER, search_path e ACL explícita por assinatura.
- Conferida a matriz de ACLs: RPCs de produto têm grants explícitos para authenticated/service_role; rotinas de autenticação/gestão sensível ficam apenas com service_role. Helpers privados chamados diretamente por policies precisam de EXECUTE para authenticated; helpers internos e triggers não devem ser expostos.
- Conferidos os grants de tabela no original: authenticated recebe SELECT somente nas tabelas de leitura direta protegidas por RLS e DELETE em messages; tabelas internas não recebem acesso de cliente. service_role/postgres mantêm privilégios administrativos. A migration deve reproduzir esse modelo mínimo, não os grants amplos do protótipo.
- Reconfirmados buckets Storage e limites: attachments público, 3 MiB, JPEG/PNG/WebP/GIF; avatars público, 1 MiB, JPEG/PNG/WebP. Realtime canônico continua sendo friendships, messages e voice_members.
- Revisão permanece documental: nenhum DDL, migration, grant, policy, bucket, trigger, publicação Realtime, dado ou Edge Function foi alterado remotamente.
- Próximo passo: completar a revisão de grants de sequência/colunas e das dependências de policies/Realtime; então consolidar a migration e o rollback em arquivos locais da branch para revisão, sem aplicar ao Supabase até autorização explícita.

### 2026-11-26 — Auditoria ampliada do schema e permissões

- Inventário integral confirmado: 45 RPCs públicas e 13 funções privadas fora de música/QR. As definições estão distribuídas nos cinco arquivos CANONICAL_*_RPCS.sql e CANONICAL_PRIVATE_FUNCTIONS.sql. Conferida a cobertura de assinaturas do arquivo CANONICAL_FUNCTION_ACL.sql.
- Recuperada matriz de grants de tabelas e colunas com information_schema. Criado docs/CANONICAL_TABLE_ACL.sql: leitura sob RLS para as tabelas autorizadas, permissões de mensagem, campos específicos de perfil, sequence identity e revogação explícita de grants por coluna. Ainda é referência e precisa passar por validação isolada e testes antes de integrar à migration.
- Policies RLS reconsultadas no original: 17 policies do produto (música excluída), todas para authenticated. Tabelas internas sem policy pública. Confirmado messages.author_id DEFAULT auth.uid().
- Storage: attachments público, limite 3 MiB e JPEG/PNG/WebP/GIF; avatars público, 1 MiB e JPEG/PNG/WebP. Realtime original: friendships, messages, voice_members.
- Novo preflight somente leitura do destino: profiles, communities, community_members, channels e messages permanecem com zero linhas; cinco migrations prototype continuam registradas. Sem DDL remota.
- Consulta direta de ACL por aclexplode em coluna falhou por formato de array; substituída com sucesso por information_schema.column_privileges. Nenhum dado foi modificado.
- Estado real: a documentação de schema/ACL está substancialmente recuperada, mas a migration atômica e rollback executáveis ainda precisam de validação isolada. A Edge Function auth ativa v9 ainda não foi recuperada integralmente para o Git; não conectar frontend nem publicar backend até resolver isso.
- Commits desta rodada: 4cb88f6 adiciona matriz de grants; c94a2e0 corrige revogação de grants por coluna; 5d64b12 consolida o plano. Tudo exclusivamente em shiqi-parallel-dev.

### 2026-11-26 — Backend Auth v10 recuperado

- Recuperada do Supabase original a Edge Function auth ativa, versão 10 (ACTIVE, verify_jwt=false), incluindo index.ts completo (30.767 bytes) e mail.ts (7.951 bytes).
- Atualizados os dois arquivos em supabase/functions/auth/ exclusivamente na branch shiqi-parallel-dev. A cópia truncada de 2.259 bytes foi substituída pela fonte ativa completa. Não houve deploy.
- Rotas presentes: signup, verify, resend, login, login/totp, forgot, reset, email/change/request, email/change/confirm, account/deactivate, account/delete, mfa/recovery, mfa/disable e GET /health. QR não consta nesta versão.
- RPCs chamadas: rate_check, get_auth_user_by_email, verify_email_code, get_login_email_by_username, revoke_user_sessions e purge_user_data. Variáveis lidas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SITE_URL, EXTRA_ORIGINS, RESEND_API_KEY, RESEND_FROM, BRAND_NAME.
- Nenhum segredo de service role foi copiado; segredos permanecem no Supabase. A chave publishable fallback é pública. Original e destino permanecem sem alteração remota.
- Próximo passo: validar dependências de Auth, compatibilidade das RPCs/tabelas, build/checagem estática e testes de contrato; não publicar nem conectar frontend antes do aceite de regressão.

### 2026-11-26 — Revisão de dependências SQL e ACL explícita

- Revisão estática detectou que private.can_post (LANGUAGE SQL) referencia private.dm_allowed; o bloco dm_allowed foi movido antes de can_post em CANONICAL_PRIVATE_FUNCTIONS.sql.
- CANONICAL_FUNCTION_ACL.sql agora revoga EXECUTE explicitamente nas 58 assinaturas (45 public + 13 private), revoga USAGE do schema private e reaplica somente as permissões allow-list. Antes havia apenas comentário para revogação; corrigido.
- Não foi possível rodar parser PostgreSQL/TypeScript nesta sessão: psql, Deno, sqlfluff e pg_format não estão instalados. Os arquivos não devem ser tratados como compilados/testados; validação em branch descartável e runtime Deno permanece obrigatória.
- Commits: ef1fff0 (ordem de helpers), 76a9546 (revogação de ACL), f57bdaef (registro no plano).

### 2026-11-26 — Checklist de validação pós-migration

- Criado docs/POST_MIGRATION_VALIDATION.sql com consultas somente leitura para validar as 18 tabelas, RLS, 17 policies, 45 RPCs públicas, 13 funções privadas, Storage, Realtime, remoção do trigger Auth prototype e exclusão de música/QR.
- O checklist ainda não foi executado porque a migration não foi aplicada. A etapa requer primeiro validar o pacote em banco descartável/branch de desenvolvimento.
- Commit: c8d36ac (checklist); 720af91 (plano).

### 2026-11-27 — Revisão estática inicial do pacote canônico
- Cruzados os arquivos de tabelas, índices, RLS, funções privadas, triggers, RPCs, ACLs, Storage e validação pós-migration.
- Corrigida a contagem do checklist: são 18 tabelas canônicas e 17 policies RLS, não 18 policies. A lista de policies do arquivo `CANONICAL_RLS_POLICIES.sql` contém 17 entradas e cobre as regras documentadas.
- Removida a definição duplicada de `public.unban_member` do arquivo de RPCs de autenticação; ela permanece no grupo de moderação, evitando criar a mesma RPC em dois blocos de referência.
- Nenhum SQL foi executado no Supabase. A migration e o rollback ainda não foram montados nem validados em PostgreSQL; revisão estática continua.
- [x] 2026-11-27 — Criadas referências separadas para criação/verificação segura dos buckets Storage (docs/CANONICAL_STORAGE_BUCKETS.sql) e associação da publicação Realtime (docs/CANONICAL_REALTIME.sql). Os arquivos falham diante de configuração inesperada e ainda não foram executados.
- [ ] Consolidar os SQLs canônicos em migration revisável e rollback, após terminar a conferência de dependências e obter validação PostgreSQL isolada.

### 2026-11-27 — Remoção da funcionalidade musical na cópia paralela
- Removidas as consultas REST para music_favorites e playlists do fluxo de exportação de dados; removidos os campos musicais do JSON exportado.
- Removido o campo de última música do editor de perfil e os handlers associados; removidas as opções Spotify/Amazon Music do catálogo de conexões.
- Ajustadas as referências promocionais/status que apresentavam reprodução musical como recurso da SHIQI. A alteração ficou restrita a shiqi-parallel/apps/web; site/, desktop/ e main não foram alterados.
- Verificação estática confirmou ausência das chamadas/telas musicais nos arquivos editados. Não houve execução de smoke test nem deploy, pelas restrições documentadas acima.

### 2026-11-27 — Cruzamento estático das referências canônicas
- Conferidos 18 objetos de tabela, RLS em todos, 17 policies, 45 RPCs públicas e 13 funções privadas; corrigida a expectativa incorreta de 18 policies no checklist.
- A cobertura nominal de funções na ACL corresponde às definições; as 46 referências de colunas na ACL existem nas tabelas canônicas; as policies e chamadas a helpers privados apontam para objetos documentados.
- A definição duplicada de unban_member foi removida do arquivo Auth. Referências SQL de Storage e Realtime foram adicionadas e documentadas.
- Limitação: nenhuma validação PostgreSQL em runtime nem teste de rollback. O conector Supabase negou leitura do projeto paralelo nesta sessão; nenhum DDL remoto foi executado.


### 2026-11-27 — Revisão complementar de cutover/rollback
- Releitura integral das instruções e do acompanhamento; branch confirmada em `shiqi-parallel-dev`.
- A conexão Supabase vinculada à SHIQI retornou `permission denied` em `get_project`, `list_tables` e `list_migrations`; isso não permite inferir status pausado/ativo. Nenhuma consulta SQL nem alteração remota foi executada nesta retomada.
- Revisão estática do draft confirmou 18 tabelas com RLS habilitada, 17 policies de produto + 7 policies Storage, 45 assinaturas públicas (44 nomes distintos) e 13 helpers privados; as funções definidas possuem entradas nominais de REVOKE na ACL.
- Encontradas lacunas documentais no rollback: o cutover revoga privilégios de sequences e as policies Storage não estavam explicitadas na ordem de reversão. Atualizados `CUTOVER_SNAPSHOT.sql` e `CUTOVER_ROLLBACK_PLAN.md` para capturar/restaurar esses itens, incluir grants de tabela a PUBLIC e remover as sete policies Storage no rollback.
- Removidas quatro linhas duplicadas de GRANT service_role no draft. Nenhuma migration foi executada; rollback ainda NÃO é executável porque falta snapshot real, validação em PostgreSQL isolado e confirmação do destino.
- Commits desta retomada: `dd82dec` (snapshot), `283d303` (rollback), `85cdfab` (draft).
- Próximo passo: restaurar leitura autorizada do Supabase paralelo, executar somente os SQLs de preflight/snapshot, conferir resultados e então finalizar o rollback executável/testar ambos em PostgreSQL isolado. Não executar o draft.


### 2026-11-27 — Retomada: preflight e snapshot do Supabase paralelo
- Confirmado HEAD inicial da branch `shiqi-parallel-dev` em `19c98a96b9d0441bef511c9fad9733a9dc8b2705`; relidos `agents.md` e `shiqi-parallel/task.md` antes de prosseguir.
- Identificada a conexão correta: `Primary` aponta para `shiqi-parallel` (`ujdosskjycrdkcgsswfa`, ACTIVE_HEALTHY); a conexão `shiqi` apontava para o projeto antigo `square`. Nenhuma mudança de permissão solicitada ao usuário.
- Executado o `CUTOVER_PREFLIGHT.sql` em leitura. Para tornar os resultados individualmente auditáveis, os checks foram repetidos em uma consulta consolidada; os 17 checks passaram. Cinco tabelas prototype existem e estão vazias; `auth.users` tem zero contas; trigger/handler esperados existem; pgcrypto está em `extensions`; Realtime contém somente `public.messages`; não há buckets nem policies Storage canônicas; os nomes de tabelas, índices e funções canônicas estão livres (índices existentes pertencem às tabelas prototype que serão renomeadas).
- Capturados metadados do snapshot: definição do trigger `AFTER INSERT ON auth.users ... EXECUTE FUNCTION private.handle_new_user()`, corpo integral do handler, policies, triggers, índices, constraints, publicação Realtime, histórico das cinco migrations e helpers privados.
- A primeira execução do snapshot falhou porque `information_schema.sequence_privileges` não existe no PostgreSQL do projeto. Nenhuma alteração foi feita. O arquivo foi corrigido no commit `7a693e3`, usando `pg_class` + `aclexplode` para ACLs de tabela, coluna e sequence, incluindo PUBLIC e privilégio PG17 MAINTAIN.
- O cruzamento das ACLs mostrou grants amplos de tabela a `anon` e `authenticated` nas cinco tabelas prototype; grants de UPDATE por coluna para authenticated em 13 colunas; nenhum grant a PUBLIC observado; nenhuma sequence no schema public. O catálogo mostra também o privilégio PG17 MAINTAIN, não exibido pelas views information_schema usadas antes.
- Atualizado `CUTOVER_ROLLBACK_PLAN.md` no commit `61dcd4a` com os achados e a correção. Nenhum DDL/DML remoto, migration, deploy ou alteração de produção foi executado.
- Próximo passo: executar o snapshot corrigido em consultas separadas e conferir todas as seções, revisar o rollback contra as ACLs reais e buscar um PostgreSQL isolado para validação de parser/runtime. O draft continua proibido de execução até validação e aprovação explícita.


### 2026-11-27 — Complemento do snapshot de permissões de schema
- A revisão do draft revelou mais um objeto afetado pelo cutover: a ACL do schema `private` é redefinida (REVOKE USAGE para PUBLIC/anon/authenticated/service_role e GRANT para authenticated/service_role). O snapshot anterior não capturava ACL de schema.
- Consulta somente leitura ao catálogo `pg_namespace` confirmou: schema `private` pertence a postgres; USAGE concedido somente a authenticated; nenhum USAGE para anon, service_role ou PUBLIC. Schema `public` tem USAGE para PUBLIC/anon/authenticated/service_role e CREATE/USAGE do owner pg_database_owner.
- Adicionada captura de ACLs dos schemas private/public a `CUTOVER_SNAPSHOT.sql` (commit `95c1871`) e etapa explícita de restauração ao rollback (commit `8859ff3`).
- Ferramentas locais verificadas: Node.js 22/npm 10 disponíveis; psql, postgres, Docker e Podman não estão instalados. Supabase não possui branches de desenvolvimento existentes. Uma branch Supabase isolada custa US$ 0,01344 por hora; não criar sem aprovação expressa do usuário.
- Próximo passo: validar a execução integral do snapshot corrigido em seções separadas, concluir a revisão das operações do draft que alteram estado (ACL, trigger, Realtime, Storage) e pedir aprovação somente se for necessário criar a branch isolada para testes PostgreSQL.


### 2026-11-27 — Restauração da Edge Function Auth na cópia paralela
- Identificada divergência entre a documentação e o arquivo: a implementação completa (30.767 bytes) existia em `supabase/functions/auth/index.ts` na raiz do repositório, mas a cópia paralela tinha somente 2.206 bytes e não continha `Deno.serve` nem handlers.
- Restaurada a implementação completa em `shiqi-parallel/supabase/functions/auth/index.ts` no commit `0b61202ba9cd7f4d809e52253ef8ef7471b15a66`; validações de secrets e metadado `via: shiqi` adicionados no commit `6ed90d08bc5230c03e3169d529246be1cbc8ca27`.
- Adaptada a cópia paralela: `SUPABASE_ANON_KEY` passou a ser obrigatória via secret, com validação explícita dos três secrets essenciais; `SITE_URL` usa por padrão `https://shiqi-parallel.vercel.app`; origens do domínio e deploys antigos de produção foram removidas da allow-list. Origens de preview podem ser adicionadas por `EXTRA_ORIGINS`. Metadado de origem de novas contas atualizado para `shiqi`.
- Revisão estática confirmou 13 rotas POST + GET `/health`; as tabelas `profiles`, `email_codes`, `mfa_recovery` e as seis RPCs utilizadas estão presentes nas referências SQL canônicas.
- Atualizado `docs/AUTH_CONTRACT_INVENTORY.md` para corrigir o diagnóstico anterior. O prefixo HMAC histórico `square-v1:` foi preservado.
- Limitação: nenhuma checagem Deno/runtime, teste JWT, conexão da UI, envio de e-mail ou deploy foi executado. Não houve alteração no Supabase nem em produção.
- Conferidos estaticamente os 13 endpoints contra `apps/web/app.js` e `settings-pages.js`: rotas e nomes dos payloads correspondem; o gerenciamento de cadastro/verificação TOTP usa Supabase Auth REST diretamente, enquanto a Edge Function trata recuperação e desligamento MFA. Detalhes registrados em `docs/AUTH_CONTRACT_INVENTORY.md` (commit `6ca01d5`).
- Próximo passo: revisar as regras de segurança/ACL e preparar testes de contrato antes da integração.


### 2026-11-27 — Revisão de segurança MFA e matriz de ACL
- Corrigido o fluxo de recuperação MFA: agora verifica erros ao consumir códigos, limpar os códigos restantes e excluir o fator; após remover o fator verificado, gera uma sessão nova, pois o Supabase revoga as sessões ativas ao excluir o fator.
- Corrigido o desligamento MFA nas configurações: backend valida erros de limpeza/exclusão e frontend encerra a sessão local após sucesso, orientando novo login. Referência: https://supabase.com/docs/reference/javascript/auth-admin-deletefactor
- Corrigida a renovação de códigos de recuperação para não ignorar falhas ao apagar códigos antigos ou inserir os novos.
- Auditoria estática da ACL: 58 definições (45 public + 13 private), 58 REVOKEs exatos, nenhum faltante/excedente, nenhum GRANT duplicado ou apontando para função ausente. Sete funções privadas sem GRANT explícito são helpers internos/trigger-only, intencionalmente restritos.
- Encontrada lacuna de dependência: `public.is_server_member(uuid)` era chamada por três policies e referenciada pela ACL, mas faltava em todos os arquivos SQL canônicos. Adicionada implementação mínima `SECURITY DEFINER` com `search_path` vazio em `CANONICAL_SERVER_RPCS.sql`, baseada na semântica documentada. Como a migration-base `servidores_e_canais` não está no Git, comparar a reconstrução com a definição do banco original antes de aplicar.
- Confirmado por inspeção estática: 18 tabelas e RLS habilitada em todas; 17 policies canônicas.
- Atualizado `docs/AUTH_CONTRACT_INVENTORY.md` com achados e limites. Commits: `5a59fcd` (tratamento inicial de erros MFA), `0aed03d` (grants duplicados), `c6a636a` (helper de associação), `2991b06` (sessão nova após recuperação), `b3e50b4` (logout após desligar MFA), `437e646` (documentação).
- Nenhum teste Deno/PostgreSQL/runtime foi executado; nenhuma migration, SQL, secret, e-mail, deploy ou banco remoto foi alterado.
- Próximo passo (corrigido no registro de 27/11): revisar contratos de Auth restantes e dependências do schema; a definição de `is_server_member` está preservada em `CANONICAL_TRIGGERS.sql` e no draft.

### 2026-11-27 — Testes estáticos de contrato Auth
- Criado `shiqi-parallel/tests/auth-contract-static.js`, sem dependências externas, para verificar as 13 rotas, secrets obrigatórios, isolamento de origens, ausência de rota QR, tabelas/RPCs Auth, helper `is_server_member`, RLS nas 18 tabelas, 17 policies, 58 REVOKEs e tratamento da revogação de sessões MFA.
- As mesmas condições foram verificadas por leitura dos arquivos na branch e passaram. O script foi versionado, mas ainda não foi executado no checkout local; não representa teste de Deno, JWT, Auth, PostgreSQL ou e-mail.
- Commit do teste: `9b7e78d`; simplificação/correção das assertions: `096bc7c` e `6585b73`.
- A primeira revisão marcou incorretamente `is_server_member` como reconstruída; ver correção logo abaixo: a definição já existia em `CANONICAL_TRIGGERS.sql` e no draft.
- Nenhuma alteração em banco remoto, migration, secret, e-mail, deploy, produção ou branch `main`.
- Próximo passo: obter/confirmar a definição original da função base ausente e continuar a revisão dos contratos restantes; só depois consolidar migration final e rollback.

### 2026-11-27 — Correção da auditoria de is_server_member
- Uma segunda conferência do pacote completo mostrou que `public.is_server_member(uuid)` já estava definida em `CANONICAL_TRIGGERS.sql` e em `CUTOVER_DRAFT.sql`. A varredura anterior havia omitido o arquivo de triggers e produziu um falso alerta de função ausente.
- A cópia redundante adicionada temporariamente em `CANONICAL_SERVER_RPCS.sql` foi removida. A definição canônica original preservada não foi modificada.
- O teste estático foi ajustado para buscar a função em `CANONICAL_TRIGGERS.sql`; documentação corrigida para registrar a origem correta.
- Não há mais bloqueio por ausência de `is_server_member`; a migration-base `servidores_e_canais` continua sem arquivo versionado, mas a função auxiliar está presente nos arquivos canônicos/draft.
- Commits: `4413d82` (remoção da duplicata), `eb907d1` (teste), `f810b5c` (documentação).

### 2026-11-27 — Auditoria de autorização e privacidade de perfis
- Revisados os contratos SQL de servidores/canais/convites, amizades/DMs/bloqueios/perfis, moderação/eventos/voz, helpers privados, triggers e policies RLS.
- Confirmado que kick/ban delegam a `private.remove_from_server`, que exige usuário autenticado e propriedade do servidor; operações de eventos e bans também verificam o proprietário, e operações sociais mutam apenas linhas vinculadas ao usuário autenticado ou à solicitação correspondente.
- Encontrada uma falha de privacidade: `private.shares_server_with` tratava amizade pendente como vínculo válido. Isso podia liberar a função `profiles_full` e a policy de leitura de perfis antes do aceite da amizade.
- Corrigidos `CANONICAL_PRIVATE_FUNCTIONS.sql` e `CUTOVER_DRAFT.sql` para exigir `friendships.status = 'accepted'` no ramo de amizade. O vínculo por servidor compartilhado permanece permitido.
- Ampliado `tests/auth-contract-static.js` para verificar tanto o helper quanto a cópia dentro do cutover draft. Verificação pós-commit por leitura dos arquivos confirmou as duas condições; o script Node completo e os testes RLS em runtime ainda não foram executados.
- Commits: `de1b194` (helper), `f388097` (draft), `aa3e415` (teste), `f718add` (task).
- Nenhuma alteração em banco remoto, migration aplicada, usuário Auth, secret, deploy, produção ou branch `main`.
- Próximo passo: implementar em conjunto bucket privado de anexos, signed URLs e policy de leitura por participação; continuar revisão de concorrência das RPCs; depois revisar rollback e snapshot.
### 2026-11-27 — Proteção concorrente da sala de voz
- Durante a revisão de RPCs, identificado que a contagem de vagas em `voice_join` não era serializada; chamadas simultâneas poderiam ultrapassar o limite de 10 mesmo com a verificação `n >= 10`.
- Adicionados advisory transaction locks por usuário e por canal, sempre na ordem usuário → canal, antes da limpeza e contagem. Isso também serializa duas chamadas simultâneas do mesmo usuário para canais diferentes.
- Alterados `CANONICAL_MODERATION_EVENTS_VOICE_RPCS.sql`, `CUTOVER_DRAFT.sql` e `tests/auth-contract-static.js`; `SECURITY_AUDIT.md` documenta o risco e a correção.
- Verificação pós-commit estática pendente após salvar; teste de concorrência real em PostgreSQL continua não executado por decisão de evitar setup local.


### 2026-11-27 — Anexos privados e signed URLs
- Revisados os fluxos completos de upload/renderização em `apps/web/app.js`, os contratos de DM e os SQLs de Storage.
- Alterado o bucket `attachments` para `public = false` em `CANONICAL_STORAGE_BUCKETS.sql` e no draft. O bucket `avatars` continua público.
- Criado `private.can_read_attachment(text)`: associa o caminho a uma mensagem real, exige membro atual do servidor para canais de texto e, em DMs, exige membro ativo. O remetente mantém acesso ao próprio anexo enquanto a solicitação está pendente; o destinatário só ganha acesso depois de aceitar. Participantes ativos também precisam passar por `private.dm_allowed`, que respeita bloqueios.
- Substituída a policy `attachments_select_own` por `attachments_select_message_member`; INSERT/DELETE continuam limitados à pasta do usuário. Incluída a função na ACL: 59 REVOKEs e EXECUTE para authenticated.
- Frontend agora solicita signed URLs autenticadas com expiração de 60 segundos e cache local de 50 segundos; removida a montagem de URL pública. Erros não caem para URL pública.
- Atualizados teste estático, relatório de segurança e plano de rollback. Verificações pós-commit de conteúdo ainda serão feitas; não foi executado o teste Node completo nem integração Storage/PostgreSQL.
- Nenhuma migration, policy, bucket, função ou dado foi alterado no Supabase remoto; sem deploy ou alteração em produção.
- Próximo passo: revisar consistência e sintaxe dos arquivos alterados, conferir referências à policy antiga e validar contratos Realtime/mensagens/DMs restantes.

- Verificação adicional da etapa de anexos: o teste `auth-contract-static.js` passou em harness JavaScript em memória com os 16 arquivos atuais da branch. A análise de sintaxe de `apps/web/app.js` e do teste também passou. O script não foi executado em um processo Node real e não houve teste de Storage/PostgreSQL em runtime.
