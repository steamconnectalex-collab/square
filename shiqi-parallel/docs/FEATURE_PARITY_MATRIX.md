# SHIQI — matriz funcional de paridade (primeira versão)

Data: 2026-11-26  
Branch: `shiqi-parallel-dev`  
Fonte de referência: cópia do frontend em `shiqi-parallel/apps/web/`, inventários `SCHEMA_DEPENDENCY_INVENTORY.md`, `REMOTE_SCHEMA_AUDIT.md`, `AUTH_CONTRACT_INVENTORY.md` e `COMPATIBILITY_AND_READINESS_AUDIT.md`.

## Objetivo e limites

Esta matriz não propõe novas funcionalidades. Ela registra o comportamento que já existe e que precisa ser preservado durante a migração. O frontend original é a referência de design e comportamento.

- Não alterar design, navegação, componentes, textos, espaçamentos ou interações sem autorização.
- Música está fora do escopo e não deve ser migrada.
- Login por QR está explicitamente fora desta atualização: não investigar, implementar, testar nem usar como critério de aceite. A existência de código legado na cópia não autoriza trabalhar nele.
- Não repetir o teste de voz com 10 participantes.
- Não alterar `main`, `site/`, `desktop/`, produção ou o Supabase original.
- Nenhuma migration ou Edge Function deve ser publicada no ambiente remoto sem revisão e autorização.

## Legenda de estado

- **No frontend**: a interface e a lógica cliente aparecem na cópia paralela.
- **Contrato conhecido**: a auditoria identificou tabela/RPC/regra no sistema original.
- **Bloqueado no paralelo**: o projeto Supabase paralelo ainda não tem estrutura/serviço compatível.
- **Pendente de prova**: falta teste de integração/regressão ou confirmação da operação real.
- **Fora do escopo**: decisão expressa do usuário.

## Matriz funcional

