# Shiqi — inventário inicial do contrato de autenticação

Data: 2026-11-26  
Fonte de verdade consultada: `main/site/app.js`, `main/site/settings*.js`, `main/site/qr.js` e `shiqi-parallel/supabase/functions/auth/index.ts`.  
Branch de documentação: `shiqi-parallel-dev`.

## Resultado principal

**Atualização de 2026-11-27:** foi identificado que a implementação completa da Edge Function estava em `supabase/functions/auth/index.ts` na raiz do repositório, enquanto a cópia paralela `shiqi-parallel/supabase/functions/auth/index.ts` continha somente o início do arquivo. A implementação completa foi restaurada na cópia paralela no commit `0b61202`.

A versão paralela agora contém `Deno.serve`, roteamento e handlers para cadastro, verificação de e-mail, reenvio, login, TOTP, recuperação de senha, alteração de e-mail, desativação/exclusão de conta e operações de MFA. Foram mantidas as configurações isoladas: `SUPABASE_ANON_KEY` é obrigatória por variável de ambiente, o endereço padrão é `https://shiqi-parallel.vercel.app` e as origens de produção do projeto antigo foram removidas da allow-list. Origens adicionais de preview devem ser configuradas por `EXTRA_ORIGINS`.

A cópia paralela não inclui rotas de QR, conforme o escopo aprovado. O prefixo HMAC histórico `square-v1:` foi preservado para consistência do formato interno; não foi alterado nenhum segredo.

A restauração foi verificada estaticamente: 13 rotas POST e GET `/health`; as três tabelas acessadas diretamente (`profiles`, `email_codes`, `mfa_recovery`) existem no SQL canônico, assim como as seis RPCs chamadas. **Isso não equivale a teste de runtime**: ainda faltam validar os contratos de cada rota, dependências, JWT e variáveis de ambiente antes de conectar a interface ou publicar a função.

## Transporte comum observado

O frontend usa um helper `api(path, body, token?)` e envia requisições POST para a Edge Function configurada em `C.FN`. As chamadas observadas abaixo usam JSON. O formato completo de erros e cabeçalhos deve ser extraído do helper e validado em testes antes da implementação.

## Rotas e payloads comprovados no frontend

| Rota | Payload observado | Uso |
|---|---|---|
| `/signup` | `email`, `username`, `display_name`, `password`, `birth_date`, `marketing_opt_in`, `accept_terms` | Cadastro |
| `/verify` | `email`, `code` | Confirmar código de e-mail |
| `/resend` | `email` | Reenviar código |
| `/login` | `identifier`, `password`; opcional `code` ou `recovery_code` quando MFA está em fluxo | Login por identificador/senha e MFA |
| `/login/totp` | `identifier`, `code` | Segundo fator TOTP |
| `/forgot` | `email` | Solicitar recuperação de senha |
| `/reset` | `email`, `code`, `password` | Redefinir senha |
| `/qr/create` | objeto vazio | Criar sessão QR |
| `/qr/poll` | `id`, `poll_secret` | Consultar estado QR |
| `/qr/info` | `id`, `approve_secret` | Exibir dispositivo que pediu autorização |
| `/qr/approve` | `id`, `approve_secret`, `decision` | Aprovar ou negar login QR |

Observações de comportamento comprovadas:
- O cadastro envia também data de nascimento, consentimento de marketing e aceite dos termos.
- O código de verificação tem seis caracteres na UI.
- O frontend aplica cooldown de 30 segundos ao reenvio.
- O cliente trata os erros `email_taken`, `invalid_email`, `username_taken`, `invalid_username`, `wrong_code`, `expired`, `locked` e `unverified` em fluxos de cadastro/verificação/login.
- O login pode retornar `mfa_required`; após autenticação, o cliente chama `onSignedIn`.
- O fluxo QR cria sessão com `id`, `poll`, `url` e `ttl`; o polling ocorre a cada 2 segundos. A aprovação usa token de sessão obtido pelo cliente.
- O fluxo de reset pode retornar `mfa_required` e o cliente informa que a senha foi alterada e pede novo login com MFA.

Os campos exatos de resposta, códigos HTTP e todos os ramos de erro ainda precisam ser documentados em testes de contrato.

## Rotas anunciadas no cabeçalho da Edge Function, sem chamada estática comprovada no frontend examinado

- `/email/change/request`
- `/email/change/confirm`
- `/account/deactivate`
- `/account/delete`
- `/mfa/recovery`
- `/mfa/disable)

Essas rotas não devem ser descartadas: podem ser usadas por código indireto/dinâmico ou por telas que ainda precisam ser rastreadas. A lista acima significa apenas que não foi encontrada chamada estática nos arquivos examinados nesta etapa.

## Persistência e controles referenciados pelo SQL de acesso

A migration `0001_acesso_a_conta.sql` define:
- `profiles`, com username, display name, data de nascimento, marketing opt-in e timestamp;
- `email_codes`, armazenando hash HMAC do código, finalidade, tentativas, expiração e consumo;
- `qr_sessions`, com hashes de segredos de aprovação/polling, status, aprovador, expiração e user-agent solicitante;
- `rate_hits`, para rate limiting persistente;
- funções de acesso administrativo e verificação: `get_auth_user_by_email`, `get_login_email_by_username`, `rate_check`, `revoke_user_sessions`, `verify_email_code`.

A migration `0019_conta_privacidade_dm.sql` adiciona recuperação MFA e amplia os propósitos de códigos para alteração de e-mail. A migration `0024_seguranca_grants.sql` endurece privilégios de tabelas sensíveis.

## Configuração e dependências de e-mail

O módulo `mail.ts` usa secrets de servidor:
- `RESEND_API_KEY` (obrigatório para envio);
- `RESEND_FROM` (opcional);
- `BRAND_NAME` (opcional).

A função de autenticação também referencia `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` e `SITE_URL`. A chave service-role deve permanecer exclusivamente no ambiente servidor; não incluir em código frontend, commits ou logs.

O helper HMAC versionado usa o prefixo `square-v1:` concatenado à service key. Isso é um detalhe sensível do contrato de hash e deve ser preservado somente se a estratégia de compatibilidade e rotação de segredo for validada.

Nenhum segredo foi lido, alterado ou publicado durante esta auditoria. Nenhum e-mail foi enviado.

## Plano de reconstrução segura

1. Mapear o helper `api()`, autenticação de sessão e todas as chamadas indiretas/dinâmicas, incluindo configurações de conta e MFA.
2. Definir formalmente para cada rota: autenticação exigida, payload, resposta, códigos HTTP, erros, limites, expiração e efeitos colaterais.
3. Criar testes de contrato a partir dos fluxos originais antes de implementar handlers.
4. Usar Supabase Auth para gestão de credenciais/sessões e tabelas privadas para OTP/QR/rate limiting, com transações e controles anti-replay.
5. Exigir validação de token, autorização por usuário, rate limit distribuído, proteção contra enumeração de contas e auditoria sem segredos.
6. Integrar o envio via Resend apenas após configurar secret no projeto paralelo e validar domínio/remetente; nenhum e-mail de teste deve ser enviado sem autorização específica.
7. Comparar todos os fluxos de cadastro, login, MFA, QR, recuperação e alteração de e-mail com o comportamento esperado antes de conectar a UI.

## Limites desta etapa

- Nenhuma Edge Function foi publicada.
- Nenhum secret foi alterado.
- Nenhuma tabela/migration foi aplicada.
- Nenhum fluxo de login/cadastro foi alterado no frontend.
- A etapa de teste com 10 participantes e a publicação Preview Vercel permanecem fora do escopo, conforme instrução do usuário.
