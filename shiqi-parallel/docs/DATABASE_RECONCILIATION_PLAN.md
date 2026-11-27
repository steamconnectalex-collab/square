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


## 10. Fechamento adicional da auditoria estrutural (26/11/2026)

Foram recuperados diretamente do catálogo original:
- 18 conjuntos de colunas com tipos, nulabilidade, defaults e identidade;
- constraints funcionais, PKs, FKs e regras ON DELETE;
- 18 policies RLS de tabelas públicas;
- grants efetivos de tabelas.

Resumo de segurança: as policies de aplicação são para `authenticated`; não há grants diretos de tabela para `anon` no inventário original. Leitura direta é concedida a `authenticated` apenas onde o frontend precisa, e mutations sensíveis são mediadas por RPCs e RLS. Tabelas internas de códigos, rate limit, convites, bans e MFA não têm policies públicas.

O conjunto de definições de funções (13 private/45 public), estrutura de colunas, constraints, policies e grants agora está recuperado para a referência original. Falta fechar índices, ACL explícita por função, detalhes finais de Storage/Realtime e a revisão das dependências internas do protótipo no destino. A auditoria não autoriza DDL; o plano reversível ainda precisa ser fechado e revisado antes de qualquer mudança remota.


## 11. Índices e ACLs (26/11/2026)

A auditoria recuperou todos os índices públicos das 18 tabelas-alvo e consultou ACLs explícitas de funções por assinatura com `aclexplode`. Isso evita confundir privilégios herdados de PUBLIC com GRANTs explícitos.

Diretriz para o destino: não reproduzir ACLs históricas amplas em helpers privados; revogar EXECUTE de PUBLIC/anon e conceder o mínimo necessário, garantindo execução de triggers, policies e RPCs chamadoras. Rotinas de backend devem ficar inacessíveis ao cliente autenticado. Os índices únicos funcionais e índices de consulta por canal/data, autor/data, threads, membership, convites, eventos, reações e rate limit precisam ser preservados.

O inventário estrutural do original está suficientemente recuperado para iniciar a montagem local do schema canônico. Isso não autoriza aplicação no projeto remoto. Antes, será documentado o plano reversível de isolamento das cinco tabelas do protótipo e será feita revisão estática das migrations geradas.


## 12. Plano reversível para isolar o protótipo paralelo (proposta técnica)

A estratégia de trabalho passa a ser preparar uma migration de preservação por renomeação, não conversão de tipos nem reaproveitamento de colunas incompatíveis. Isso continua sendo uma proposta local para revisão; **não foi executada**.

### Objetos a preservar

As cinco tabelas atuais serão mantidas com todos os dados, OIDs, FKs, índices, policies e triggers, mas retiradas dos nomes públicos usados pelo app:
- `profiles` → `legacy_profiles`
- `communities` → `legacy_communities`
- `community_members` → `legacy_community_members`
- `channels` → `legacy_channels`
- `messages` → `legacy_messages`

Antes da renomeação, a migration deverá:
1. Confirmar que os cinco objetos ainda existem, que não há colisão com nomes `legacy_*` e que as contagens continuam em zero.
2. Capturar em log os nomes/IDs das migrations remotas e os metadados dos objetos.
3. Interromper com erro se qualquer precondição divergir; não usar `DROP`, `TRUNCATE`, `CASCADE` nem conversão de coluna.
4. Renomear dentro de uma transação, sem remover constraints ou dados.

### Dependências que precisam ser tratadas na mesma janela

- O trigger de `auth.users` continua ativo, mas sua função `private.handle_new_user()` precisa ser substituída para inserir na nova `public.profiles` canônica com username válido e defaults corretos. Não criar usuários nem disparar e-mails de teste.
- Triggers e policies antigas permanecem ligados às tabelas renomeadas por dependência de objeto; os helpers do protótipo devem permanecer disponíveis para não quebrar essas estruturas enquanto o legado estiver arquivado.
- A publicação Realtime atual inclui o OID de `messages`; após renomear, esse OID passa a representar `legacy_messages`. A migration precisa remover o legado da publicação e adicionar a nova `public.messages`; também adicionar `friendships` e `voice_members`.
- Grants de `anon` e `authenticated` nas tabelas legadas devem ser revogados explicitamente após a renomeação. Manter RLS ligado; acesso administrativo fica restrito a `service_role`/owner.
- A API Data/PostgREST e os nomes de tabelas só serão considerados prontos após consulta de catálogo e teste de descoberta dos recursos.