| Área | Comportamento existente a preservar | Dependências/contrato identificado | Situação da migração |
|---|---|---|---|
| Home pública | Landing page, navegação, chamadas para entrar e baixar o app | HTML gerado em `home.js`; páginas estáticas | No frontend; validar links e apresentação |
| Cadastro | E-mail, usuário, nome de exibição, senha, nascimento, marketing e aceite dos termos; validações e envio de código | Edge Function `/signup`, Auth, `profiles`, `email_codes`, rate limit | Contrato cliente identificado; backend paralelo é stub e está bloqueado |
| Verificação de e-mail | Código de seis caracteres, validade, reenvio e cooldown | `/verify`, `/resend`, `email_codes`, RPC `verify_email_code` | Bloqueado no paralelo |
| Login | E-mail ou usuário + senha; sessão, renovação e logout | `/login`, Supabase Auth, perfil e JWT | Bloqueado no paralelo |
| MFA | TOTP, códigos de recuperação, ativar/desativar e recuperação | `/login/totp`, `/mfa/recovery`, `/mfa/disable`, `mfa_recovery` | Contratos parcialmente documentados; backend paralelo bloqueado |
| Recuperação de senha | Solicitar código, reenviar e redefinir senha | `/forgot`, `/reset`, `email_codes`, revogação de sessões | Bloqueado no paralelo |
| Conta e e-mail | Trocar e-mail, senha, desativar e excluir conta; revogar sessões | Rotas de conta da função auth, Supabase Auth, `profiles`, storage e RPCs internas | A interface existe; backend e testes no paralelo pendentes |
| Perfil | Nome de usuário, nome de exibição, bio, status, cor/acento e avatar | `profiles`, RPC `change_username`, `profiles_full`, Storage `avatars` | Contrato original conhecido; schema paralelo incompatível |
| Presença | Online/ausente/ocupado/invisível e atualização de última atividade | `profiles.presence`, `last_seen`, RPC `set_my_presence` | Contrato conhecido; integração paralela pendente |
| Servidores | Criar, abrir, explorar públicos, entrar por convite, tornar público, fixar/favoritar e navegar | `servers`, `server_members`, `server_invites`, `server_pins`; RPCs de servidor | Bloqueado: tabelas equivalentes não existem no paralelo |
| Canais | Texto e voz, ordem, criação e navegação; canais DM | `channels` com `server_id` e `kind`; `create_channel` | Bloqueado: contrato atual paralelo usa campos diferentes |
| Membros e moderação | Lista de membros, expulsar, banir, listar banidos e desbanir | `server_members`, `server_bans`; RPCs `kick_member`, `ban_member`, `list_bans`, `unban_member` | Contrato original conhecido; backend paralelo pendente |
| Mensagens | Enviar, editar, apagar, histórico, paginação, não lidas, busca e menções | `messages` (ID bigint), RLS, triggers e limite 5/5s e 40/min | Bloqueado: tabela paralela tem ID UUID e colunas ausentes |
| Tempo real e digitação | Receber mensagens/alterações e indicador de digitação; reconexão/fallback | Supabase Realtime; publicação de `messages`; broadcast | Contrato conhecido; publicar/testar no paralelo pendente |
| Anexos | Enviar imagem, reduzir tamanho, legenda/alt e exibir anexo | `messages.attachment_path/attachment_alt`, Storage `attachments`, limite 3 MiB | Contrato conhecido; Storage e autorização no paralelo pendentes |
| Reações | Adicionar/remover emoji e exibir contagens | `message_reactions`, RPC `toggle_reaction(bigint,text)` | Bloqueado até schema de mensagens compatível |
| Tópicos/respostas | Criar e carregar respostas encadeadas e validar pai no mesmo canal | `messages.thread_of` bigint, trigger `check_thread_parent` | Bloqueado até schema compatível |
| Amigos | Enviar/aceitar/recusar/remover pedidos; notas e notificações | `friendships`, RPCs `send_friend_request`, `respond_friend_request`, `remove_friend` | Contrato conhecido; tabela ausente no paralelo |
| DMs | Abrir conversa, solicitações, aceitar/recusar e histórico privado | `channels` kind dm, `dm_members`, RPCs `open_dm`, `respond_dm_request` | Bloqueado: canal DM não suportado no schema paralelo atual |
| Bloqueios | Bloquear/desbloquear e impedir interação conforme regras atuais | `blocks`, RPCs `block_user`, `unblock_user`; regras DM | Tabela/RPC ausentes no paralelo |
| Voz | Entrar/sair, heartbeat, WebRTC P2P, mudo, ensurdecer, vídeo, tela e efeitos | `voice_members`, RPCs `voice_join/ping/leave/set_state`, Realtime privado | Contrato original conhecido; integração paralela pendente. Limite aprovado: 10 |
| Eventos | Criar, listar, excluir e marcar interesse | `server_events`, `event_interest`, RPCs `create_event`, `delete_event`, `toggle_event_interest` | SQL base de eventos incompleto; recuperar antes da migration |
| Configurações | Privacidade, DMs, amizade, notificações, voz/vídeo, aparência, acessibilidade, sistema, idioma e atividades | `profiles.settings`, `get_my_settings`, `save_my_settings`; preferências locais | Interface existe; validar quais opções persistem e quais são apenas locais |
| Loja e inventário | Loja, itens, editor/decoração de perfil, missões, pontos e Shiqi Plus | `loja.js`, `perfil.js`; parte do conteúdo aparenta ser estática/local; integrações de cobrança não comprovadas | Mapear comportamento atual; não inventar backend nem implementar pagamentos nesta etapa |
| GIFs e presentes | Ações e avisos de indisponibilidade existentes | UI indica “em breve”; serviço externo ainda não configurado | Preservar o estado atual; não implementar como nova funcionalidade |
| Notícias e jogos grátis | Cards/conteúdo na home/painel | Fonte atual e atualização real precisam ser verificadas | Pendente de classificar se é estático/demonstração; não ampliar escopo |
| Aplicativo para PC | Página de download e aplicativo Electron existente no projeto original | Diretório `desktop/` na raiz; cópia paralela não é o escopo atual de integração | Preservar; validar estratégia de apontamento só após site/backend estáveis |
| Termos e privacidade | Páginas legais e aceite no cadastro | `termos.html`, `privacidade.html`, `terms_accepted_at` | Arquivos existem; contato oficial e revisão jurídica são pendências de lançamento |
| QR login | Fluxo legado presente em arquivos da cópia | Não considerar dependência para esta atualização | **Fora do escopo por decisão do usuário** |
| Música | Player, playlists e favoritos legados | Tabelas/RPCs de música excluídas do escopo | **Fora do escopo por decisão do usuário** |

## Inventário técnico observado no frontend

### RPCs do app principal

