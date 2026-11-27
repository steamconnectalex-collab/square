# SHIQI — plano de reconciliação do banco paralelo

Data: 2026-11-26  
Branch: `shiqi-parallel-dev`  
Destino: `shiqi-parallel` (`ujdosskjycrdkcgsswfa`)  
Fonte de referência somente leitura: projeto original `square` (`vjkqyqdabypdylhoupha`)

## 1. Limites obrigatórios

- O projeto original é somente fonte de referência. Não alterar tabelas, funções, políticas, usuários, dados, buckets, Realtime ou Edge Functions nele.
- Nenhum dado de usuário será copiado do original. O destino está vazio nas cinco tabelas atualmente existentes.
- Não executar DDL nem aplicar migrations nesta fase de planejamento.
- Não apagar nem renomear `profiles`, `channels`, `messages`, `communities` ou `community_members` sem plano aprovado e estratégia de reversão.
- Música fica excluída. Login por QR fica fora do escopo, sem inspeção ou reconstrução.
- Manter a exceção aprovada de 10 participantes por sala de voz no schema paralelo.
- Nenhuma mudança em UI, produção, domínio, `main`, Vercel ou app desktop.

## 2. Estado observado do destino

Consulta somente leitura em 26/11/2026:

- Cinco tabelas públicas: `profiles`, `communities`, `community_members`, `channels`, `messages`; todas com RLS habilitado e zero linhas.
- Cinco migrations registradas no histórico remoto: `shiqi_initial_community_chat_schema`, `shiqi_harden_rls_and_private_helpers`, `shiqi_optimize_profile_rls`, `shiqi_auth_profile_triggers`, `shiqi_tighten_column_permissions`.
- `profiles` usa `avatar_url` e `updated_at`; faltam campos do contrato original como `birth_date`, `marketing_opt_in`, `avatar_path`, `accent`, `last_seen`, `terms_accepted_at`, `plan`, `settings`, `presence`, `deactivated_at` e `profile_updated_at`. Também diferem regex/limites de username e display name.
- `communities`/`community_members` usam nomes e campos próprios e não são equivalência comprovada de `servers`/`server_members`.
- `channels` usa `community_id` e `channel_type`, não `server_id` e `kind`; nome aceita até 80, não 30; não suporta DM por `server_id IS NULL` e `kind='dm'`.
- `messages.id` é UUID gerado; o contrato da SHIQI exige bigint identity. Faltam `attachment_path`, `attachment_alt`, `thread_of`; limite de conteúdo atual é 10.000, enquanto o contrato original limita a 2.000.
- Faltam as demais tabelas, funções RPC, triggers, buckets e policies Storage do contrato original.
- Realtime do destino contém somente `public.messages`; o contrato original também publica `friendships` e `voice_members`.
- Nenhum bucket foi encontrado no destino (`avatars` e `attachments` ainda precisam ser criados).
- As policies atuais são próprias do modelo communities e não reproduzem as regras de servidores, DMs, amizades, bloqueios, moderação, eventos e voz.
- Catálogo de funções do destino contém somente helpers privados do modelo communities. Não há RPCs públicas do app original.
- Consulta de privilégios de tabela mostrou concessões diretas amplas a `anon` nas cinco tabelas (além de `authenticated` e `service_role`). As policies listadas são para `authenticated`, sem policies `anon`; ainda assim, o destino deve adotar grants mínimos explicitamente e revogar privilégios desnecessários de `anon` no plano de hardening.

## 3. Referência original fora de música e QR

A auditoria e o catálogo consultados identificam como núcleo do app, sem música:

