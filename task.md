# task.md — Estado atual do projeto

> **Para a IA:** este arquivo é a fonte da verdade sobre o projeto. Leia tudo antes de começar e atualize **na hora** em que algo acontecer (regras completas em `agents.md`). Não duplique tarefas: procure aqui antes de adicionar.
>
> Última atualização: 2026-11-17 (fotos de teste nos perfis)

---

## O que estamos construindo

**Square.** — uma plataforma de chat e comunidade em português (estilo Discord), com design próprio: interface clara e translúcida, com servidores, canais de texto e de voz, lista de membros e chat.

Quem constrói: uma pessoa iniciante, que fala português do Brasil. Explique tudo de forma simples.

**Como o projeto está montado**

| Parte | Onde está | Onde roda |
|---|---|---|
| Site (HTML/CSS/JS puros, sem build) | `site/` | Vercel, projeto `square-chat` — https://square-chat-silk.vercel.app |
| Publicação do site na Vercel | `deploy/fetch.sh` | Na publicação, a Vercel roda `sh fetch.sh <commit>`: baixa `site/` do GitHub naquele commit para a pasta `out/` (ver "Como publicar" abaixo) |
| Backend de acesso à conta | `supabase/functions/auth/` (`index.ts`, `mail.ts`) | Supabase Edge Function `auth` |
| Banco de dados | `supabase/migrations/0001_acesso_a_conta.sql` | Supabase, projeto `square` (ref `vjkqyqdabypdylhoupha`, São Paulo) |
| E-mails (códigos e recuperação de senha) | `supabase/functions/auth/mail.ts` | Resend (chave `RESEND_API_KEY` guardada nos segredos do Supabase) |
| Código-fonte e versões | https://github.com/steamconnectalex-collab/square (branch `main`) | GitHub |
| Design original (protótipos) | `design/` (Home, App, Auth) | Canvas do Claude; só protótipo, não chama o backend |
| Teste do site | `tests/smoke.js` | Playwright, com o Supabase simulado |
| Gerador da home | `tools/build-home.js` (lê `design/Main.dc.html`, gera `site/home.js`) | Node; rode de novo se o design da home mudar |

Função do backend: `https://vjkqyqdabypdylhoupha.supabase.co/functions/v1/auth` — rotas `/signup`, `/verify`, `/resend`, `/login`, `/forgot`, `/reset`, `/qr/create`, `/qr/info`, `/qr/approve`, `/qr/poll` e `GET /health`.

Fluxo de acesso: Home → "Entrar" → login (com painel de QR Code) → "Registre-se" → formulário → "Criar conta" envia um código de 6 caracteres (letras e números) por e-mail → digitar o código libera o acesso. "Esqueceu sua senha?" pede só o e-mail, que recebe o código e um botão de redefinir; o botão leva a "nova senha + confirmar" e o acesso volta.

---

## Concluído

- [x] 2026-11-15 — Design da home, da tela principal e do fluxo de acesso (canvas em `design/`).
- [x] 2026-11-15 — Projeto Supabase criado em São Paulo; banco com perfis, códigos de e-mail, sessões de QR e limite de tentativas (RLS ligado em tudo).
- [x] 2026-11-16 — Backend `auth`: cadastro com código, login (e-mail ou usuário), recuperação de senha, login por QR Code. Códigos com validade de 15 min, 5 tentativas, reenvio a cada 30 s.
- [x] 2026-11-16 — Site real: login, cadastro, verificação do código, recuperação de senha, nova senha, QR Code, tela principal (conversas de demonstração).
- [x] 2026-11-16 — E-mails reais via Resend (código de cadastro; código + botão de redefinir senha). Chave configurada.
- [x] 2026-11-16 — Site publicado na Vercel. **Login testado pela pessoa e funcionando 100%.**
- [x] 2026-11-16 — Criados `agents.md` e `task.md` (este arquivo).
- [x] 2026-11-16 — Home (landing) levada para o site real (`site/home.js`, gerada do design): abre na raiz, "Entrar" e "Abrir no navegador" levam ao login, links ainda sem destino mostram "Em breve". Testes de fumaça passando (27 verificações, desktop e celular).
- [x] 2026-11-16 — Repositório GitHub criado pela pessoa (`steamconnectalex-collab/square`, público) e conectado ao Claude.
- [x] 2026-11-16 — **Etapa 3:** projeto completo enviado ao GitHub (branch `main`, 22 arquivos, nenhum segredo dentro). A pasta de trabalho `/home/claude/square` agora também é um repositório git ligado ao GitHub.