`block_user`, `create_channel`, `create_event`, `create_invite`, `create_server`, `delete_event`, `join_public_server`, `join_server`, `list_bans`, `list_public_servers`, `open_dm`, `remove_friend`, `respond_dm_request`, `respond_friend_request`, `send_friend_request`, `set_my_presence`, `set_server_public`, `toggle_event_interest`, `toggle_reaction`, `unban_member`, `unblock_user`, `voice_join`, `voice_leave`, `voice_ping`, `voice_set_state`, além de `profiles_full`.

### RPCs das configurações

`get_my_settings`, `save_my_settings`, `change_username`, `my_age_group`, `unsubscribe_marketing`.

### Tabelas REST observadas no app principal

`blocks`, `channels`, `dm_members`, `event_interest`, `friendships`, `message_reactions`, `messages`, `profiles`, `server_events`, `server_members`, `servers`, `voice_members`.

### Contratos críticos já identificados

- `messages.id` e `thread_of` são bigint no original; não converter para UUID.
- Canais de DM usam `channels.server_id IS NULL` e `kind='dm'`.
- A tabela `profiles` está ligada a `auth.users`.
- `messages`, `friendships` e `voice_members` participam do Realtime original.
- Buckets originais: `avatars` (1 MiB) e `attachments` (3 MiB), com policies por pasta do usuário.
- A função original `voice_join` tem limite histórico de 6; o destino deve aplicar a exceção aprovada de 10, sem repetir o teste já feito pelo usuário.
- Funções SECURITY DEFINER e grants precisam de revisão individual; não copiar privilégios efetivos amplos automaticamente.

## Rotas de autenticação e conta observadas no cliente

Rotas de autenticação usadas pelo app principal:
- `/signup`, `/verify`, `/resend`, `/login`, `/login/totp`, `/forgot`, `/reset`.

Rotas de conta observadas nas configurações:
- `/email/change/request`, `/email/change/confirm`;
- `/mfa/recovery`, `/mfa/disable`;
- `/account/deactivate`, `/account/delete`.

Também há chamadas diretas ao Supabase Auth para fatores MFA, atualização do usuário e revogação de outras sessões. O contrato exato de cada resposta/erro precisa ser validado antes da implementação; esta lista não substitui os testes de contrato.

## Lista inicial de regressão a preparar

| Grupo | Verificações mínimas de comportamento |
|---|---|
| Acesso | Cadastro válido/inválido; e-mail/usuário duplicado; código correto/incorreto/expirado; cooldown; login correto/incorreto; sessão renovada; logout |
| MFA e conta | TOTP correto/incorreto; recuperação de uso único; troca de e-mail confirmada; senha redefinida; desativar e excluir com confirmação; revogar sessões |
| Perfil | Carregar/editar campos; avatar enviar/trocar/remover; validações; preferências de visibilidade |
| Servidores/canais | Criar; abrir; explorar; entrar por convite/público; permissões de dono/membro; criar canal; ordenação; fixar/favoritar |
| Mensagens | Enviar; receber; editar; apagar; paginação; histórico; busca; menções; não lidas; limites de envio |
| Segurança social | Pedido de amizade; aceitar/recusar/remover; abrir DM; solicitação de DM; bloquear/desbloquear; impedir acesso indevido |
| Anexos | Upload autorizado; usuário não pode gravar na pasta de outro; tamanho/MIME; carregar imagem e legenda |
| Reações/tópicos | Alternar reação; contagem; limites; responder no mesmo canal; rejeitar thread inválida |
| Voz | Entrar/sair; presença; mute/deafen; vídeo/tela; reconexão; autorização do canal privado; não repetir teste de 10 participantes |
| Eventos | Criar com limites; listar; interesse alternar; excluir com permissão correta |
| Configurações | Alterar preferência; persistir no navegador; sincronizar na conta; recarregar e confirmar estado; verificar opções sem efeito/“em breve” |
| Interface | Abrir/fechar modais; navegação desktop/mobile; foco e teclado; scroll; estados vazios/erro/carregamento; preservar layout e estilos |
| PC/legal | Link e instalador existente; abrir termos/privacidade; aceite do cadastro; validar URLs e identidade visual |

Os testes devem rodar contra mocks isolados primeiro e, depois, contra o Supabase paralelo com usuários de teste autorizados. Não criar usuários nem enviar e-mails reais sem autorização específica.

## Lacunas de validação desta matriz