- 19 tabelas públicas no inventário original; `qr_sessions` é excluída por decisão de escopo, assim como `music_favorites`, `playlists` e `playlist_tracks`. O conjunto-alvo funcional deve ser recalculado com essa exclusão explícita.
- Tabelas centrais: `profiles`, `email_codes`, `rate_hits`, `servers`, `server_members`, `channels`, `messages`, `server_invites`, `dm_members`, `friendships`, `blocks`, `voice_members`, `server_bans`, `server_pins`, `mfa_recovery`, `message_reactions`, `server_events`, `event_interest`.
- 13 funções privadas e 45 públicas sem música, com definições e regras inventariadas em `REMOTE_SCHEMA_AUDIT.md` e `SCHEMA_DEPENDENCY_INVENTORY.md`. Grants devem ser reconstruídos por função, não copiados por contagem ou concedidos a PUBLIC.
- Triggers do original: `accept_on_reply`, `check_thread_parent`, `messages_rate_limit`, `touch_edited_at`, `touch_profile`.
- Buckets: `avatars` (1 MiB; JPEG/PNG/WebP) e `attachments` (3 MiB; JPEG/PNG/WebP/GIF), com policies por pasta do usuário.
- Realtime: `messages`, `friendships`, `voice_members`.
- Limites/regra especial: voz no destino = 10 participantes; demais limites e regras conforme definições SQL documentadas.
- O histórico remoto do projeto original lista migration `servidores_e_canais`, mas o arquivo-base equivalente não aparece no diretório Git de migrations. A estrutura e funções foram parcialmente recuperadas do catálogo PostgreSQL; comparar integralmente com os arquivos Git antes de compor a migration nova.

## 4. Estratégia de reconciliação proposta (ainda não aprovada para execução)

### Fase A — snapshot lógico e mapa de colisões
1. Guardar em documentação os metadados completos das cinco tabelas atuais, policies, funções, triggers, grants e migrations remotas.
2. Cruzar cada objeto atual com o contrato original e identificar dependências internas do próprio schema communities.
3. Confirmar se o destino está realmente sem dados e sem integrações externas conectadas. A consulta atual retornou zero linhas, mas isso deve ser revalidado imediatamente antes de qualquer DDL.

### Fase B — estrutura canônica sem perda
1. Não reaproveitar as tabelas incompatíveis por simples adição de colunas: `messages.id` UUID não pode virar bigint identity de forma segura e transparente; `channels` tem FK e semântica próprias.
2. Preferência inicial: preparar uma estrutura canônica isolada (schema privado/versionado ou novas tabelas com nomes temporários) e validar constraints/FKs/functions/RLS sem tocar nas cinco tabelas existentes.
3. Para expor a API final em `public`, escolher entre camada de compatibilidade/views ou troca controlada de nomes somente após análise das dependências, grants, PostgREST, Realtime e reversão. Não escolher nem executar a troca nesta fase.
4. Se for necessário preservar o modelo atual, mantê-lo intacto como legado isolado até a decisão final. Nenhum `DROP`, `TRUNCATE`, `ALTER COLUMN TYPE` ou `RENAME` será incluído sem aprovação específica.

### Fase C — segurança e serviços
1. Recriar RLS com predicados reais de membership/ownership e `TO authenticated`; evitar políticas genéricas baseadas apenas no papel.
2. Criar funções auxiliares privadas com `search_path` fixo e checagem explícita de identidade; revisar individualmente cada função `SECURITY DEFINER`.
3. Definir grants mínimos para tabelas, sequences e RPCs; não conceder EXECUTE a PUBLIC/anon por padrão.
4. Criar buckets e policies Storage com os limites e caminhos por usuário; habilitar somente as tabelas necessárias no Realtime.
5. Configurar Edge Function `auth` no destino depois de validar contratos e segredos necessários. Não publicar nem enviar e-mail durante a reconciliação de schema.

### Fase D — migrations e verificação
1. Gerar migrations incrementais numeradas e revisadas, sem depender do histórico do banco original.
2. Aplicar primeiro em ambiente isolado/branch de desenvolvimento, não em produção.
3. Validar catálogo, constraints, FKs, RLS, grants, Storage, Realtime e advisors.
4. Executar testes de contrato e regressão por fluxo antes de integrar frontend.
5. Manter plano de reversão por migration e snapshot lógico antes de cada alteração.

## 5. Decisões pendentes antes de qualquer DDL

