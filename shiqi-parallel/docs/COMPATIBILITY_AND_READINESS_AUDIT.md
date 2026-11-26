# SHIQI — auditoria de compatibilidade e plano de preparação

Data da auditoria: 2026-11-26
Branch: `shiqi-parallel-dev`
Escopo: preparação isolada; nenhuma alteração no projeto original, em `main` ou em produção.

## Decisão de segurança

**Não aplicar em lote as migrations copiadas e não publicar a Edge Function de autenticação neste estado.**
O banco paralelo contém um schema mínimo de comunidades/chat que não é equivalente ao schema exigido pelo aplicativo original. A migração incremental deve ser precedida por uma reconstrução e comparação de contratos, sem apagar ou renomear tabelas existentes.

## Constatações confirmadas

1. O Supabase paralelo `ujdosskjycrdkcgsswfa` está ativo, mas contém somente as tabelas públicas `profiles`, `communities`, `community_members`, `channels` e `messages`. As cinco têm RLS habilitado.
2. O histórico remoto do banco paralelo contém cinco migrations de bootstrap/hardening, não a sequência original 0001–0025.
3. Não há Edge Functions publicadas no projeto Supabase paralelo.
4. A migration original `0002_chat_e_perfil.sql` pressupõe que uma migration anterior chamada `servidores_e_canais` já tenha criado `servers`, `server_members`, `channels`, `create_server` e `is_server_member`. Essa migration-base não está no diretório versionado; o próprio arquivo 0002 só a descreve em comentário.
5. O schema atual paralelo de `profiles` não é compatível com a definição da migration original 0001: campos obrigatórios e nomes/tipos diferem. A tabela `channels` também usa `community_id/channel_type`, enquanto o app original espera `server_id/kind`. Não tentar corrigir com renames ou drops sem um plano de compatibilidade.
6. A Edge Function `supabase/functions/auth/index.ts` no branch paralelo é um stub de aproximadamente 50 linhas e termina após declarar a expressão de validação de e-mail. Não contém servidor HTTP, roteamento, handlers ou `Deno.serve`.
7. **A fonte correspondente em `main` também é o mesmo stub incompleto** (com fallback de chave publicável e URL antigas). Portanto, não existe uma implementação completa dessa função no Git versionado que possa simplesmente ser copiada. As rotas descritas no cabeçalho e chamadas pelo frontend não estão implementadas nesse arquivo.
8. O frontend original chama pelo menos `POST /signup` e `POST /login`; os fluxos adicionais anunciados no cabeçalho incluem verificação e reenvio de e-mail, TOTP, recuperação e redefinição de senha, alteração de e-mail, desativação/exclusão da conta e recuperação MFA.
9. A migration `0025_voz_10_participantes.sql` depende de colunas `muted`, `deafened`, `video` e `screen` adicionadas em `0023_estado_da_chamada.sql`. A sequência 0023 antes de 0025 é requisito. A migration 0025 não foi aplicada no banco paralelo.
10. As migrations 0011 (música) e 0021 (eventos) são notas/resumos, não implementações completas. A sequência 0001–0025, isoladamente, não é um bootstrap reproduzível do banco original.
11. A auditoria de segurança do Supabase paralelo não retornou findings na consulta desta data. Isso não substitui testes funcionais, revisão das policies nem validação do schema.

## Restrições preservadas

- Não tocar no projeto Supabase original nem no Supabase `ocfmaogjjvlqhueywrnz`.
- Não alterar `main`, `site/`, `desktop/`, domínio principal ou produção.
- Não substituir design, telas, componentes, fluxos ou regras de negócio.
- Não colocar `service_role`, segredos Resend ou outras credenciais privadas no navegador ou no Git.
- Não criar contas por SQL em `auth.users`.
- Não publicar Edge Functions antes de implementar e testar todos os contratos.
- Não executar migrations históricas em lote no banco paralelo.


## Contratos já identificados no frontend original

