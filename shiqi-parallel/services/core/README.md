# shiqi-core

Serviço Rust independente em fase inicial, isolado do frontend existente.

## Estado atual

- HTTP server com Tokio + Axum.
- `GET /healthz`: verifica se o processo responde.
- `GET /readyz`: retorna 200 somente quando o verificador JWT e o proxy do Supabase Storage estão configurados; sem `SUPABASE_URL` ou `SUPABASE_PUBLISHABLE_KEY`, retorna 503.
- `GET /v1/me`: rota protegida; valida o Bearer JWT do Supabase via JWKS e retorna somente o ID e o papel do usuário.
- `POST /v1/attachments/validate`: exige JWT e valida assinatura JPEG/PNG/WebP/GIF, MIME declarado e limite de 3 MiB, sem gravar o arquivo.
- `POST /v1/attachments/upload`: exige JWT, valida imagem e caminho de propriedade do usuário, e encaminha o upload ao bucket privado `attachments` usando o mesmo Bearer token. O Supabase Storage continua aplicando as policies RLS.
- `TraceLayer` para rastreamento de requisições HTTP.
- Logs via `tracing`.
- Encerramento gracioso.
- Validador de anexos JPEG/PNG/WebP/GIF alinhado ao limite atual de 3 MiB do Storage, conferindo assinatura binária e Content-Type.
- Verificador JWT Supabase por JWKS assimétrico (ES256/RS256), com validação de `kid`, assinatura, issuer, audience, expiração, `nbf` e `role=authenticated`, cache de chaves e atualização quando surge um `kid` novo. O JWKS público do Supabase paralelo foi consultado pelo GitHub Actions em 27/11/2026 e confirmou chave EC P-256 / ES256.
- Testes unitários do validador.
- Build multi-stage em Docker.
- GitHub Actions para format, testes e Clippy.

## Configuração

Defina `SUPABASE_URL` com a URL HTTPS do projeto Supabase, `SUPABASE_PUBLISHABLE_KEY` com a chave publicável do mesmo projeto e `SHIQI_ALLOWED_ORIGIN` com a origem HTTPS exata do frontend (sem barra final). O CORS aceita somente essa origem, os métodos POST/OPTIONS e os headers Authorization, Content-Type e X-Attachment-Path. `SUPABASE_JWT_AUDIENCE` é opcional e assume `authenticated`. Não configure nem coloque `service_role` no serviço: o proxy encaminha o JWT original do usuário para o Storage, que aplica as policies RLS. `/readyz` só retorna 200 quando JWT e Storage estão configurados.

## Executar localmente

```sh
cargo run
cargo test
```

O serviço escuta em `0.0.0.0:8080` por padrão. Defina `PORT` para alterar a porta e `RUST_LOG` para ajustar os logs.

## Limites de integração

- O verificador JWT está conectado às rotas protegidas do serviço Rust, mas o serviço ainda não foi implantado nem recebe tráfego do aplicativo.
- O algoritmo real do Supabase paralelo foi confirmado como ES256 (EC P-256) pelo job `supabase-jwks` do GitHub Actions. O teste unitário `parses_supabase_es256_jwks_and_verifies_signed_claims` valida o formato JWK e a assinatura com uma chave fixture exclusiva de testes; não usa nem representa a chave real do projeto.
- O upload Rust encaminha a gravação ao bucket privado `attachments` com o JWT do usuário e a chave publicável. A policy `attachments_insert_own` continua validando a pasta do usuário; o serviço não usa privilégios administrativos. A leitura permanece via signed URLs de 60 segundos, sob as policies RLS existentes.
- O serviço ainda não conecta ao PostgreSQL nem executa operações privilegiadas. A próxima fase deve preservar a identidade JWT do usuário e deixar o Supabase Storage/RLS como autoridade de autorização; não adicionar service_role ao serviço.
- A Edge Function Auth paralela ainda precisa ser publicada e validada separadamente antes de substituir qualquer fluxo de cadastro/login. Nenhuma UI foi alterada nesta etapa.