1. A matriz foi montada por leitura estática do código e dos inventários existentes. Ainda não significa que cada botão/fluxo foi executado contra o backend paralelo.
2. O teste `tests/smoke.js` na raiz aponta para `../site` (site original), não para `shiqi-parallel/apps/web`. Precisamos criar/adaptar um harness de regressão isolado para a cópia paralela, sem alterar o teste original.
3. Ações de configurações com aviso “em breve”, conteúdos estáticos e recursos sem persistência precisam ser classificados por inspeção dos handlers antes de definir aceite.
4. O schema remoto paralelo tem somente `profiles`, `communities`, `community_members`, `channels`, `messages`, com contratos incompatíveis. Não conectar o app a esse schema antes do plano de compatibilidade.
5. Esta matriz deve ser revisada com as definições SQL completas e com os testes de contrato. Marcar item como concluído apenas após evidência verificável.

## Critério de aceite da etapa 1

A etapa 1 estará concluída quando:
- todas as telas e operações do frontend que permanecem no escopo estiverem mapeadas;
- cada operação estiver ligada a tabela/RPC/Storage/Realtime ou identificada claramente como local/estática;
- os itens sem backend ou com comportamento “em breve” estiverem explicitamente classificados;
- existir uma lista de testes de regressão correspondente;
- nenhuma tela ou funcionalidade tiver sido alterada nesta etapa.

## Complemento da inspeção dos módulos (26/11/2026)

Esta seção registra a leitura dos handlers dos módulos de configurações, perfil, loja, missões, Plus, download e orientação mobile. É inspeção estática do código da cópia paralela; não equivale a teste funcional em navegador ou contra serviços remotos.

### Configurações — persistência e efeitos observados

- settings.js mantém preferências por usuário em localStorage na chave sq.prefs.<uid>. Ao alterar opções, grava localmente imediatamente e tenta sincronizar após 900 ms com save_my_settings({p: prefs}); falha remota é silenciosa e mantém o navegador como fonte local.
- Na inicialização, get_my_settings() só substitui o estado local quando o objeto remoto tem _t mais recente. Preferências de tema também podem usar sq.theme.local e sq.theme.last, dependendo da opção de sincronização.
- Controles de alternância, rádio, seleção, faixa deslizante e abas alteram estado/preferências; faixa deslizante salva com atraso de 250 ms. Navegação entre páginas/subseções, modais, acordeões, pesquisa do menu e fechar/voltar são estados de interface.
- Efeitos locais incluem aplicação do tema, escala/densidade/contraste, redução de movimento, sons e prévia de fala via speechSynthesis. Permissão de notificações desktop depende da API do navegador.
- Preferências específicas por servidor (ex.: exceções de DM e compartilhamento de atividade) são guardadas dentro de prefs; não foi observado RPC dedicado para elas.
- A interface contém categorias de conta, privacidade, mensagens, notificações, cobrança, voz, aparência, acessibilidade, jogos/apps, desenvolvedor, idioma e sistema/atalhos.

### Conta e segurança nas configurações

- Alterar nome de usuário chama change_username(p_username); senha usa PUT /auth/v1/user.
- Troca de e-mail chama /email/change/request e /email/change/confirm, com código enviado ao novo endereço.
- MFA TOTP consulta /auth/v1/user e usa /auth/v1/factors para cadastrar, desafiar, verificar e excluir fator não verificado. Códigos de recuperação vêm de /mfa/recovery; desligar usa /mfa/disable.
- Encerrar outras sessões usa POST /auth/v1/logout?scope=others. Exportação de dados chama uma ação própria da interface; o corpo completo do handler ainda precisa ser mapeado e testado.
- my_age_group carrega a classificação etária; confirmação documental de idade é explicitamente indisponível. Configurar família, login por telefone, integrações externas e conexões de apps exibem aviso/placeholder.
- Marketing usa unsubscribe_marketing(). Configurações de cobrança, métodos de pagamento, histórico, Plus e impulsos não realizam transações: os handlers mostram indisponibilidade.
- Idioma permite selecionar apenas pt-BR; outras opções exibidas mostram aviso de que ainda não estão disponíveis.

### Perfil e personalização

