# Plano de enforcement MFA/AAL2 — SHIQI

Data: 2026-11-28  
Estado: **não implementado; bloqueio de segurança documentado**  
Ambiente: Supabase paralelo `ujdosskjycrdkcgsswfa`

## Problema confirmado

A Edge Function e a interface implementam cadastro/validação TOTP e códigos de recuperação, mas o enforcement termina no fluxo de login do app. O Supabase Auth também pode emitir sessão AAL1 para uma senha válida antes do desafio MFA. Os SQLs canônicos atuais não verificam `auth.jwt()->>'aal'` nas policies RLS.

A auditoria encontrou 45 funções SECURITY DEFINER públicas; 39 são executáveis por `authenticated`. Essas funções podem executar como owner e ignorar RLS. Portanto, adicionar apenas uma policy restritiva às tabelas não cobre todas as RPCs.

Consulta read-only em 2026-11-28 encontrou zero fatores MFA verificados cadastrados. A lacuna permanece relevante para qualquer conta que ativar MFA no futuro.

## Comportamento-alvo

- Usuário sem fator TOTP verificado: AAL1 continua permitido, preservando o login normal.
- Usuário com fator TOTP verificado: somente JWT com claim `aal = aal2` pode ler/gravar dados privados e chamar RPCs protegidas.
- Sessões de serviço (`service_role`) e operações administrativas legítimas não devem ser bloqueadas.
- Usuário sem identidade válida nunca deve passar pelo helper.
- MFA recovery/desativação deve seguir fluxo explícito e não permitir acesso AAL1 enquanto o fator ainda estiver verificado.

## Desenho necessário

1. Criar helper privado, SECURITY DEFINER, `search_path = ''`, que retorne falso sem `auth.uid()`; caso exista fator em `auth.mfa_factors` com `status='verified'`, exigir `auth.jwt()->>'aal' = 'aal2'`; sem fator verificado, permitir AAL1.
2. Adicionar policies `AS RESTRICTIVE` nas tabelas públicas com acesso autenticado, mantendo as policies permissivas atuais. Aplicar também a `storage.objects` e `realtime.messages` para cobrir anexos e tópicos privados.
3. Inventariar as 39 funções SECURITY DEFINER executáveis por authenticated e adicionar guard explícito no corpo de cada RPC que acessa dados privados. RLS restritiva sozinha não é suficiente para funções que executam como owner com BYPASSRLS.
4. Revisar overloads, wrappers e funções privadas chamadas por RPCs públicas para evitar caminho indireto sem guard.
5. Preservar as funções administrativas que só são executáveis por `service_role` e as tabelas internas sem grants diretos.
6. Ajustar o fluxo de login para que a sessão AAL1 temporária não seja devolvida quando MFA está ativo; devolver apenas a sessão após verificação TOTP/recovery. A Edge Function deve falhar fechada se a consulta de fatores falhar.

## Matriz de regressão obrigatória em banco isolado

| Identidade | Fator verificado | Claim JWT | Resultado esperado |
|---|---:|---|---|
| Usuário A | não | aal1 | permitido conforme RLS normal |
| Usuário A | sim | aal1 | negado em REST, RPC, Storage e Realtime |
| Usuário A | sim | aal2 | permitido conforme RLS normal |
| Usuário B | sim | aal1 | não lê/grava recursos de A |
| service_role | qualquer | service | operações administrativas mantidas |

Testar explicitamente:
- SELECT/INSERT/UPDATE/DELETE em `profiles`, `messages`, `servers`, `channels`, `friendships`, `dm_members`, `server_events`, `voice_members` e outras tabelas com policies.
- Todas as 39 RPCs executáveis por authenticated, incluindo overloads.
- Storage `avatars` e `attachments`.
- Realtime `messages` e tópicos privados de voz.
- Login normal, login TOTP, recovery code, desligar MFA e revogar sessões.
- AAL1 de usuário com MFA não deve acessar endpoint protegido mesmo que o token tenha assinatura válida.

## Restrições de execução

- Não aplicar este plano diretamente no banco remoto atual.
- Primeiro criar migração versionada no paralelo e testar em branch/local Postgres ou projeto isolado.
- Não inserir manualmente em `auth.users`; fatores de teste devem ser criados pelo fluxo Auth normal ou por fixture isolada que não persista.
- Só promover a migração após revisão completa de policies, grants, funções e regressão AAL1/AAL2.
