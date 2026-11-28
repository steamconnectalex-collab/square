# SHIQI — entrega técnica e pendências

Data da revisão: 2026-11-28  
Branch de trabalho: `shiqi-parallel-dev`  
Ambiente Supabase: `shiqi-parallel` (`ujdosskjycrdkcgsswfa`)  
Ambiente Railway: `SHIQI Core Parallel`

## Estado resumido

O ambiente paralelo tem banco, autenticação e serviço Rust ativos. A Edge Function Auth foi publicada como versão 3. O código foi endurecido, os contratos do frontend foram cruzados com o SQL canônico e foram criados testes de regressão isolados. Ainda não é correto declarar o produto 100% pronto para lançamento: há validações de runtime e uma lacuna de enforcement MFA que precisam ser fechadas.

## Entregue nesta etapa

- Banco paralelo: 23/23 tabelas públicas com RLS; ACLs mínimas por coluna; tabelas internas sem grants diretos a `anon`/`authenticated`.
- Auditoria de runtime: 45 funções SECURITY DEFINER no schema public, todas com `search_path` vazio; 39 executáveis por authenticated e nenhuma por anon.
- Auth Edge Function v3 ativa no Supabase paralelo:
  - configuração própria do projeto paralelo, sem origens do site principal;
  - consulta de fatores MFA, cooldown de códigos, reativação e revogação de sessões falham fechadas;
  - verificação de senha encerra a sessão temporária local;
  - exclusão de conta percorre subpastas, pagina Storage e remove em lotes de até 1.000 objetos, interrompendo em caso de erro.
- Rust `shiqi-core` ativo no Railway paralelo; `/healthz` e `/readyz` já responderam corretamente em verificações anteriores.
- 30 RPCs chamadas pelo frontend conferidas contra definições dos SQLs canônicos; nenhuma chamada nominal sem função correspondente.
- Teste SQL de autorização negativa: dez RPCs de escrita rejeitaram chamadas sem identidade autenticada; transação revertida.
- Teste RLS A/B simulado: identidade A lê/atualiza o próprio perfil; identidade B sintética não lê nem atualiza o perfil de A e não obtém dados via `profiles_full`; transação revertida.
- Smoke browser isolado criado para `shiqi-parallel/apps/web`; usa mocks do Supabase e Rust, sem alterar o smoke test da raiz e sem testar QR.
- CI ampliado com Deno check, sintaxe JS, paridade RPC/SQL, health/401 da Auth publicada, Playwright e smoke Rust.

## Bloqueios e resultados não confirmados

1. **MFA/AAL2 — lacuna de segurança aberta.** O fluxo TOTP existe, mas os SQLs não exigem `aal2` em RLS nem nas RPCs SECURITY DEFINER executáveis por authenticated. O projeto tinha zero fatores MFA verificados na auditoria. A proteção não deve ser anunciada como enforcement completo até corrigir e testar esse ponto.
2. **CI estendido — resultado pendente de confirmação.** O CI anterior `46101145360` terminou SUCCESS. Não foi possível confirmar o resultado da nova execução com Deno/Playwright pelo conector disponível; não presumir aprovação.
3. **Vercel — bloqueio de build.** Os deployments recentes do projeto paralelo e do projeto principal conectado ao repositório foram recusados por `build-rate-limit`. Não foi contornado o limite. O último preview READY conhecido é `shiqi-parallel-dtqz3hin3-steamconnectalex-9536.vercel.app`, do commit `813cf1e287fc82fcf0dea8000d6834117ff7b3d9`. A branch atual ainda não tem preview renovado.
4. **JWT real no Rust.** `/v1/me` sem token rejeita corretamente, mas a validação de um JWT real de usuário ainda não foi confirmada.
5. **Duas contas Auth reais.** O projeto tinha uma conta Auth. O teste A/B feito usa uma identidade sintética e não substitui duas contas reais para DMs, servidores, bloqueios, Realtime e autorização cruzada.
6. **Upload real.** A integração está no código, mas o upload real continua adiado; apenas contratos/mocks foram preparados.
7. **Health Auth v3 após publicação.** A versão 3 está ACTIVE e sua fonte foi conferida; a chamada HTTP de health e o teste 401 sem JWT foram adicionados ao CI, mas o resultado dessa nova execução ainda não foi confirmado.
8. **Sessões revogadas.** O Supabase mantém access tokens válidos até sua expiração mesmo após revogação de refresh tokens; a duração efetiva depende da configuração de expiração JWT.