- perfil.js salva nome exibido, status, bio e cor via SQ_API.saveProfile. Avatar é enviado/removido via SQ_API.uploadAvatar/removeAvatar; recorte e miniatura são processados localmente no navegador.
- Avatares recentes e widgets de perfil são guardados em localStorage por usuário. Lista de desejos do perfil lê a mesma chave sq.wish.<uid> usada pela loja.
- A prévia do Plus é explicitamente local e não salva. Insígnias, perfis por servidor, conexões, widgets completos, jogos e avatar GIF exibem “em breve”.
- O mapeamento exato de saveProfile/uploadAvatar/removeAvatar para tabela/campo/bucket deve ser confirmado no adapter SQ_API durante a próxima inspeção de app.js.

### Loja, pontos, missões e Plus

- loja.js declara no próprio cabeçalho que o catálogo é de exemplo, com arte CSS e nomes inventados; não há backend de catálogo/pagamentos.
- Lista de desejos persiste em localStorage por usuário. Busca, filtros, ordenação, paginação, alternância de abas, modal de item, carrosséis e prévia são estado local da interface.
- A ação de aceitar/cancelar missão só altera ST.qdone em memória e mostra aviso; não concede pontos nem persiste progresso.
- Comprar/resgatar itens, assinar/presentear Plus, pagamentos, lojas de jogos e compras de coleções exibem aviso de indisponibilidade. Não tratar valores, recompensas, datas promocionais ou catálogo como dados de negócio confirmados.
- Não criar integração de pagamento, carteira, inventário ou sistema de pontos nesta migração; preservar exatamente os placeholders atuais.

### Download e orientação mobile

- baixar.js identifica Windows/Linux/macOS/mobile pelo user-agent. Windows/Linux apontam para artefatos da página de releases externa shiqi-downloads; Mac ainda aparece como “em breve”; celular orienta a usar o site.
- mobile.js acrescenta uma dica de uso no desktop e a dispensa apenas na sessão (sessionStorage). Não há backend.
- home.js é uma landing page estática, sem chamadas de backend identificadas nesta inspeção; seus links e botões precisam ser cruzados com index.html e o roteamento do app para registrar destinos e estados.

### Itens ainda não fechados nesta etapa

1. Cruzar cada ação de settings-pages.js e settings-pages2.js com os defaults e efeitos efetivos de settings.js, incluindo opções sem implementação.
2. Completar o mapeamento de app.js por grupos de handlers e eventos, sem entrar no código de QR nem nos recursos de música.
3. Inspecionar index.html, rotas legais e CSS de navegação para confirmar telas, pontos de entrada e comportamento desktop/mobile sem alterar a interface.
4. Classificar a página inicial e os conteúdos promocionais como estáticos, demonstrativos ou dinâmicos com base nos handlers reais.
5. Construir o roteiro/harness de regressão isolado da cópia paralela. O teste raiz não deve ser alterado nem usado como evidência da cópia paralela.
## Complemento da inspeção do app principal (26/11/2026)

### Inicialização, navegação e sessão
- app.js mantém sessão/token e pequenos estados auxiliares no armazenamento do navegador; renova token pelo endpoint Supabase Auth refresh_token, carrega perfil por REST e encerra sessão com /auth/v1/logout?scope=local.
- Rotas de hash observadas para home, cadastro, verificação, login, recuperação, redefinição e app. A rota QR aparece no código legado, mas permanece totalmente fora desta análise/escopo por decisão do usuário.
- O estado principal do app é inicializado após autenticação; timers de polling, heartbeat, digitação/Realtime e voz são interrompidos no encerramento/troca de estado.

### Carregamento de dados e presença
- loadWorld() lê servidores, canais, membros, amizades, canais DM, participantes DM, bloqueios e perfis; usa profiles_full como complemento de perfil. A leitura pressupõe as tabelas/RPCs do schema original.
- Presença atualiza profiles.last_seen por REST e status por set_my_presence(). Favoritos de servidores ficam em localStorage (sq.favsrv.<uid>), não no banco.
- Eventos próximos são consultados em server_events e event_interest. A lista de eventos de cada servidor lê até 25 registros futuros e seus interesses.

