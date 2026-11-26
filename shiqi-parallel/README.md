# SHIQI — ambiente paralelo

Esta pasta contém a nova implementação da SHIQI, isolada do projeto original.

## Princípios
- Todo o trabalho desta versão fica dentro de `shiqi-parallel/`.
- A branch de trabalho é `shiqi-parallel-dev`; não publicar nem mesclar na `main` sem autorização.
- Não reutilizar banco, chaves, tokens, dados de usuários ou serviços de produção.
- Começar com HTML, CSS e JavaScript sem build; reavaliar a arquitetura com evidências antes de adicionar frameworks ou serviços.
- Interface e mensagens em português do Brasil.

## Estrutura
- `apps/web/`: protótipo web estático, pronto para Preview na Vercel.
- `docs/ARCHITECTURE.md`: decisões e limites da arquitetura.
- `task.md`: estado e próximos passos.

## Rodar localmente
Abra `apps/web/index.html` no navegador. Não há dependências ou etapa de build nesta primeira etapa.

## Estado atual
- A autenticação por e-mail/senha usa o Supabase independente.
- O cadastro cria automaticamente um perfil.
- Usuários autenticados podem criar comunidades; cada comunidade recebe um canal `#geral`.
- O banco tem RLS ativado para perfis, comunidades, membros, canais e mensagens.
- Canais de texto e mensagens em tempo real já estão implementados para comunidades.
- Mensagens diretas, amizades e chamadas de voz ainda não foram implementadas.
- E-mail transacional próprio ainda não foi configurado; o fluxo depende das configurações de confirmação de e-mail do Supabase.
