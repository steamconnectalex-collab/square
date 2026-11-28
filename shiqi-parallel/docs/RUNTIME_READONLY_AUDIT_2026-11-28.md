# SHIQI — auditoria somente leitura do banco paralelo

Data: 2026-11-28  
Projeto: `shiqi-parallel` (`ujdosskjycrdkcgsswfa`)  
Ambiente: branch de desenvolvimento `shiqi-parallel-dev`  
Escopo: catálogo PostgreSQL, RLS, ACLs, funções SECURITY DEFINER, publicação e policies Realtime. Nenhum DDL/DML foi executado.

## Resultado observado no banco remoto

- Projeto Supabase respondeu `ACTIVE_HEALTHY`, PostgreSQL 17.12.
- As 23 tabelas encontradas no schema `public` estão com RLS habilitado. Nenhuma está com FORCE ROW LEVEL SECURITY; isso não substitui a avaliação dos papéis proprietários e administrativos, que podem contornar RLS.
- O catálogo encontrou 45 funções `SECURITY DEFINER` em `public`; as 45 têm `search_path=""`.
- 39 dessas funções permitem EXECUTE a `authenticated`; nenhuma permite EXECUTE a `anon`.
- Seis funções administrativas/auxiliares permanecem sem EXECUTE para `authenticated` e disponíveis a `service_role`: `get_auth_user_by_email`, `get_login_email_by_username`, `purge_user_data`, `rate_check`, `revoke_user_sessions` e `verify_email_code`.
- As cinco tabelas sem policies RLS são `email_codes`, `mfa_recovery`, `rate_hits`, `server_bans` e `server_invites`. A consulta de ACL confirmou que `anon` e `authenticated` não têm SELECT/INSERT/UPDATE/DELETE direto nessas tabelas; `service_role` tem acesso administrativo. Portanto, os avisos de RLS sem policy são compatíveis com o desenho de acesso mediado por RPC/Edge Function e não justificam criar policies genéricas.
- A publicação `supabase_realtime` contém `friendships`, `messages` e `voice_members`.
- Em `realtime.messages`, as policies `voice_topic_select` e `voice_topic_insert` estão presentes para `authenticated` e delegam a autorização a `private.can_voice_topic(realtime.topic())`.
- Advisors de segurança retornaram 5 avisos INFO de RLS sem policy (as tabelas internas acima) e um aviso WARN agregado para 39 funções SECURITY DEFINER executáveis por usuários autenticados. O aviso é genérico: a ACL confirmou zero execução por `anon`, `search_path` vazio e que as 39 funções correspondem ao conjunto de RPCs de usuário; isso não substitui revisão do corpo e teste de autorização de cada RPC.
- Advisors de performance apontaram seis índices ainda não usados. Como o ambiente paralelo tem baixo volume de dados/testes, não remover índices com base apenas nesse indicador.

## Decisões

1. Não revogar EXECUTE em lote nas 39 RPCs: o frontend depende delas e a ACL já impede chamadas por `anon`.
2. Não criar policies genéricas nas cinco tabelas internas: elas não têm grants diretos para `anon` ou `authenticated`.
3. Não remover índices não utilizados durante a fase de baixo tráfego.
4. Não executar alterações no banco nesta rodada.

## Próxima etapa operacional

Construir e executar uma regressão controlada com duas identidades autenticadas, cobrindo isolamento de perfis, amizades pendentes/aceitas, bloqueios e DMs, associação a servidores/canais, mensagens/edição/exclusão, reações, convites/banimentos, eventos e presença/sinalização de voz. Incluir testes negativos (usuário A tentando ler ou alterar recursos exclusivos de B), transações de limpeza e verificação das policies Realtime. Não repetir o teste de 10 participantes em voz já feito pelo usuário.

Limites: esta consulta ao catálogo confirma a configuração atual, mas não prova a autorização efetiva em requisições autenticadas, nem substitui testes de concorrência, Auth/JWT, Storage ou Realtime em runtime. A validação de `GET /v1/me` permanece pendente e foi colocada em segundo plano conforme decisão do usuário; upload de imagem permanece adiado.

## Teste negativo executado no banco paralelo — 2026-11-28

Foi executado no PostgreSQL remoto, dentro de uma transação finalizada com `ROLLBACK`, um teste usando o role `authenticated` sem identidade JWT (`auth.uid() = NULL`). Dez RPCs de escrita foram rejeitadas com `not_authenticated`: `block_user`, `create_server`, `create_invite`, `open_dm`, `send_friend_request`, `toggle_reaction`, `voice_join`, `save_my_settings`, `ban_member` e `kick_member`. Também foram confirmados os resultados sem identidade: `is_server_member` retorna false, `get_my_settings` retorna objeto vazio e `profiles_full` não retorna linhas para um UUID arbitrário.

O roteiro reproduzível está em `shiqi-parallel/tests/supabase-auth-negative.sql`. Esse teste verifica caminhos sem identidade; não prova isolamento entre dois usuários reais nem substitui testes com JWT assinado. A transação foi revertida; nenhum dado persistente foi criado.

## Acesso anônimo e disponibilidade de identidades de teste

- Consulta adicional ao catálogo confirmou zero tabelas públicas com SELECT/INSERT/UPDATE/DELETE concedido a `anon`; as 23 tabelas públicas continuam com RLS habilitado.
- O projeto contém atualmente uma conta em `auth.users` e um perfil em `public.profiles`. Portanto, ainda não há duas identidades reais para executar a regressão cruzada A-versus-B. Não foi criado usuário manualmente nem enviado e-mail de cadastro nesta etapa.