### Mensagens, anexos, reações e tópicos
- Histórico principal lê messages com paginação de 50; novas mensagens/alterações são recebidas por polling de fallback e canal WebSocket Realtime. Mensagens antigas são carregadas por id; respostas usam thread_of e consulta separada.
- Enviar mensagem grava em messages; editar/apagar usa PATCH/DELETE em messages; respostas em tópico criam linha em messages com thread_of. O modelo requer id bigint, thread_of bigint e campos de anexo compatíveis.
- Reações carregam message_reactions e alternam via toggle_reaction(p_message bigint, p_emoji).
- Busca consulta messages por conteúdo e canal (ou conjunto de DMs conforme preferência); painel de menções consulta mensagens que contêm @username. Abrir resultado navega para canal/DM.
- Upload de imagem usa Storage REST; o adapter e a chamada de upload devem ser relacionados às policies do bucket attachments e aos campos attachment_path/attachment_alt na matriz de anexos. Exibir imagem/clicar para abrir é ação local.
- Spoiler, mostrar imagem, copiar ID, escolher emoji/figurinha, abrir/fechar painel e mostrar mensagem filtrada são estados/ações locais; GIFs, presentes e apps continuam placeholders sem backend.

### Servidores, canais, convites e moderação
- Criar servidor chama create_server; marcar público chama set_server_public; explorar lê list_public_servers e entrar chama join_public_server. Entrar por código chama join_server.
- Criar canal chama create_channel(p_server,p_name,p_kind); convites chamam create_invite. Favoritos de servidor permanecem locais.
- Lista de membros usa server_members/perfis. Expulsar/banir chama kick_member/ban_member; lista de banidos usa list_bans; desbanir usa unban_member.
- Ações de dono, limites e permissões são responsabilidade das RPCs/RLS do banco; não substituir por validação apenas no frontend.

### Amigos, DMs e bloqueios
- Solicitação/aceite/recusa/remoção de amizade usa send_friend_request, respond_friend_request e remove_friend. Abrir conversa chama open_dm; solicitação de DM usa respond_dm_request.
- Bloquear/desbloquear usa block_user/unblock_user. Os painéis e cartões de perfil são apresentação local do estado obtido do backend.

### Eventos e voz
- Eventos: listar via REST server_events/event_interest; criar via create_event; marcar interesse via toggle_event_interest; excluir via delete_event.
- Voz lê voice_members; entrada/saída/heartbeat/estado usam voice_join, voice_leave, voice_ping e voice_set_state. Áudio, sinalização WebRTC, câmera/compartilhamento de tela e efeitos são executados no navegador; o estado compartilhado de participantes depende do backend/Realtime.
- A UI inclui controle de câmera e tela; não assumir funcionamento real no destino até validar permissões, sinalização e contratos. Não repetir o teste de 10 participantes já realizado pelo usuário.

### Modais, navegação e estados locais
- Ações de navegação entre home/amigos/servidores/loja/missões/Plus, menus, modais, tabs, expandir/recolher, busca rápida, scroll e foco são estados do cliente.
- A matriz agora identifica o vínculo principal entre as operações e tabelas/RPCs. Ainda é necessário revisar o bloco de eventos de clique e as rotas do HTML para confirmar todos os botões, campos e caminhos de erro sem examinar QR nem reintroduzir música.

### Nota de segurança da migração
- O app principal faz chamadas REST diretas e RPCs com token do usuário; preservar RLS e permissões no banco é essencial. Não mover privilégios de escrita para cliente anônimo nem confiar apenas em esconder botões.
- Nenhuma chamada foi executada contra o banco nesta inspeção; os vínculos acima foram lidos estaticamente do código. A compatibilidade do schema paralelo continua bloqueando integração e testes reais.
## Fechamento da etapa 1 — rotas, ações e critérios de regressão (26/11/2026)

### Pontos de entrada e carregamento
- index.html carrega os estilos style.css, settings.css, shell.css, loja.css e perfil.css; scripts config.js, qr.js, home.js, settings.js, settings-pages.js, settings-pages2.js, mobile.js, loja.js, perfil.js e app.js, nesta ordem. A presença do script QR é legado e não o inclui no escopo de trabalho.
- O app de uma página usa hash para home, cadastro, verificação, login, recuperação, redefinição e app autenticado. O bootstrap restaura a sessão local, renova token se necessário, carrega perfil e resolve a rota.
- Páginas independentes: /baixar, /termos e /privacidade. A página de download seleciona instruções/artefato por sistema operacional; Termos e Privacidade têm links de retorno e cruzados. O cadastro liga o aceite dos documentos ao fluxo de conta.
- Home pública é HTML gerado e conteúdo estático. Os cards de notícias/jogos vistos em módulos antigos não são tratados como fonte de dados nem como nova integração; o produto atual preserva o conteúdo que o frontend efetivamente apresenta.

