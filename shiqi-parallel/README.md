# SHIQI — migração paralela fiel ao original

## Regra inegociável
Esta pasta existe para migrar a tecnologia da SHIQI sem alterar sua experiência. O aplicativo original em `/site` é a fonte de verdade. Não redesenhar, simplificar, remover ou renomear telas, componentes, estilos, fluxos ou funcionalidades sem autorização expressa.

## Isolamento
- Trabalhar somente na branch `shiqi-parallel-dev` e dentro de `shiqi-parallel/`.
- Nunca alterar `main`, a publicação original, o banco original ou credenciais originais.
- Serviços paralelos: projeto Vercel `shiqi-parallel`, projeto Supabase `ujdosskjycrdkcgsswfa`.
- Nunca copiar dados de usuários nem chaves secretas.
- Não promover para produção nem associar o domínio principal sem autorização.

## Fonte visual e funcional
- O código original está em `site/` na raiz do repositório.
- A cópia fiel para o Preview está em `apps/web/`: HTML, CSS, JS, páginas legais, favicon e configuração Vercel.
- O conteúdo dos arquivos de interface foi copiado sem redesenho; somente `config.js` e a CSP foram ajustados para apontar ao Supabase paralelo.
- A versão paralela deve manter os mesmos comportamentos, textos, navegação, componentes e aparência.

## Estado da migração
- A interface original foi restaurada em `apps/web/`.
- O frontend original usa HTML/CSS/JavaScript puros e um backend Supabase (Auth, PostgREST, Edge Function `auth`, Storage e Realtime).
- O banco paralelo ainda contém um schema experimental simplificado de comunidades; ele NÃO representa o modelo completo da SHIQI e precisa ser substituído pelo schema fiel antes de testar o app conectado.
- As 24 migrações versionadas originais não são um histórico totalmente autocontido: a migração 0002 documenta uma base anterior `servers`, `server_members`, `channels` e funções `create_server`/`is_server_member` que não está no diretório de migrações. Reconstruir essa base a partir do código e validar antes de aplicar.
- A Edge Function original `auth` e o Resend paralelo ainda precisam ser implantados/configurados com credenciais exclusivas.

## Arquitetura
A tecnologia de destino deve ser decidida após mapear dependências e requisitos. Não migrar para React/Next.js, Rust ou outro framework por suposição. Se houver mudança de stack, comparar a interface e executar testes de regressão para provar equivalência.

## Executar
A raiz web da Vercel é `shiqi-parallel/apps/web`. A aplicação é estática e usa arquivos locais; abra `apps/web/index.html` para inspeção visual local.
