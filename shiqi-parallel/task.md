# SHIQI — acompanhamento

Última atualização: 2026-11-26

## Requisito central
**Migrar tecnologia sem mudar design, layout, identidade visual, navegação ou qualquer funcionalidade do aplicativo original.** O diretório `site/` da raiz é a fonte de verdade. Nenhum redesign, simplificação ou remoção de função sem autorização expressa.

## Concluído
- [x] Branch isolada `shiqi-parallel-dev` e pasta `shiqi-parallel/`.
- [x] Projeto Vercel paralelo `shiqi-parallel`, Root Directory `shiqi-parallel/apps/web`.
- [x] Projeto Supabase paralelo `ujdosskjycrdkcgsswfa`, região São Paulo.
- [x] Copiados para `apps/web/` os arquivos originais do site: `index.html`, `app.js`, CSS, módulos JS, páginas legais, favicon e demais recursos.
- [x] `config.js` aponta para o Supabase paralelo, com chave publicável exclusiva.
- [x] CSP atualizada para permitir conexão ao Supabase paralelo, não ao projeto original.
- [x] README e arquitetura corrigidos para registrar preservação visual/funcional como requisito obrigatório.

## Em andamento
- [x] 2026-11-26 — Publicado Preview com a interface original restaurada: https://shiqi-parallel-git-shiqi-parallel-dev-steamconnectalex-9536.vercel.app (deployment `dpl_p46ZqU8f24q3XNQUaooomjsTQKDp`, estado READY).
- [ ] Validar visualmente com a pessoa, comparando com o aplicativo original.
- [ ] Auditar o schema original e reconstruir o schema paralelo completo.
- [x] 2026-11-26 — Copiadas as 24 migrações SQL originais e a Edge Function `auth` para `shiqi-parallel/supabase/` como base de auditoria.
- [ ] A migração 0002 assume uma base inicial não versionada no diretório: `servers`, `server_members`, `channels`, `create_server` e `is_server_member`. Reconstruir antes de aplicar as migrações.
- [ ] As migrações 0011 (música) e 0021 (eventos) são resumos, não SQL completo; recuperar o SQL aplicado no projeto original ou reconstruir e testar com fidelidade.
- [ ] Copiar e implantar a Edge Function original `auth` no Supabase paralelo.
- [ ] Configurar e-mail com chave Resend exclusiva para testes.
- [ ] Copiar/ajustar os testes e executar regressão de todos os fluxos existentes.
- [ ] Definir a tecnologia de destino após a auditoria; não presumir Next.js/React/Rust.


- [x] 2026-11-26 — Inventário de dependências do schema documentado em `docs/SCHEMA_DEPENDENCY_INVENTORY.md`: tabelas/RPCs observadas no frontend, divergências do banco paralelo e lacunas de SQL base, música e eventos.
- [x] 2026-11-26 — Contratos iniciais de autenticação documentados em `docs/AUTH_CONTRACT_INVENTORY.md`, incluindo payloads comprovados pelo frontend e rotas anunciadas sem handler versionado.
- [ ] Completar a matriz de campos/operações para todos os recursos e recuperar SQL ausente por fonte autorizada; não aplicar migrations enquanto isso.
- [ ] Completar testes JWT assinados e negativos; validar algoritmo/chaves do projeto de destino antes de integrar middleware.

## Correção de rumo registrada
- [x] 2026-11-26 — O primeiro protótipo genérico não correspondia ao aplicativo original. Foi substituído como base pela cópia fiel dos arquivos de `site/`. Não considerar o protótipo antigo como produto nem como referência de design.
- [ ] O schema experimental de cinco tabelas está vazio, mas é insuficiente e incompatível com o app original; substituir pelo modelo completo antes de testar login/chat.
- [ ] A conexão ao banco original `vjkqyqdabypdylhoupha` não está disponível na integração Supabase atual (sem permissão); será necessário acesso autorizado ou SQLs faltantes para espelhar o backend com segurança.
- [ ] Nenhuma mudança na `main`, no Vercel original ou no domínio principal.

## Adoção gradual de Rust — 2026-11-26
- [x] Criado `shiqi-parallel/services/core` com Axum/Tokio, health/readiness, tracing e shutdown gracioso.
- [x] Adicionado validador interno de anexos JPEG/PNG/WebP com limite de 3 MiB e testes unitários; ainda não exposto por HTTP nem ligado ao Storage.
- [x] Criado workflow GitHub Actions para `cargo fmt`, `cargo test` e `cargo clippy`.
- [x] Registrada auditoria técnica em `shiqi-parallel/docs/RUST_MIGRATION_AUDIT.md`.
- [ ] Executar CI e corrigir qualquer falha de compilação/testes. [x] CI validada em 2026-11-26 no commit `15ec623`: `cargo fmt --check`, `cargo test --all-targets` e `cargo clippy --all-targets -- -D warnings` concluídos com sucesso.
- [x] 2026-11-26 — Implementado módulo isolado de validação JWT Supabase via JWKS assimétrico (ES256/RS256), com `kid`, assinatura, issuer, audience, expiração, `nbf`, UUID de usuário, `role=authenticated`, cache e cooldown para `kid` desconhecido. Ainda não conectado a rotas de negócio.
- [ ] Confirmar o algoritmo de assinatura ativo no projeto Supabase original; HS256 legado é rejeitado deliberadamente até existir configuração segura e autorizada.
- [ ] Integrar middleware JWT às rotas Rust após recuperar schema e validar paridade.
- [ ] Recuperar o schema original completo; sem isso não ligar Rust ao banco.
- [ ] Implementar upload/processamento de anexos autenticado e testar regressão.
- [ ] Definir fila durável para jobs assíncronos após a paridade do banco.
- [x] 2026-11-26 — Preparada migração `0025_voz_10_participantes.sql` para elevar o limite de 6 para 10, com advisory locks para serializar entradas/saídas simultâneas, evitar corridas entre `join`/`leave` e manter uma sala por usuário. Atualizados apenas texto/capacidade da UI original na cópia paralela.
- [ ] Aplicar a migração somente no Supabase paralelo depois de reconstruir e validar o schema base; não foi aplicada no projeto original nem em produção.
- [ ] Testar chamadas com 10 usuários reais. O WebRTC atual é P2P em malha completa (até 9 conexões por participante); avaliar CPU, upload, vídeo/tela e latência antes de liberar para produção.
- [ ] Medir presença/Realtime e chamadas WebRTC reais antes de decidir por gateway/SFU.
- [ ] Frontend, Electron, design e fluxos existentes permanecem sem alteração nesta etapa.
