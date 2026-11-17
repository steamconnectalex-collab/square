# task.md — Estado atual do projeto

> **Para a IA:** este arquivo é a fonte da verdade sobre o projeto. Leia tudo antes de começar e atualize **na hora** em que algo acontecer (regras completas em `agents.md`). Não duplique tarefas: procure aqui antes de adicionar.
>
> Última atualização: 2026-11-16 (noite)

---

## O que estamos construindo

**Square.** — uma plataforma de chat e comunidade em português (estilo Discord), com design próprio: interface clara e translúcida, com servidores, canais de texto e de voz, lista de membros e chat.

Quem constrói: uma pessoa iniciante, que fala português do Brasil. Explique tudo de forma simples.

**Como o projeto está montado**

| Parte | Onde está | Onde roda |
|---|---|---|
| Site (HTML/CSS/JS puros, sem build) | `site/` | Vercel, projeto `square-chat` — https://square-chat-silk.vercel.app |
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

## Em andamento agora

- [ ] Etapa 2 — Publicar na Vercel o site completo (home + login + app). A home já está pronta no código e testada. A Vercel hoje ainda tem a versão antiga (sem a home); a publicação da versão nova está em andamento (1ª tentativa, direto do GitHub, foi recusada pelo limite de consultas do GitHub — tentar de novo).

## O que ainda falta fazer

- [ ] Ligar a Vercel ao repositório do GitHub, para o site publicar sozinho a cada envio (hoje a publicação é feita à mão por upload).
- [ ] Chat com dados reais (servidores, canais, mensagens guardadas no banco, tempo real). Hoje a tela principal usa dados de demonstração.
- [ ] Botões "em breve" da tela principal: criar servidor, criar canais, anexos, presentes, GIFs, configurações.
- [ ] Verificar um domínio no Resend e trocar o remetente (hoje `onboarding@resend.dev`, que só entrega para o e-mail da conta Resend e pode cair no spam).
- [ ] Ligar a proteção contra senhas vazadas no painel do Supabase (Authentication).
- [ ] Decidir sobre login por telefone (hoje não existe) e idade mínima (hoje não há regra).

## Erros a corrigir

- Nenhum erro conhecido no momento.

## Próximo passo

Concluir a etapa 2 (publicar a home na Vercel e conferir o site no ar). Depois, começar o chat com dados reais (primeiro: servidores e canais no banco).

---

## Registro de sessões

### 2026-11-16
- **Feito:** backend e banco criados e testados; site real publicado; e-mails reais ligados; login confirmado pela pessoa; criados `agents.md` e `task.md`; projeto organizado em pasta única; home levada para o site real; repositório GitHub conectado.
- **Problemas:** a primeira publicação na Vercel saiu sem dois arquivos (`app.js` e `qr.js`); foi corrigida com uma nova publicação completa.
- **Próximo passo:** publicar a home na Vercel (etapa 2) e ligar Vercel ↔ GitHub. (Etapa 3, envio ao GitHub, já feita.)
