# SHIQI — auditoria inicial para adoção de Rust

Data: 2026-11-26  
Branch: `shiqi-parallel-dev`

## Regra de compatibilidade

O frontend original em HTML/CSS/JavaScript é a referência visual e funcional. Nenhuma rota do frontend, componente, estilo, fluxo de navegação ou regra de negócio será alterada por esta etapa.

## Achados confirmados no código e nas migrações

| Área | Implementação atual | Decisão para Rust |
|---|---|---|
| Mensagens | PostgreSQL + RLS + Supabase Realtime | Manter como está até medir latência/volume. |
| Limite de mensagens | Trigger no PostgreSQL: 5 mensagens/5 s e 40/min por autor | Não duplicar no processo Rust; o banco continua autoridade. |
| Autenticação | Edge Function Deno `auth`, Supabase Auth e tabelas privadas | Não migrar sem contrato completo, testes e equivalência de segurança. |
| Rate limit de autenticação | RPC `rate_check` e tabela `rate_hits`, acessíveis à service role | Preservar; evitar um contador em memória que não compartilha estado entre instâncias. |
| Anexos | Bucket `attachments`, público para leitura, 3 MiB, JPEG/PNG/WebP; gravação/apagamento na pasta do próprio usuário | Rust pode validar/transformar mídia, mas o endpoint só será conectado depois de implementar validação JWT e autorização equivalente às policies Storage. |
| Presença | Heartbeat no app e timestamp `last_seen` | Medir antes de introduzir gateway WebSocket. |
| Voz | WebRTC P2P, sinalização no canal privado Realtime; `voice_join` limita a seis pessoas e uma sala por usuário | Não substituir por SFU/gateway sem teste com usuários reais e estimativa de custo/latência. |
| Desktop | Electron carrega o site, mantém permissões de mídia e captura de tela | Nenhuma mudança no Electron nesta etapa. |

## Limitações que bloqueiam migração completa

1. A cópia de migrações ainda depende de estruturas preexistentes não versionadas, incluindo `servers`, `server_members`, `channels` e funções auxiliares.
2. Os arquivos 0011 (música) e 0021 (eventos) são resumos, não SQL executável completo.
3. A integração não tem acesso autorizado ao projeto Supabase original. O banco paralelo de cinco tabelas não é paridade do banco de produção.
4. Os testes de fumaça existentes não equivalem a testes de carga, segurança de JWT, upload real ou chamadas de voz com duas pessoas reais.

## Entrega Rust desta etapa

- Serviço HTTP Axum/Tokio isolado.
- Logs de requisição via Tower HTTP TraceLayer.
- Endpoints operacionais `/healthz` e `/readyz`.
- Encerramento gracioso.
- Validador de assinatura/tamanho/Content-Type para anexos, alinhado ao limite e aos MIME types do bucket atual.
- Testes unitários do validador.

O validador ainda não está exposto por uma rota e não grava arquivos. Isso é intencional: não se deve abrir um endpoint de upload antes de validar JWT, usuário, limites de requisição, destino e policies do Storage.

## Próximas fases seguras

1. Recuperar/reconstruir o schema ausente e provar paridade com o contrato usado pelo frontend.
2. Adicionar validação JWT baseada no JWKS do Supabase e testes de claims/issuer/audience/expiração.
3. Implementar upload/proxy de mídia com contexto do usuário, limites de bytes e autorização; executar testes de regressão de anexos.
4. Só então considerar processamento assíncrono durável (fila persistida e retries), sem jobs em memória que se percam em reinícios.
5. Avaliar rate limiting distribuído somente para rotas novas, mantendo os limites atuais do banco.
6. Medir Realtime/presença e voz antes de decidir por gateway ou SFU.

## Segurança

- Nenhuma chave `service_role` no navegador ou no repositório.
- Não confiar em `X-Forwarded-For` sem uma lista explícita de proxies confiáveis.
- Não usar rate limit em memória como controle de abuso distribuído.
- Não ignorar RLS nem executar consultas com privilégios elevados sem contexto de usuário.
