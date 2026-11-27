# Implantação isolada do shiqi-core

## Objetivo

Executar o serviço Rust como um container independente, sem substituir o frontend e sem alterar o projeto Supabase ou a aplicação de produção.

## Fonte e build

- Diretório do serviço e contexto Docker: `shiqi-parallel/services/core`
- Dockerfile: `shiqi-parallel/services/core/Dockerfile`
- Porta: usar a variável `PORT` fornecida pela plataforma; padrão local `8080`.
- Comando de inicialização: definido pelo `ENTRYPOINT` do Dockerfile.
- O workflow `.github/workflows/shiqi-core.yml` valida formatação, testes, Clippy, JWKS público e build da imagem.

## Variáveis de ambiente

Configurar somente no gerenciador de variáveis/segredos do host:

| Variável | Valor / regra |
|---|---|
| `SUPABASE_URL` | `https://ujdosskjycrdkcgsswfa.supabase.co` (projeto paralelo) |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável do mesmo projeto paralelo; não usar chave de produção |
| `SHIQI_ALLOWED_ORIGIN` | Origem HTTPS exata do frontend paralelo, sem barra final; confirmar o domínio de preview que será usado |
| `SUPABASE_JWT_AUDIENCE` | Opcional; padrão `authenticated` |
| `RUST_LOG` | Opcional; por exemplo `shiqi_core=info,tower_http=info` |

**Não configurar `service_role` nem qualquer segredo de produção.** O proxy de anexos encaminha o JWT original do usuário e a chave publicável; o Supabase Storage continua aplicando RLS.

## Health checks

- Liveness: `GET /healthz` — espera HTTP 200 quando o processo está ativo.
- Readiness: `GET /readyz` — espera HTTP 200 somente quando JWT e Storage estão configurados; caso contrário HTTP 503.
- Configurar a plataforma para escutar a porta indicada por `PORT` e usar `/healthz` como health check de processo. Usar `/readyz` como readiness check quando suportado.

## CORS

O serviço aceita uma única origem exata em `SHIQI_ALLOWED_ORIGIN`, métodos POST/OPTIONS e os headers Authorization, Content-Type e X-Attachment-Path. Não usar curingas. A origem final depende do domínio de preview que será mantido para a interface paralela.

## Ordem segura de ativação

1. Conectar um host que execute containers Docker e criar um serviço separado para o diretório acima.
2. Configurar as variáveis exclusivamente com os valores do Supabase paralelo e o domínio de preview confirmado.
3. Fazer deploy isolado e verificar `/healthz` e `/readyz`.
4. Validar `GET /v1/me` com um JWT de teste do projeto paralelo e confirmar rejeição de token inválido.
5. Só então planejar a conexão do upload na UI paralela; não alterar o frontend antes de existir uma URL estável e validada do serviço.
6. Não promover, apontar domínio de produção ou alterar `main`.

## Situação

Preparação documental. O serviço ainda não foi implantado, não recebe tráfego e não está conectado ao frontend. O projeto Vercel `shiqi-parallel` é o frontend (raiz `shiqi-parallel/apps/web`); não reutilizá-lo como host do container Rust.


## Provisionamento Railway (27/11/2026)

Projeto Railway dedicado criado:
- Projeto: `SHIQI Core Parallel` (`19a82042-88ea-4111-871d-85e828c73110`)
- Ambiente: `development` (`ab58538a-ad7b-43a6-a904-7ec0ef7ae735`)
- Serviço: `shiqi-core` (`6ea4bd77-edcb-4741-89eb-d7a6548310b7`)
- Root Directory: `/shiqi-parallel/services/core`
- Builder: Dockerfile; arquivo `Dockerfile`
- Health check: `/healthz`
- Variáveis configuradas no serviço: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWT_AUDIENCE=authenticated`; os valores são do Supabase paralelo. Nenhuma service-role key foi configurada.
- O projeto está isolado, sem serviços ou tráfego de produção.

Acesso GitHub App Railway liberado pelo usuário em 27/11/2026. A fonte do serviço `shiqi-core` está conectada ao repositório `steamconnectalex-collab/square`, branch `shiqi-parallel-dev`.

Ainda pendente: configurar `SHIQI_ALLOWED_ORIGIN` com a origem HTTPS exata do frontend paralelo; publicar a imagem; gerar domínio público; verificar `/healthz` e `/readyz`; validar JWT; só então integrar upload na UI.


### Primeiro deployment Railway — 27/11/2026
- Deployment `566fe457-7c58-448b-8b85-9cbc18172004` iniciado automaticamente após conexão da branch.
- Build Docker reconheceu `shiqi-parallel/services/core/Dockerfile` e iniciou `cargo build --release`.
- Estado na última verificação: `BUILDING`; ainda não gerar domínio nem conectar frontend até sucesso e health checks.