### Eventos e ações de interface mapeados
- app.js delega cliques por data-act; entradas de formulário e preferências usam eventos input/change/submit com atributos data-app-bind e data-pv. Ações são classificadas como: navegação/estado local; operação de backend; integração com API do navegador (mídia, fullscreen, notificações, clipboard); ou aviso “em breve”.
- Casca autenticada: trilho de servidores, navegação de amigos/DMs/oficial/Loja/Missões/Plus, lista de servidores/canais, recolher seções, menu do servidor, convites, busca rápida, painéis de membros/menções/busca, modais e toast.
- Mensagens: campo de composição, envio por botão/Enter, emoji/figurinhas existentes, upload de imagem, respostas em tópico, reações, editar/apagar, histórico anterior, busca, menções, não lidas e navegação ao resultado. GIFs e presentes permanecem avisos de indisponibilidade.
- Voz: entrar/voltar/sair, convite/aviso para canal de texto, mudo, ensurdecer, PTT com Ctrl direito, câmera, compartilhamento de tela, fullscreen, dispositivos, volumes, sensibilidade, efeitos e preferências. WebRTC e permissões são capacidades do navegador; voice_members/RPC/Realtime guardam presença e sinalização.
- Social e comunidade: cartão de perfil, adicionar/aceitar/recusar/remover amigo, abrir DM, aceitar/recusar solicitação de DM, bloquear/desbloquear, criar/abrir servidor, explorar/entrar público, criar canais, criar convite, listar/expulsar/banir/desbanir membros, criar/listar/excluir evento e marcar interesse.
- Configurações: categorias/subpáginas, busca, abas, acordeões, toggles, radios, selects, sliders, reset e preview. Preferências comuns usam localStorage com sincronização RPC; ações de conta/MFA usam RPC, Supabase Auth ou endpoints da Edge Function; itens sem implementação exibem aviso/placeholder.
- Perfil: abrir/fechar editor, alterar nome/status/bio/acento, selecionar/recortar/girar/posicionar avatar, enviar/remover, histórico recente local, lista de desejos e prévias; elementos ainda indisponíveis mantêm seus avisos.
- Loja/Missões/Plus: navegação, filtros, pesquisa, ordenação, páginas, wishlist, detalhes e prévias locais; comprar, resgatar, pontos, missões e assinatura não geram transação ou persistência comercial no estado atual.
- Download e orientação: seleção por user-agent, link de release, retorno à home, aviso desktop/mobile dispensável por sessionStorage.

### Contrato de perfil e arquivos confirmado
- SQ_API.saveProfile faz PATCH em profiles filtrando pelo ID do usuário e recarrega o mundo. Campos enviados pelo editor: display_name, status_text, bio e accent.
- SQ_API.uploadAvatar envia JPEG ao bucket avatars em caminho <user_id>/<timestamp>.jpg; após upload remove o avatar anterior quando aplicável. SQ_API.removeAvatar remove o objeto atual e limpa avatar_path no perfil. A imagem é recortada no cliente para 256×256 antes do upload.
- O upload de anexos de mensagem usa bucket attachments, grava caminho em messages.attachment_path e legenda alternativa em attachment_alt; acesso deve continuar limitado por RLS/storage policy.
- A interface de configurações de exportação/encerramento/exclusão tem handlers de conta. A validação de ponta a ponta depende do contrato Edge Function e Auth, não deve ser inferida apenas pelo texto do botão.

### Aceite e fronteira de testes
- Critério da etapa 1 satisfeito por inspeção estática: todas as telas de entrada, áreas funcionais e famílias de ação da cópia paralela foram inventariadas; operações foram associadas a REST/RPC/Storage/Realtime, APIs do navegador, armazenamento local, conteúdo estático ou placeholder.
- A lista de regressão por grupos já consta acima e será convertida em testes automatizados na etapa de testes. O smoke test existente na raiz aponta para ../site e contém mocks/fluxos legados; ele não é evidência de paridade da cópia paralela e não será executado/alterado para esta migração.
- Não foi feito teste funcional real nesta etapa: o Supabase paralelo ainda tem schema incompatível e a autenticação paralela permanece stub. A etapa 1 encerra o levantamento, não declara a migração funcional.
- Nenhuma tela, CSS, JS de produto, banco remoto, usuário, e-mail, Edge Function, deploy, domínio ou branch main foi alterado.

## Atualização de estado — 2026-11-28