- [x] 2026-11-17 — Regra nova no `agents.md` (item 8): enviar ao GitHub a cada tarefa concluída, para não perder trabalho se o limite da conta acabar.
- [x] 2026-11-17 — Painel novo publicado na Vercel (deployment `dpl_263Yo2vj7L6gGfL1BAK36CRQkV77`, commit `21be78c`); `app.js` no ar confere com o do GitHub (sha1 `c149e389…`).
- [x] 2026-11-17 — **Tela principal nova** (layout da foto + animações dos vídeos, no design claro do Square): depois do login/cadastro abre o **painel inicial** (amigos online, conversa, festas fixadas, mais jogados, player de música, notícias/jogos grátis, barra do usuário que expande nos três pontinhos). Barra de cima com ícone de conversa (volta ao painel), os servidores (abrem o servidor de antes, com canais e chat) e busca animada. Dados ainda de demonstração. Testes de fumaça: 40 verificações OK. Código: `appView`/`hubHTML` em `site/app.js`, estilos "painel inicial" em `site/style.css`.
- [x] 2026-11-17 — **Fotos de teste nos perfis** (pedido da pessoa, só para ter ideia do visual): a foto que a pessoa mandou do Playboi Carti é o avatar da conta (barra do usuário e lista de voz); as outras 8 imagens são avatares dos amigos (Lia, Salma, Marina, Theo, Bruno, Camila, Rodrigo, Tati); a faixa "Magnolia — Playboi Carti" é a primeira do player, com a outra foto dele como capa. Imagens recortadas em `site/img/` (10 arquivos de ~10 KB); `deploy/fetch.sh` agora baixa essa pasta. **PROVISÓRIO:** antes do lançamento trocar por ícone de boneco (basta `USE_TEST_PHOTOS = false` em `site/app.js` e apagar `site/img/`). Publicado na Vercel (deployment `dpl_3VtJwv3iXsMGkt7X2N7ECeAAJNJY`, commit `c046ed5`; `img/eu.jpg` no ar confere: 10108 bytes). Testes de fumaça OK. Atenção: o repositório e o site são públicos, então as fotos ficam visíveis a quem tiver o link.
- [x] 2026-11-16 — **Etapa 2:** site completo (home + login + app) publicado na Vercel em https://square-chat-silk.vercel.app (deployment `dpl_2wsLZ3h1f7CT3kGt3w8N5rdQS6KS`, commit `495cab0` do GitHub). Conferido: `index.html`, `app.js` e `home.js` no ar são idênticos, byte a byte, aos do repositório.

## Em andamento agora

- Nada em andamento. Aguardando a pessoa testar o site no ar e dizer o que ajustar.

## Como publicar o site (enquanto a Vercel não estiver ligada ao GitHub)

1. Mude os arquivos em `site/`, rode `node tests/smoke.js`, faça commit e `git push` para a `main`.
2. Chame `create_deployment` da Vercel (projeto `square-chat`, `target: production`) com os arquivos `fetch.sh` (conteúdo de `deploy/fetch.sh`) e `vercel.json` (o de `site/vercel.json`), e `projectSettings`: `buildCommand = "sh fetch.sh <commit novo>"`, `outputDirectory = "out"`, `framework`, `installCommand`, `rootDirectory` = null.
3. Confira os arquivos no ar (por exemplo, o `sha1` de `home.js` e `app.js`) e registre aqui.
- Por quê assim: enviar direto do GitHub (`gitSource`) foi recusado pelo limite de consultas do GitHub (erro 429); colar arquivos grandes à mão é frágil. Se o envio direto voltar a funcionar, prefira-o.

## O que ainda falta fazer

- [ ] Ligar a Vercel ao repositório do GitHub, para o site publicar sozinho a cada envio (hoje a publicação é feita por `deploy/fetch.sh`, passo a passo acima). Precisa de um passo da pessoa no painel da Vercel: projeto `square-chat` → Settings → Git → Connect Git Repository → GitHub → `steamconnectalex-collab/square`. Depois: Root Directory = `site`, e apagar o Build Command e o Output Directory (hoje `sh fetch.sh …` e `out`).
- [ ] Chat com dados reais (servidores, canais, mensagens guardadas no banco, tempo real). Hoje a tela principal usa dados de demonstração.
- [ ] Botões "em breve" da tela principal: criar servidor, criar canais, anexos, presentes, GIFs, configurações.
- [ ] Verificar um domínio no Resend e trocar o remetente (hoje `onboarding@resend.dev`, que só entrega para o e-mail da conta Resend e pode cair no spam).
- [ ] Ligar a proteção contra senhas vazadas no painel do Supabase (Authentication).
- [ ] Decidir sobre login por telefone (hoje não existe) e idade mínima (hoje não há regra).

## Erros a corrigir

- Nenhum erro conhecido no momento.

## Próximo passo

A pessoa testa o painel novo no ar e aponta ajustes (ex.: o que fazer com os botões "em breve" do painel). Depois, começar o chat com dados reais (primeiro: servidores e canais no banco).

---

## Registro de sessões

### 2026-11-16
- **Feito:** backend e banco criados e testados; site real publicado; e-mails reais ligados; login confirmado pela pessoa; criados `agents.md` e `task.md`; projeto organizado em pasta única; home levada para o site real; repositório GitHub conectado.
- **Problemas:** a primeira publicação na Vercel saiu sem dois arquivos (`app.js` e `qr.js`); foi corrigida com uma nova publicação completa. Depois, o envio direto do GitHub para a Vercel foi recusado 3 vezes (limite de consultas do GitHub, erro 429); resolvido com `deploy/fetch.sh` (a Vercel baixa os arquivos do GitHub durante a publicação).
- **Feito (final do dia):** etapas 2 e 3 concluídas: site completo no ar na Vercel e projeto completo no GitHub (`main`).
- **Próximo passo:** a pessoa testa o site; ligar Vercel ↔ GitHub pelo painel da Vercel (passo da pessoa); depois, chat com dados reais.
