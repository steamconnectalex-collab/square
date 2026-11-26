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
- [ ] Publicar Preview com os arquivos originais restaurados e validar visualmente.
- [ ] Auditar o schema original e reconstruir o schema paralelo completo.
- [ ] A migração 0002 assume uma base inicial não versionada no diretório: `servers`, `server_members`, `channels`, `create_server` e `is_server_member`. Reconstruir antes de aplicar as migrações.
- [ ] Copiar e implantar a Edge Function original `auth` no Supabase paralelo.
- [ ] Configurar e-mail com chave Resend exclusiva para testes.
- [ ] Copiar/ajustar os testes e executar regressão de todos os fluxos existentes.
- [ ] Definir a tecnologia de destino após a auditoria; não presumir Next.js/React/Rust.

## Correção de rumo registrada
- [x] 2026-11-26 — O primeiro protótipo genérico não correspondia ao aplicativo original. Foi substituído como base pela cópia fiel dos arquivos de `site/`. Não considerar o protótipo antigo como produto nem como referência de design.
- [ ] O schema experimental de cinco tabelas é insuficiente e incompatível com o app original; não usar como base funcional.
- [ ] Nenhuma mudança na `main`, no Vercel original ou no domínio principal.
