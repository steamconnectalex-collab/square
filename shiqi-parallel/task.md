# SHIQI — acompanhamento

Última atualização: 2026-11-27

## Requisito central
**Migrar tecnologia sem mudar design, layout, identidade visual, navegação ou qualquer funcionalidade do aplicativo original que permaneça no escopo.** O diretório `site/` da raiz é a fonte de verdade. Música foi explicitamente retirada do produto pelo usuário e poderá ser removida somente da cópia paralela. Nenhuma outra simplificação/remoção de função sem autorização expressa.

## Em andamento agora
- [ ] Revisão estática cruzada dos SQLs canônicos, ACLs, funções, triggers, Storage, Realtime e dependências do frontend; preparar migration reversível apenas para revisão, sem aplicar no Supabase.

## Bloqueios atuais (27/11/2026)
- O conector Supabase retornou permissão negada ao tentar consultar o projeto paralelo ujdosskjycrdkcgsswfa nesta sessão. Nenhum SQL foi executado; não concluir que o projeto está pausado apenas por esse erro.
- A Vercel continua com a última implantação READY, mas ela aponta para o commit 1a6f6706, anterior às alterações recentes de frontend. A proteção SSO está habilitada. Não disparar novo deploy enquanto a restrição/janela de limite registrada no projeto não terminar.
- O smoke test existente na raiz aponta para o site original e não valida a cópia paralela; não foi executado para evitar testar/altear o alvo errado.

## Concluído
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
- [ ] **Etapa 2 — planejamento/reconciliação do banco:** plano inicial criado em `docs/DATABASE_RECONCILIATION_PLAN.md`. Auditoria somente leitura confirmou cinco tabelas incompatíveis e vazias, cinco migrations remotas, ausência de RPCs do app original, ausência de buckets e Realtime apenas em messages; políticas são do modelo communities e há grants amplos a anon que exigem hardening. Próximo: recuperar SQL base ausente, fechar dependências e revisar estratégia sem DDL.
- [ ] Reconstruir e testar contratos de autenticação; o arquivo versionado atual é apenas stub.
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
