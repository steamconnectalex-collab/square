# shiqi-core

Serviço Rust independente em fase inicial, isolado do frontend existente.

## Estado atual

- HTTP server com Tokio + Axum.
- `GET /healthz`: verifica se o processo responde.
- `GET /readyz`: retorna 200 somente quando a configuração JWT do Supabase está válida; sem `SUPABASE_URL`, retorna 503.
- `GET /v1/me`: rota protegida; valida o Bearer JWT do Supabase via JWKS e retorna somente o ID e o papel do usuário.
- `POST /v1/attachments/validate`: exige JWT e valida assinatura JPEG/PNG/WebP/GIF, MIME declarado e limite de 3 MiB. Não grava arquivos nem substitui as policies/signed URLs do Storage.
- `TraceLayer` para rastreamento de requisições HTTP.
- Logs via `tracing`.
- Encerramento gracioso.
- Validador de anexos JPEG/PNG/WebP/GIF alinhado ao limite atual de 3 MiB do Storage, conferindo assinatura binária e Content-Type.
- Verificador JWT Supabase por JWKS assimétrico (ES256/RS256), com validação de `kid`, assinatura, issuer, audience, expiração, `nbf` e `role=authenticated`, cache de chaves e atualização quando surge um `kid` novo.
- Testes unitários do validador.
- Build multi-stage em Docker.
- GitHub Actions para format, testes e Clippy.

## Configuração

Defina `SUPABASE_URL` com a URL HTTPS do projeto Supabase. `SUPABASE_JWT_AUDIENCE` é opcional e assume `authenticated`. Não coloque service-role key nem outros segredos no serviço: a validação usa somente o endpoint público JWKS.

## Executar localmente

```sh
cargo run
cargo test
```

O serviço escuta em `0.0.0.0:8080` por padrão. Defina `PORT` para alterar a porta e `RUST_LOG` para ajustar os logs.

## Limites de integração

O validador de imagem ainda é uma função interna, não uma rota HTTP. O verificador JWT foi implementado como módulo isolado, mas ainda não está conectado a rotas de negócio. Ele aceita apenas chaves assimétricas ES256/RS256 publicadas no JWKS do projeto; não aceita HS256 legado nem usa segredo compartilhado. Como o projeto Supabase original ainda não está acessível pela integração, precisamos confirmar o algoritmo de assinatura ativo antes de ligar esse verificador ao tráfego real. O serviço ainda não conecta ao Supabase/PostgreSQL, não grava anexos e não recebe tráfego do aplicativo. Isso é intencional: primeiro precisamos implementar autenticação e autorização equivalentes às policies RLS/Storage e testar compatibilidade. Nenhum endpoint, tela ou arquivo visual do frontend foi alterado.