- Escolha técnica entre schema canônico isolado com camada de compatibilidade ou renomeação controlada do legado. A primeira opção é mais conservadora para evitar perda, mas precisa confirmar exposição do schema no Data API e compatibilidade com o frontend REST atual.
- Confirmar se o destino é descartável/sem dados externos; atualmente todas as cinco tabelas retornaram zero linhas, mas não assumir que isso autoriza apagar objetos.
- Recuperar/normalizar a definição integral da migration base de servidores/canais e eventos, cruzando os objetos vivos do banco original com os arquivos Git incompletos.
- Revisar diferença entre migrations versionadas localmente e histórico remoto em ambos os projetos.

## 6. Recuperação de SQL versionado (26/11/2026)

A inspeção do diretório de migrations na branch confirmou que os arquivos originais 0001–0024 existem na raiz do repositório; a cópia paralela contém 0001–0010 e 0013–0025, com música omitida. Portanto, várias definições podem ser recuperadas do Git sem pedir ao usuário para copiar SQL.

Arquivos lidos diretamente:
- `0001_acesso_a_conta.sql`: contém perfis, email_codes, rate_hits e cinco funções de autenticação/rate limit. Também contém `qr_sessions`, mas QR permanece fora do escopo e não será reconstruído.
- `0002_chat_e_perfil.sql`: contém alterações de perfil, helpers privados, tabela messages, RLS/grants/triggers e Realtime. O próprio arquivo confirma que depende da migration-base `servidores_e_canais`, cuja definição completa não está nesse arquivo.
- `0003_convites_canais_presenca.sql`: contém server_invites, presença e RPCs create_channel/create_invite/join_server.
- `0005_amigos_e_mensagens_diretas.sql`: contém dm_members, friendships, helpers, policies e RPCs de amizade/DM.
- `0021_eventos.sql`: é somente um resumo; não contém DDL executável das tabelas e funções de eventos.
- `0024_seguranca_grants.sql`: contém revogações de acesso para tabelas sensíveis, mas não substitui o inventário completo de grants.

Contagem corrigida do alvo: **18 tabelas**, excluindo explicitamente `qr_sessions` e as três tabelas de música. A lista de 18 está no item 3; evitar a contagem anterior de 19 como alvo.

Lacunas confirmadas após leitura dos arquivos: SQL completo de `servidores_e_canais` e SQL executável de eventos. Outros arquivos versionados ainda precisam ser cruzados com o estado vivo e com as dependências para detectar diferenças entre o SQL do Git e o banco de referência.

## 7. Recuperação adicional do banco original (26/11/2026)

Foram consultadas definições vivas no catálogo PostgreSQL do projeto original, em modo somente leitura, para preencher as duas lacunas que não estão no Git.

### Schema base de servidores/canais recuperado
Tabelas e campos confirmados:
- `servers`: id UUID, name, owner_id, created_at, is_public false, level 1.
- `server_members`: server_id, user_id, role ('owner'|'member'), joined_at; chave primária composta.
- `channels`: id UUID, server_id anulável, name, kind ('text'|'voice'|'dm'), position, created_at. Canal DM exige server_id NULL; canais de servidor usam FK com cascade.
- Regras: nome do servidor 2–40; nome do canal 1–30; level 1–10.
- `create_server(p_name)`: autentica usuário, limita 10 servidores por proprietário, cria servidor, associação owner e canais Geral/Sala principal.
- `is_server_member(uuid)`: verifica associação do usuário autenticado.
- RLS: servers e server_members só visíveis a membros; channels visíveis a membros do servidor ou membros DM (helper privado).

### SQL completo de eventos recuperado
- `server_events`: id, server_id, creator_id, title, description, place, starts_at, created_at; limites title 2–80, description 500, place 80.
- `event_interest`: event_id, user_id, created_at; chave primária composta.
- RPCs completas recuperadas: `create_event` (só dono, data futura com tolerância de 5 min, máximo 25 eventos futuros), `delete_event` (só dono), `toggle_event_interest` (membro).
- Policies de leitura limitadas a membros do servidor; funções SECURITY DEFINER com search_path vazio.

### Confirmação importante
O banco original foi consultado apenas com SELECT de metadados/definições. Nenhuma tabela, dado, função, grant, policy, migration ou configuração foi modificada.

