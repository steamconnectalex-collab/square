# shiqi-core

Serviço Rust independente em fase inicial, isolado do frontend existente.

## Estado atual

- HTTP server com Tokio + Axum.
- `GET /healthz`: verifica se o processo responde.
- `GET /readyz`: readiness provisória do processo (ainda sem dependências externas).
- `TraceLayer` para rastreamento de requisições HTTP.
- Logs via `tracing`.
- Encerramento gracioso.
- Validador de anexos JPEG/PNG/WebP alinhado ao limite atual de 3 MiB do Storage, conferindo assinatura binária e Content-Type.
- Verificador JWT Supabase por JWKS assimétrico (ES256/RS256), com validação de `kid`, assinatura, issuer, audience, expiração, `nbf` e `role=authenticated`, cache de chaves e atualização quando surge um `kid` novo.
- Testes unitários do validador.
- Build multi-stage em Docker.
- GitHub Actions para format, testes e Clippy.

## Executar localmente

```sh
cargo run
cargo test
```

O serviço escuta em `0.0.0.0:8080` por padrão. Defina `PORT` para alterar a porta e `RUST_LOG` para ajustar os logs.

## Limites de integração

O validador de imagem ainda é uma função interna, não uma rota HTTP. O verificador JWT foi implementado como módulo isolado, mas ainda não está conectado a rotas de negócio. Ele aceita apenas chaves assimétricas ES256/RS256 publicadas no JWKS do projeto; não aceita HS256 legado nem usa segredo compartilhado. Como o projeto Supabase original ainda não está acessível pela integração, precisamos confirmar o algoritmo de assinatura ativo antes de ligar esse verificador ao tráfego real. O serviço ainda não conecta ao Supabase/PostgreSQL, não grava anexos e não recebe tráfego do aplicativo. Isso é intencional: primeiro precisamos implementar autenticação e autorização equivalentes às policies RLS/Storage e testar compatibilidade. Nenhum endpoint, tela ou arquivo visual do frontend foi alterado.