## Testes manuais que ainda podem ser necessários

- Criar uma segunda conta pela tela normal de cadastro, com um e-mail acessível, para validar duas identidades reais. Não inserir usuários manualmente em `auth.users`.
- Fazer login real no preview atualizado e confirmar `GET /v1/me` com o JWT real.
- Executar upload de imagem real e conferir Storage privado, caminho do usuário, limite de tamanho/MIME e exibição na conversa. Upload foi adiado por decisão anterior.
- Com duas contas, validar pedidos/aceite de amizade, DMs, bloqueios, leitura cruzada de perfis, mensagens e Realtime.
- Ativar MFA em uma conta de teste e validar login TOTP, códigos de recuperação e enforcement AAL2 após implementação da política.
- Testar desativação/exclusão de conta com credenciais de teste e confirmar remoção de Storage e sessões.
- Abrir o preview Vercel da branch atual depois que o limite de builds permitir novo deployment.

## Recursos preservados como placeholders ou fora do escopo

- Loja, compras, pagamentos, resgates, pontos, missões, inventário e Shiqi Plus continuam sem transação comercial/persistência comprovada; os placeholders foram preservados.
- GIFs e presentes continuam “em breve”.
- Música e QR login permanecem fora do escopo; não foram implementados nem testados.
- Não repetir o teste de voz com 10 participantes já realizado.
- Não repetir testes reais de upload ou /v1/me sem que sejam retomados como etapa de validação específica.

## Proteção do projeto principal

- Nenhuma alteração foi enviada para `main`.
- `site/config.js`, `agents.md` e `task.md` da raiz foram alinhados ao conteúdo de `main` apenas na branch paralela.
- As funções Supabase da raiz e o site original foram preservados.
- A workflow `.github/workflows/shiqi-core.yml` é específica da branch paralela e fica fora de `shiqi-parallel/`; revisar seletivamente antes de qualquer merge. Não fazer merge automático desta branch.
- Não publicar mudanças de schema/cutover remoto sem validação isolada.

## Critério para declarar concluído

Só marcar como final quando: CI estendido verde; Auth v3 health/401 confirmado; preview atualizado disponível; MFA/AAL2 implementado e testado; JWT real validado no Rust; e as pendências reais de duas contas/Realtime/upload tiverem evidência ou forem explicitamente aceitas como testes de lançamento pelo responsável.


## Atualização final da revisão — 2026-11-28

- Auth Edge Function está ACTIVE na versão 3; a fonte publicada foi conferida e contém as proteções de falha segura, encerramento da sessão temporária e limpeza paginada de Storage.
- Railway `shiqi-core` concluiu SUCCESS no commit mais recente registrado durante esta revisão. Os endpoints `/healthz` e `/readyz` já tinham sido validados anteriormente.
- O probe RLS A/B simulado foi executado novamente após trocar o UUID B por um valor aleatório. Resultado aprovado; consulta posterior confirmou zero linhas com o texto de teste no perfil, portanto nenhuma alteração do probe permaneceu.
- Revisão estática manual dos novos testes passou, incluindo rollback, ausência de INSERT manual em `auth.users`, exclusão de QR e contratos de Auth/Storage.
- A nova execução completa do GitHub Actions (Deno/Node/Playwright/HTTP Auth) ainda não foi confirmada; não declarar CI estendido verde.
- Vercel ainda aponta para o último preview READY no commit `813cf1e287fc82fcf0dea8000d6834117ff7b3d9`; a branch atual não recebeu novo preview por `build-rate-limit`.

- Plano técnico detalhado da lacuna MFA/AAL2 registrado em `docs/MFA_AAL2_ENFORCEMENT_PLAN.md`; cobre RLS, RPCs SECURITY DEFINER, Storage, Realtime e matriz AAL1/AAL2. Nenhum DDL foi aplicado.

- O smoke browser paralelo foi revisado para remover todos os mocks/rotas de música, playlists e iTunes; também não contém referências nem testes de QR.
