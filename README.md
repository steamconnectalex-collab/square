# Shiqi.

Plataforma de chat e comunidade em português. Site estático na Vercel, backend no Supabase, e-mails pelo Resend.

- **Site no ar:** https://square-chat-silk.vercel.app
- **Regras para a IA:** [`agents.md`](agents.md)
- **Estado do projeto (feito / fazendo / falta):** [`task.md`](task.md)

## Pastas

| Pasta | O que tem |
|---|---|
| `site/` | O site (HTML, CSS e JavaScript puros, sem build). `index.html` é a entrada; `vercel.json` define cabeçalhos de segurança. |
| `supabase/functions/auth/` | Backend de acesso à conta (cadastro, código, login, QR Code, recuperação de senha) e envio de e-mails. |
| `supabase/migrations/` | Estrutura do banco de dados. |
| `design/` | Protótipos originais do design (home, app, acesso). |
| `tests/` | Teste de fumaça do site (`node tests/smoke.js`, usa Playwright). |

## Segredos

Nada secreto fica neste repositório. A chave do Resend (`RESEND_API_KEY`) é um segredo da função no Supabase. Opcionais: `RESEND_FROM` (remetente) e `SITE_URL` (endereço do site).
