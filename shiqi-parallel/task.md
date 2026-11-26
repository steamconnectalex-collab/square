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
- [x] 2026-11-26 — Inventário de dependências do schema documentado em `docs/SCHEMA_DEPENDENCY_INVENTORY.md`.
- [x] 2026-11-26 — Contratos iniciais de autenticação documentados em `docs/AUTH_CONTRACT_INVENTORY.md`.
- [x] 2026-11-26 — Música excluída do escopo: não recuperar/aplicar migration 0011; referências serão retiradas apenas da cópia paralela, sem tocar no original.
- [ ] Completar matriz de campos, filtros e operações de todos os recursos restantes.
- [ ] Recuperar SQL ausente da base de servidores/canais e dos eventos por fonte Git autorizada ou material fornecido pelo proprietário.
- [ ] Reconciliar o schema paralelo de cinco tabelas com o modelo alvo sem drops/renames destrutivos.
- [ ] Reconstruir e testar contratos de autenticação; o arquivo versionado atual é apenas stub.
- [ ] Completar testes JWT assinados/negativos e validar algoritmo/chaves do projeto destino antes de integrar middleware.
- [ ] Preparar migrations incrementais, RLS, grants, Storage e Realtime; não aplicar remotamente sem revisão.
- [ ] Regressão de todos os fluxos que permanecem no produto.
- [ ] Preview Vercel depois que a janela de limite terminar; não contornar limite.

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
3. Recuperar a migration base ausente de servidores e eventos; pedir ao usuário export/SQL se não houver fonte Git autorizada.
4. Corrigir e testar autenticação antes de conectar a UI.
5. Expandir testes de JWT e middleware Rust; validar algoritmo e chaves antes da integração.