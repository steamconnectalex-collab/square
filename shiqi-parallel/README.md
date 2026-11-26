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

## Estado
A interface atual é apenas a fundação visual. Login, chat, comunidades, banco e envio de e-mails ainda não estão conectados.
