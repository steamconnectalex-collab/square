# shiqi-core

Serviço Rust independente em fase inicial, isolado do frontend existente.

## Estado atual

- HTTP server com Tokio + Axum.
- `GET /healthz`: verifica se o processo responde.
- `GET /readyz`: readiness provisória do processo (ainda sem dependências externas).
- Logs estruturados via `tracing`.
- Encerramento gracioso.
- Build multi-stage em Docker.

## Executar localmente

```sh
cargo run
```

O serviço escuta em `0.0.0.0:8080` por padrão. Defina `PORT` para alterar a porta e `RUST_LOG` para ajustar os logs.

## Limites de integração

Este scaffold ainda **não** conecta ao Supabase/PostgreSQL, não valida JWT, não executa operações de negócio e não recebe tráfego do aplicativo. Nenhum endpoint do frontend foi alterado. Antes de adicionar rotas de negócio, documentar o contrato existente, a autorização e as políticas RLS correspondentes e criar testes de compatibilidade.