## 8. Resultado desta sessão

- Etapa 1 fechada por inspeção estática em `FEATURE_PARITY_MATRIX.md`.
- Etapa 2 iniciada em modo de auditoria e planejamento.
- Consultas feitas somente para leitura nos metadados do banco paralelo e no catálogo já autorizado do original.
- Nenhum DDL, migration, grant, bucket, policy, função, trigger, publicação Realtime, Edge Function ou dado foi criado, alterado ou removido.

## 9. Auditoria adicional das dependências do protótipo (26/11/2026)

Foi revalidado o estado do destino por SELECT: `profiles`, `communities`, `community_members`, `channels` e `messages` continuam com zero linhas cada. Isso confirma ausência de registros nessas tabelas neste instante, mas não autoriza apagar objetos nem substitui a análise de dependências.

Dependências atuais confirmadas:
- `communities` tem o trigger `communities_add_owner` → `private.add_community_owner()`, que insere em `community_members`.
- `profiles` tem o trigger `profiles_set_updated_at` → `private.set_updated_at()`.
- `auth.users` possui handler `private.handle_new_user()`, que insere em `public.profiles(id, username, display_name)`. A implementação atual permite username nulo e foi escrita para o protótipo; não pode permanecer como está sem adaptação ao contrato canônico.
- Policies de `channels`, `communities`, `community_members` e `messages` chamam `private.is_community_admin()` e/ou `private.is_community_member()`. Essas policies pertencem ao modelo communities, não podem ser reutilizadas como autorização do produto final.
- Os helpers `private.add_community_owner`, `private.is_community_admin`, `private.is_community_member` e `private.set_updated_at` continuam vinculados ao protótipo.

### Estratégia de preservação preferida (proposta, ainda sem DDL)

A estratégia mais segura em princípio é preservar o protótipo por renomeação controlada, em vez de converter colunas/tipos incompatíveis:
1. Fazer snapshot lógico de metadados e revalidar contagens imediatamente antes da mudança.
2. Renomear as cinco tabelas públicas incompatíveis para nomes de arquivo/legado, preservando seus OIDs, constraints, índices, policies e triggers ligados às próprias tabelas. As FKs existentes continuam apontando para os objetos originais por identidade interna.
3. Manter os helpers e triggers exclusivos do protótipo isolados e documentados; confirmar que nenhum nome de função colide com o conjunto canônico.
4. Substituir cuidadosamente o handler `private.handle_new_user()` para inserir o perfil no novo contrato canônico, com valores padrão e fallback de username compatíveis com as constraints reais. Preservar o gatilho de `auth.users`, sem criar usuário ou enviar e-mail de teste.
5. Criar as tabelas canônicas públicas e reconstruir funções, RLS, grants, Storage e Realtime a partir das definições verificadas.
6. Testar os catálogos e os contratos antes de integrar a interface.

A renomeação acima ainda exige uma última verificação: corpos PL/pgSQL podem resolver referências a nomes de tabela em tempo de execução, enquanto policies e FKs mantêm dependências internas. Portanto, as rotinas antigas do protótipo não podem ser consideradas funcionais após a troca sem teste. A preservação é para arquivo/rollback, não para manter o protótipo operando em paralelo.

### Diferença identificada no limite de voz

A função viva no banco original `voice_join` impõe atualmente o limite de 6 participantes. A branch paralela contém a alteração aprovada `0025_voz_10_participantes.sql`, que eleva o limite para 10. O alvo da migração continuará usando 10, conforme decisão explícita anterior do usuário; não será copiado cegamente o limite 6 da referência original.

### Limites desta auditoria

- Foram consultadas definições completas das funções do catálogo original, mas a resposta do conector excedeu o limite de saída e foi truncada. Ela não serve como exportação integral e verificável de todas as rotinas.
- O próximo passo técnico é extrair definições em lotes menores, filtrando as funções de música por nome e dependências, e registrar cada lote sem truncamento.
- Nenhum DDL, migration, grant, trigger, policy, função, bucket ou publicação foi alterado em qualquer banco.