- Rotas HTTP chamadas pelo frontend de acesso: `/signup`, `/verify`, `/resend`, `/login`, `/login/totp`, `/forgot`, `/reset`, `/qr/create`, `/qr/info`, `/qr/poll` e `/qr/approve`.
- Rotas adicionais declaradas no cabeçalho da função, mas que ainda precisam ser rastreadas até as telas/ações que as usam: `/email/change/request`, `/email/change/confirm`, `/account/deactivate`, `/account/delete`, `/mfa/recovery` e `/mfa/disable`.
- RPCs já localizadas no código de configurações: `get_my_settings`, `save_my_settings`, `change_username`, `my_age_group` e `unsubscribe_marketing`.
- A busca por chamadas diretas `.from(...)` não encontrou referências estáticas nos oito arquivos JS principais; isso indica que parte do acesso pode estar encapsulada em helpers/dinâmico e exige rastreamento adicional, não ausência de dependências.
- Payloads e respostas de cada rota ainda precisam ser documentados individualmente antes de implementar/substituir o backend.

## Plano de preparação

### Fase A — inventário de contratos (em andamento)
- Mapear todas as tabelas, colunas, funções RPC, triggers, policies, buckets e publicações Realtime usadas pelo frontend.
- Identificar a definição histórica ausente de `servers/server_members/channels` e os contratos de criação/associação.
- Mapear cada chamada HTTP da função `auth`, seus payloads, respostas e códigos de erro usados pela interface.
- Recuperar uma implementação completa de autenticação de fonte autorizada; se não existir, reconstruí-la com testes de contrato, sem alterar a interface.

### Fase B — schema paralelo compatível
- Produzir migrations novas, aditivas e revisáveis, compatíveis com o schema paralelo já existente.
- Manter as tabelas de comunidades atuais intactas; escolher explicitamente entre compatibilidade por colunas/visões ou schema isolado para servidores, após análise das consultas e policies.
- Implementar RLS por recurso e relação, funções privilegiadas com `search_path` seguro e grants mínimos.
- Recriar buckets e policies de Storage, triggers e tabelas auxiliares somente após inventário completo.
- Aplicar primeiro em ambiente descartável/isolado e validar com queries de leitura e testes de permissão.

### Fase C — autenticação
- Definir contratos completos para signup, verify, resend, login, MFA/TOTP, recuperação, troca de e-mail e gestão de conta.
- Configurar secrets apenas no Supabase paralelo; validar Resend sender e domínio sem expor a chave.
- Testar JWT, expiração, sessão, rate limit persistente, códigos OTP, tentativas, cooldown, enumeração de contas e recuperação.
- Não criar a conta de avaliação antes do fluxo seguro estar operacional.

### Fase D — Rust
- Manter Rust como serviço complementar até provar equivalência de autorização com Supabase Auth/RLS.
- Adicionar testes de tokens assinados e casos negativos para issuer, audience, expiração, nbf, kid e rotação JWKS.
- Validar upload com JWT e políticas Storage antes de expor endpoint; os validadores atuais ainda não fazem upload.
- Não duplicar rate limits já impostos por triggers/RPC.
- Manter Realtime e WebRTC existentes até medições justificarem substituição.

### Fase E — regressão e segurança
- Criar matriz de regressão para cada fluxo/tela original e comparar capturas/DOM/comportamentos com a versão paralela.
- Testar cadastro, login, perfil, servidores, canais, mensagens, DMs, amizades, bloqueios, anexos, reações, threads, configurações, loja, QR, presença, MFA e conta.
- Testar RLS com usuários distintos (owner, membro, não membro, anon) e confirmar negação por padrão.
- Executar testes Rust, verificações estáticas, análise de dependências e Supabase Security Advisors.
- Registrar riscos, resultados, rollback e critérios de aceite antes de qualquer proposta de promoção.

## Fora do escopo desta rodada
- Teste de carga da sala de voz com 10 participantes (já realizado pelo usuário).
- Publicação do Preview Vercel enquanto o limite de deployments estiver bloqueado.
- Qualquer merge para `main` ou publicação em produção.

## Critério para considerar pronto
Só recomendar implantação quando houver schema reproduzível e compatível, autenticação completa com testes de contrato, RLS/Storage validados, regressão funcional e visual aprovada, CI verde no commit final e plano de rollback testado.
