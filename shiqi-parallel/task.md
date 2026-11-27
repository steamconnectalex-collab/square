# SHIQI — acompanhamento

Última atualização: 2026-11-26

## Requisito central
**Migrar tecnologia sem mudar design, layout, identidade visual, navegação ou qualquer funcionalidade do aplicativo original que permaneça no escopo.** O diretório `site/` da raiz é a fonte de verdade. Música foi explicitamente retirada do produto pelo usuário e poderá ser removida somente da cópia paralela. Nenhuma outra simplificação/remoção de função sem autorização expressa.

## Concluído
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