### Reversão

A migration de corte deve ter um script de rollback separado e revisado:
1. Parar a integração de frontend e retornar o apontamento do app para o estado anterior, se já houver sido conectado.
2. Remover as novas tabelas canônicas apenas se estiverem comprovadamente sem dados e com autorização explícita; caso contrário, renomeá-las para um prefixo de quarentena.
3. Restaurar os nomes das cinco tabelas legadas e as permissões/publicação originais, restaurando também a função de trigger anterior do protótipo.
4. Validar policies, triggers, FKs, índices, grants e Realtime depois da reversão.

O rollback não será executado automaticamente nem será incluído como `DROP ... CASCADE`. O script final deverá ser revisado junto com o SQL de aplicação.

### Critério para liberar a migration

Só gerar a migration final depois de confirmar: inventário de dependências do destino, nomes de legado sem colisão, grants exatos, trigger Auth, Realtime, policies de legado e teste estático da reversão. Mesmo depois de pronta, nenhuma migration será aplicada ao Supabase sem aprovação específica do usuário.


## 13. Trigger de criação de perfil do destino — definição conferida

A função atual `private.handle_new_user()` no projeto paralelo foi lida integralmente. Ela:
- lê `username` e `display_name` de `new.raw_user_meta_data`;
- valida username com regex e tamanho diferentes do contrato canônico;
- tenta inserir `public.profiles(id, username, display_name)`;
- em caso de colisão, tenta inserir novamente com `username = NULL`.

Isso é incompatível com a tabela canônica original, que exige username NOT NULL e regex `^[a-z0-9._]{3,20}$`. Se apenas renomearmos a tabela antiga e criarmos a canônica, o gatilho atual continuará apontando para o novo nome `public.profiles` e poderá falhar na criação de novas contas, especialmente no fallback NULL. Portanto, a troca da função precisa ocorrer na mesma migration de corte e ser validada estaticamente com os contratos de cadastro; não criaremos usuários para testar nesta fase.

As outras funções privadas do protótipo (`add_community_owner`, `is_community_admin`, `is_community_member`, `set_updated_at`) são específicas das tabelas legadas. Devem permanecer preservadas com o legado, sem serem usadas como autorização das tabelas canônicas.

Nenhuma função ou trigger foi alterada remotamente.


## 14. Storage, Realtime e fluxo de criação de perfil

A configuração de Storage e Realtime foi revalidada diretamente no projeto original. O original possui buckets `avatars` e `attachments` com limites e MIME types documentados, e a publicação `supabase_realtime` inclui `friendships`, `messages`, `voice_members`.

Diferença importante descoberta: o projeto paralelo tem o trigger `on_auth_user_created_shiqi` em `auth.users` → `private.handle_new_user()`, mas a consulta ao catálogo original não encontrou trigger não interno em `auth.users`. Portanto, não se deve assumir que o trigger faz parte do contrato original. O fluxo de cadastro na Edge Function original deve ser inspecionado antes de decidir se o destino mantém, substitui ou remove esse trigger prototype.

O projeto paralelo está consultável no momento (PostgreSQL 17.12, cinco tabelas públicas, zero buckets e zero linhas nas cinco tabelas). Isso não equivale a autorização para alterar o banco.


## 15. Contrato real do signup — Edge Function original v9 (26/11/2026)

A função `auth` ativa no projeto original foi lida diretamente via API do Supabase (versão 9, ACTIVE, `verify_jwt=false`). O fluxo `signup`:
1. valida e normaliza email, username, senha, data de nascimento, idade mínima e aceite dos termos;
2. cria o usuário com `admin.auth.admin.createUser(... email_confirm:false ...)`;
3. insere explicitamente o perfil em `public.profiles` com `admin.from("profiles").insert(...)`;
4. se a inserção falha, apaga o usuário recém-criado e retorna erro;
5. gera e envia código de confirmação por email.

