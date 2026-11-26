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

## Correção de rumo registrada
- [x] 2026-11-26 — O primeiro protótipo genérico não correspondia ao aplicativo original. Foi substituído como base pela cópia fiel dos arquivos de `site/`. Não considerar o protótipo antigo como produto nem como referência de design.
- [ ] O schema experimental de cinco tabelas está vazio, mas é insuficiente e incompatível com o app original; substituir pelo modelo completo antes de testar login/chat.
- [ ] A conexão ao banco original `vjkqyqdabypdylhoupha` não está disponível na integração Supabase atual (sem permissão); será necessário acesso autorizado ou SQLs faltantes para espelhar o backend com segurança.
- [ ] Nenhuma mudança na `main`, no Vercel original ou no domínio principal.
