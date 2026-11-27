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
- [ ] 2026-11-26 — Iniciada a etapa 1 da sequência aprovada pelo usuário: fechar a matriz funcional da SHIQI, mapeando telas, operações, RPCs, tabelas, estados e critérios de regressão. Escopo fechado: sem novas funcionalidades; QR fora desta etapa; música excluída; preservar UI e funções restantes.
- [x] 2026-11-26 — Inventário de dependências do schema documentado em `docs/SCHEMA_DEPENDENCY_INVENTORY.md`.
- [x] 2026-11-26 — Contratos iniciais de autenticação documentados em `docs/AUTH_CONTRACT_INVENTORY.md`.
- [x] 2026-11-26 — Música excluída do escopo: migrations 0011 e 0012 removidas somente da pasta paralela; originals em `main` preservados.
- [ ] Completar/revisar matriz de paridade funcional em `docs/FEATURE_PARITY_MATRIX.md`, detalhando campos, filtros, estados e critérios de regressão. Primeira versão e complemento de persistência/configurações/loja registrados em 2026-11-26; ainda falta cruzamento integral de app.js, telas/rotas e testes.
- [ ] Recuperar SQL ausente da base de servidores/canais e dos eventos por fonte Git autorizada ou material fornecido pelo proprietário. Histórico Git acessível já pesquisado sem localizar o SQL base.
- [ ] Reconciliar o schema paralelo de cinco tabelas com o modelo alvo sem drops/renames destrutivos.
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