Portanto, o contrato original é **criação explícita de perfil pela Edge Function**, não trigger em `auth.users`. O trigger `on_auth_user_created_shiqi` do protótipo paralelo conflita diretamente com esse fluxo: dispara ao criar usuário, insere o perfil primeiro e faz o INSERT explícito subsequente falhar por chave duplicada. A migration canônica deverá remover o trigger prototype `on_auth_user_created_shiqi` e sua função exclusiva, sem criar trigger substituto. O signup existente continuará sendo a única fonte de criação do perfil, preservando a semântica original.

### Divergência de código-fonte
O arquivo versionado `supabase/functions/auth/index.ts` na branch consultada contém apenas 2.259 bytes e termina antes das rotas, enquanto a função ativa v9 no Supabase contém o código completo. Não sobrescrever nem publicar o arquivo incompleto. A reconciliação do código da Edge Function precisa ser feita na etapa de backend, recuperando a versão ativa completa e comparando com o repositório antes de qualquer deploy.

Nenhuma alteração remota foi executada.


## 16. DDL canônico das tabelas e índices recuperado (26/11/2026)

Foram gerados diretamente do catálogo original, em três lotes, os comandos `CREATE TABLE` das 18 tabelas-alvo, incluindo tipos, defaults, identity, NOT NULL, PKs, FKs, CHECKs e regras ON DELETE. Os arquivos de referência foram adicionados à branch:
- `docs/CANONICAL_TABLES.sql`
- `docs/CANONICAL_INDEXES.sql`

Os índices não-PK também foram extraídos por `pg_indexes` e registrados separadamente; os índices de PK já são criados pelas constraints. Os arquivos são **referências SQL**, não migrations prontas: precisam de revisão da ordem de dependências, integração com funções/RLS/grants, validação de sintaxe e inclusão no fluxo transacional com preflight/rollback. Não executar isoladamente.

Importante: a tabela `rate_hits` não tem PK, por decisão do schema original; não adicionar chave artificial sem evidência. `messages.id` usa identity ALWAYS bigint e as FKs de reações/tópicos dependem disso. A ordem das tabelas deve respeitar dependências: servers antes de channels; channels antes de messages/DM/voice; messages antes de reactions; server_events antes de event_interest.


## 17. Policies RLS exatas recuperadas

As definições completas de `pg_policies` foram extraídas em lotes e salvas em `docs/CANONICAL_RLS_POLICIES.sql`. O arquivo registra as 18 policies existentes (não uma policy por tabela): leitura e atualização de perfil, leitura de servidores/membros/canais, CRUD restrito de mensagens, leitura de amizades/bloqueios/DM/voz/fixados/reações/eventos/interesse.

As tabelas internas `email_codes`, `rate_hits`, `server_invites`, `server_bans` e `mfa_recovery` não têm policies públicas no original. Não adicionar policies genéricas para elas. Mutations nessas áreas devem continuar mediadas pelas RPCs/Edge Function privilegiadas.

O SQL de referência depende de helpers privados e RPC `public.is_server_member`; ele não é executável isoladamente. Antes de formar a migration final, as funções devem ser criadas antes das policies, e os grants devem ser aplicados com least privilege. A política de canal DM e mensagens deve ser validada com testes de usuário participante/não participante, incluindo DM em estado request.


## 18. Helpers privados, RPC de membership e triggers recuperados

Foram recuperados e salvos em arquivos SQL de referência:
- `docs/CANONICAL_PRIVATE_FUNCTIONS.sql`: 13 funções privadas completas, com corpos reais, assinatura, SECURITY DEFINER/STABLE, search_path e lógica.
- `docs/CANONICAL_TRIGGERS.sql`: `public.is_server_member(uuid)` e cinco triggers reais: validação de tópico, rate limit de mensagem, timestamp de edição, aceitação automática de solicitação DM ao responder e atualização de perfil.

### Dependências e ordem
1. Tabelas canônicas.
2. Helpers privados e `public.is_server_member`.
3. Triggers.
4. Policies RLS que chamam os helpers.
5. Grants/ACLs por assinatura.
Os triggers dependem de `messages`, `dm_members` e `profiles`; não criar antes das tabelas.

Os arquivos são referências reconstruídas do catálogo original, não migrations executáveis isoladamente. A auditoria agora tem os corpos de helpers privados e os triggers reais; faltam os corpos públicos das RPCs e a ACL/grants finais para produzir o pacote transacional completo.