> Esta seção supersede os estados antigos da primeira versão da matriz quando houver divergência. As seções anteriores permanecem como histórico do levantamento inicial.

### Backend paralelo e evidências atuais
- **Banco:** cutover canônico já aplicado no projeto Supabase paralelo `ujdosskjycrdkcgsswfa`. Auditoria de runtime confirmou 23/23 tabelas do schema `public` com RLS habilitado; cinco tabelas internas sem policies continuam sem grants diretos para `anon`/`authenticated`, portanto não devem receber policies genéricas.
- **Auth:** Edge Function `auth` está ativa no projeto paralelo, agora versão 2. O cadastro real com e-mail e o login foram confirmados pelo usuário em sessão anterior. A versão 2 publicada contém configuração própria do paralelo e limpeza paginada do Storage na exclusão de conta. A checagem de health após a versão 2 ainda não foi executada por chamada HTTP nesta sessão.
- **Rust:** serviço `shiqi-core` está publicado no Railway paralelo; `/healthz` e `/readyz` já responderam `ready`. O frontend chama `/v1/me`, mas a confirmação com JWT real permanece pendente; não declarar identidade validada até haver evidência. O upload de imagem pelo Rust está implementado no cliente/serviço, mas o upload real continua adiado.
- **RPCs:** teste estático independente encontrou 30 nomes de RPC chamados pelos módulos web e confirmou que todos têm definição nos SQLs canônicos. Isso prova existência nominal, não assinatura/retorno em execução.
- **RLS/ACL:** auditoria remota confirmou 45 funções SECURITY DEFINER no schema `public`, todas com `search_path` vazio; 39 são executáveis por `authenticated`, nenhuma por `anon`. A autorização de cada função continua sujeita à revisão individual e aos testes A-vs-B.
- **Realtime:** publicação contém `friendships`, `messages` e `voice_members`; tópicos privados de voz usam policies específicas. Testes cruzados com duas contas reais ainda pendentes.

### Recursos preservados como placeholders
- Loja, pontos, missões, inventário, compras, resgates, assinatura Shiqi Plus, cobrança e pagamentos continuam sendo interface demonstrativa/local ou avisos de indisponibilidade. Não há integração comercial/transacional comprovada; não inventar persistência ou pagamentos.
- GIFs e presentes continuam “em breve”. Música e QR permanecem fora do escopo, sem investigação ou testes específicos.
- Não repetir o teste de voz com 10 participantes já realizado. Testes adicionais de voz devem focar autorização e sinalização, não repetir essa carga.

### Bloqueios de segurança e validação ainda abertos
- **MFA/AAL2:** a interface/Edge Function oferece TOTP, mas a auditoria dos SQLs canônicos não encontrou políticas RLS restritivas nem guards nas RPCs SECURITY DEFINER que exijam `aal2` para usuários com fator verificado. O banco atualmente tem zero fatores MFA verificados; ainda assim, isso precisa ser resolvido antes de considerar MFA resistente a chamadas diretas ao Supabase.
- **Duas identidades:** o projeto tem uma única conta Auth. A regressão A-vs-B, isolamento de DMs e autorização cruzada completa continuam sem evidência real. Não criar usuários diretamente em `auth.users`.
- **Upload real:** adiado conforme decisão anterior; somente contrato e mocks podem ser validados nesta fase.
- **Vercel:** os deployments recentes foram bloqueados por `build-rate-limit`. O último preview READY conhecido é do commit `813cf1e287fc82fcf0dea8000d6834117ff7b3d9`; não contornar o limite. O frontend não teve alterações funcionais após esse preview, mas a publicação atual da branch ainda precisa ser renovada quando o limite permitir.
- **CI:** o workflow foi ampliado para Deno check, sintaxe de todos os módulos web, paridade RPC/SQL e Playwright. A rodada anterior `46101145360` foi SUCCESS; o resultado da nova rodada com Playwright ainda precisa ser confirmado separadamente.

### Novo harness de regressão
- `tests/frontend-sql-contract.js` valida nomes de RPC entre frontend e SQL canônico.
- `tests/smoke.js` dentro de `shiqi-parallel/tests` roda a cópia paralela com Supabase/Rust simulados; não modifica nem substitui o teste original da raiz. A seção QR foi removida e falhas agora encerram o processo com código diferente de zero.
- O smoke com mocks não substitui os testes reais de Auth/JWT, Storage, RLS e Realtime.
