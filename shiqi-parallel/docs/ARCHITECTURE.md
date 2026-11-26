# Arquitetura — migração paralela SHIQI

## Requisito prioritário e inegociável
Migrar tecnologia sem alterar o produto. A interface e as funcionalidades existentes são contrato: aparência, layout, espaçamentos, tipografia, ícones, cores, navegação, textos, animações, fluxos e comportamentos devem permanecer equivalentes ao original. Nenhuma simplificação ou redesign sem autorização expressa.

## Fonte de verdade
- Frontend original: `/site` na raiz do repositório.
- Protótipos de design: `/design`.
- Backend original: `/supabase/functions/auth`.
- Modelo de dados e segurança: `/supabase/migrations` mais a base inicial descrita no rodapé da migração 0002.
- Desktop: `/desktop` (Electron).
- Testes de regressão: `/tests/smoke.js`.

## Isolamento
- Toda a implementação paralela fica em `shiqi-parallel/`, branch `shiqi-parallel-dev`.
- Vercel independente: projeto `shiqi-parallel`, Root Directory `shiqi-parallel/apps/web`.
- Supabase independente: `ujdosskjycrdkcgsswfa`, região `sa-east-1`.
- Não reutilizar banco, usuários, dados, chaves secretas ou serviços de produção.
- Não alterar o projeto Vercel original, domínio principal nem branch `main`.

## Auditoria técnica
O original usa HTML/CSS/JS sem build, Supabase Auth/PostgREST/Realtime/Storage e uma Edge Function Deno para cadastro com código, login, QR, recuperação e segurança de conta. O app também tem amizades, DMs, servidores, canais de texto/voz, membros, moderação, arquivos, reações, eventos, tópicos, configurações, loja, perfil e cliente Electron.

## Estado do trabalho
- `apps/web/` recebeu cópia fiel dos arquivos originais da pasta `site/`.
- `config.js` aponta para o Supabase paralelo e usa apenas chave publicável.
- `vercel.json` foi ajustado para permitir conexão somente ao Supabase paralelo.
- O schema experimental de cinco tabelas ainda existe no Supabase paralelo. Ele não é compatível com o frontend original; não declarar a migração funcional até substituir pelo modelo real.
- A migração 0002 assume que `servers`, `server_members`, `channels`, `create_server` e `is_server_member` já existiam; essa base precisa ser reconstituída e validada. Não executar as migrações às cegas.

## Plano obrigatório
1. Restaurar e comparar os arquivos originais (feito na cópia web inicial).
2. Inventariar todas as chamadas REST/RPC, buckets, Realtime, rotas da Edge Function e funcionalidades do Electron.
3. Reconstruir o banco paralelo com o modelo completo e as mesmas políticas/constraints.
4. Implantar a Edge Function e serviços de e-mail com segredos exclusivos do ambiente paralelo.
5. Executar testes de regressão funcionais e visuais, comparando telas e fluxos com o original.
6. Só então decidir/implementar a mudança de tecnologia alvo, sem alterar a experiência.
