'use strict';

// Testes estáticos do contrato Auth da cópia paralela SHIQI.
// Não substituem testes de runtime contra Supabase Auth/Postgres.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const count = (value, token) => value.split(token).length - 1;

const auth = read('supabase/functions/auth/index.ts');
const ui = read('apps/web/settings-pages.js');
const tablesSql = read('docs/CANONICAL_TABLES.sql');
const authRpcSql = read('docs/CANONICAL_AUTH_ACCOUNT_RPCS.sql');
const socialRpcSql = read('docs/CANONICAL_SOCIAL_PROFILE_RPCS.sql');
const serverRpcSql = read('docs/CANONICAL_SERVER_RPCS.sql');
const triggersSql = read('docs/CANONICAL_TRIGGERS.sql');
const moderationRpcSql = read('docs/CANONICAL_MODERATION_EVENTS_VOICE_RPCS.sql');
const privateSql = read('docs/CANONICAL_PRIVATE_FUNCTIONS.sql');
const aclSql = read('docs/CANONICAL_FUNCTION_ACL.sql');
const draftSql = read('docs/CUTOVER_DRAFT.sql');
const storageBucketSql = read('docs/CANONICAL_STORAGE_BUCKETS.sql');
const storagePolicySql = read('docs/CANONICAL_STORAGE_POLICIES.sql');
const appSql = read('apps/web/app.js');
const realtimeSql = read('docs/CANONICAL_REALTIME.sql');
const preflightSql = read('docs/CUTOVER_PREFLIGHT.sql');
const snapshotSql = read('docs/CUTOVER_SNAPSHOT.sql');
const rlsSql = read('docs/CANONICAL_RLS_POLICIES.sql');

const routes = [
  '/signup', '/verify', '/resend', '/login', '/login/totp', '/forgot', '/reset',
  '/email/change/request', '/email/change/confirm', '/account/deactivate',
  '/account/delete', '/mfa/recovery', '/mfa/disable',
];
for (const route of routes) {
  assert.ok(auth.includes('case "' + route + '":') || auth.includes("case '" + route + "':"), 'Rota ausente: ' + route);
}

assert.ok(auth.includes('Deno.serve('), 'Servidor HTTP da Edge Function ausente.');
assert.ok(auth.includes('if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY)'), 'Validação dos secrets ausente.');
assert.ok(!auth.includes('https://shiqi.com.br') && !auth.includes('square-chat-silk') &&
  !auth.includes('square-chat-steamconnectalex'), 'Origem antiga de produção encontrada.');

const sql = [authRpcSql, socialRpcSql, serverRpcSql, moderationRpcSql, privateSql].join('\n');
for (const table of ['profiles', 'email_codes', 'mfa_recovery']) {
  assert.ok(tablesSql.includes('create table public.' + table), 'Tabela SQL ausente: ' + table);
  assert.ok(auth.includes('.from("' + table + '")') || auth.includes(".from('" + table + "')"),
    'Tabela não referenciada no backend: ' + table);
}
for (const rpc of [
  'rate_check', 'get_auth_user_by_email', 'verify_email_code',
  'get_login_email_by_username', 'revoke_user_sessions', 'purge_user_data',
]) {
  assert.ok(sql.toLowerCase().includes('function public.' + rpc + '('), 'Definição SQL ausente: ' + rpc);
  assert.ok(auth.includes('.rpc("' + rpc + '"') || auth.includes(".rpc('" + rpc + "'"),
    'Chamada RPC ausente: ' + rpc);
}

const memberHelperStart = triggersSql.toLowerCase().indexOf('function public.is_server_member(');
const memberHelper = triggersSql.slice(memberHelperStart).toLowerCase();
assert.ok(memberHelper.includes('security definer') && memberHelper.includes("set search_path to ''"),
  'Helper is_server_member precisa de SECURITY DEFINER e search_path vazio.');
assert.equal(count(tablesSql, 'create table public.'), 18, 'Contagem inesperada de tabelas.');
assert.equal(count(rlsSql, 'enable row level security'), 18, 'Todas as tabelas devem ter RLS.');
assert.equal(count(rlsSql, 'create policy '), 17, 'Contagem inesperada de policies.');
assert.equal(count(aclSql.toLowerCase(), 'revoke execute on function '), 59, 'A ACL deve revogar as 59 assinaturas.');
const attachmentHelper = privateSql.slice(
  privateSql.indexOf('function private.can_read_attachment('),
  privateSql.indexOf('create or replace function private.messages_rate_limit')
);
const draftAttachmentHelper = draftSql.slice(
  draftSql.indexOf('function private.can_read_attachment('),
  draftSql.indexOf('create or replace function private.messages_rate_limit')
);
assert.ok(draftAttachmentHelper.includes('m.attachment_path = p_path') &&
  draftAttachmentHelper.includes("split_part(p_path, '/', 1) = m.author_id::text"),
  'O cutover draft deve incluir o helper e validar o autor do anexo.');
assert.equal(count(draftSql.toLowerCase(), 'revoke execute on function '), 59,
  'O cutover draft deve revogar as 59 assinaturas.');
assert.ok(draftSql.includes('GRANT EXECUTE ON FUNCTION private.can_read_attachment(text) TO authenticated;'),
  'O cutover draft deve conceder o helper somente ao papel autenticado.');
assert.ok(attachmentHelper.includes('m.attachment_path = p_path') &&
  attachmentHelper.includes("split_part(p_path, '/', 1) = m.author_id::text"),
  'A leitura de anexos deve corresponder a um caminho realmente associado a uma mensagem.');
assert.ok(attachmentHelper.includes("mine.state = 'active'") && attachmentHelper.includes('private.dm_allowed'),
  'A leitura de anexos em DM deve exigir membro ativo e respeitar bloqueios/regras de DM.');
const channelMemberHelper = privateSql.slice(
  privateSql.indexOf('function private.is_channel_member('),
  privateSql.indexOf('create or replace function private.is_channel_owner')
);
const dmMemberHelper = privateSql.slice(
  privateSql.indexOf('function private.is_dm_member('),
  privateSql.indexOf('create or replace function private.can_read_attachment')
);
assert.ok(channelMemberHelper.includes('private.dm_allowed') && dmMemberHelper.includes('private.dm_allowed'),
  'Leitura de canais/mensagens e seleção de DMs deve respeitar bloqueios e elegibilidade de DM.');
assert.ok(attachmentHelper.includes('private.dm_allowed') &&
  attachmentHelper.includes("m.author_id = (select auth.uid()) or other_member.state = 'active'"),
  'Anexos de DM devem respeitar bloqueios e manter a prévia pendente apenas para o remetente.');
assert.ok(attachmentHelper.includes('sm.user_id = (select auth.uid())'),
  'A leitura de anexos de servidor deve exigir associação atual.');
assert.ok(storageBucketSql.includes("'attachments', 'attachments', false") &&
  storageBucketSql.includes("'avatars', 'avatars', true"),
  'Attachments deve ser privado e avatars deve continuar público.');
assert.ok(draftSql.includes("'attachments', 'attachments', false") &&
  draftSql.includes("'avatars', 'avatars', true"),
  'O draft deve preservar os modelos de privacidade dos buckets.');
assert.equal(count(rlsSql, "split_part(attachment_path, '/', 1) = (select auth.uid())::text"), 2,
  'INSERT e UPDATE de mensagens devem validar a pasta do autor.');
assert.equal(count(draftSql, "split_part(attachment_path, '/', 1) = (select auth.uid())::text"), 2,
  'INSERT e UPDATE do cutover devem validar a pasta do autor.');
assert.ok(rlsSql.includes("split_part(attachment_path, '/', 1) = (select auth.uid())::text") &&
  draftSql.includes("split_part(attachment_path, '/', 1) = (select auth.uid())::text"),
  'A mensagem só pode referenciar anexo dentro da pasta do próprio autor.');
assert.ok(storagePolicySql.includes('private.can_read_attachment(name)') &&
  !storagePolicySql.includes('CREATE POLICY attachments_select_own'),
  'A policy de leitura deve autorizar pelo acesso à mensagem, não pelo dono da pasta.');
assert.ok(realtimeSql.includes('CREATE POLICY voice_topic_select ON realtime.messages') &&
  realtimeSql.includes('CREATE POLICY voice_topic_insert ON realtime.messages') &&
  realtimeSql.includes('private.can_voice_topic'),
  'Realtime de voz deve ter policies privadas de SELECT e INSERT.');
assert.ok(draftSql.includes('CREATE POLICY attachments_select_message_member ON storage.objects') && !draftSql.includes('CREATE POLICY attachments_select_own'),
  'O draft não deve manter a policy antiga de leitura por dono da pasta.');
assert.ok(draftSql.includes('CREATE POLICY voice_topic_select ON realtime.messages') &&
  draftSql.includes('CREATE POLICY voice_topic_insert ON realtime.messages'),
  'O cutover draft deve instalar as policies privadas de voz.');
assert.ok(snapshotSql.includes("WHERE schemaname='realtime' AND tablename='messages'") &&
  snapshotSql.includes('policyname, permissive, roles, cmd, qual, with_check'),
  'O snapshot de rollback deve capturar as policies de realtime.messages.');
assert.ok(preflightSql.includes('realtime_voice_policy_names_free') &&
  draftSql.includes("n.nspname='realtime' AND c.relname='messages'"),
  'Preflight deve bloquear colisões nas policies de voz do Realtime.');
assert.ok(preflightSql.includes("'can_read_attachment'") &&
  draftSql.includes("'can_read_attachment'"),
  'Preflight deve detectar colisão do helper de anexos.');
assert.ok(appSql.includes('scheduleAttachmentRefresh') && appSql.includes('expiresAt <= now + 10000'),
  'O frontend deve renovar signed URLs antes da expiração.');
assert.ok(appSql.includes('/storage/v1/object/sign/attachments/') &&
  appSql.includes('expiresIn: 60') &&
  !appSql.includes('/storage/v1/object/public/attachments/'),
  'O frontend deve usar signed URLs curtas, sem URL pública.');
const sharesHelper = privateSql.slice(
  privateSql.indexOf('function private.shares_server_with('),
  privateSql.indexOf('create or replace function private.touch_edited_at')
);
assert.ok(sharesHelper.includes("f.status = 'accepted'"),
  'shares_server_with deve ignorar solicitações de amizade pendentes.');
const draftSharesHelper = draftSql.slice(
  draftSql.indexOf('function private.shares_server_with('),
  draftSql.indexOf('create or replace function private.touch_edited_at')
);
assert.ok(draftSharesHelper.includes("f.status = 'accepted'"),
  'O cutover draft deve preservar a proteção contra amizades pendentes.');
const voiceStart = moderationRpcSql.toLowerCase().indexOf('function public.voice_join(');
const voiceEnd = moderationRpcSql.toLowerCase().indexOf('function public.voice_leave()', voiceStart);
const voiceJoinSql = moderationRpcSql.slice(voiceStart, voiceEnd);
const draftVoiceStart = draftSql.toLowerCase().indexOf('function public.voice_join(');
const draftVoiceEnd = draftSql.toLowerCase().indexOf('function public.voice_leave()', draftVoiceStart);
const draftVoiceJoinSql = draftSql.slice(draftVoiceStart, draftVoiceEnd);
for (const [label, fn] of [['RPC canônica', voiceJoinSql], ['cutover draft', draftVoiceJoinSql]]) {
  assert.ok(fn.includes("pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:voice:user:' || uid::text, 0))"),
    label + ': voice_join deve serializar entradas simultâneas do mesmo usuário.');
  assert.ok(fn.includes("pg_advisory_xact_lock(pg_catalog.hashtextextended('shiqi:voice:channel:' || p_channel::text, 0))"),
    label + ': voice_join deve serializar a contagem de vagas da sala.');
  assert.ok(fn.includes('if n >= 10 then raise exception \'voice_full\'; end if;'),
    label + ': limite de 10 participantes deve permanecer ativo.');
}

const lockChecks = [
  [privateSql, "shiqi:messages:rate:", 'Rate limit de mensagens deve ser serializado por autor.'],
  [draftSql, "shiqi:messages:rate:", 'O draft deve serializar rate limit de mensagens.'],
  [serverRpcSql, "shiqi:server:create:", 'Criação de servidores deve serializar o limite por proprietário.'],
  [draftSql, "shiqi:server:create:", 'O draft deve serializar criação de servidores.'],
  [draftSql, "shiqi:channel:create:", 'O draft deve serializar criação de canais.'],
  [draftSql, "shiqi:block:limit:", 'O draft deve serializar o limite de bloqueios.'],
  [draftSql, "shiqi:friend-request:limit:", 'O draft deve serializar solicitações de amizade.'],
  [draftSql, "shiqi:event:create:", 'O draft deve serializar criação de eventos.'],
  [draftSql, "shiqi:pins:limit:", 'O draft deve serializar pins.'],
  [draftSql, "shiqi:reaction:message:", 'O draft deve serializar reações.'],

  [serverRpcSql, "shiqi:channel:create:", 'Criação de canais deve serializar o limite por servidor.'],
  [serverRpcSql, "shiqi:membership:limit:", 'Entradas em servidores devem serializar o limite por usuário.'],
  [draftSql, "shiqi:membership:limit:", 'O draft deve serializar o limite de membros por usuário.'],
  [socialRpcSql, "shiqi:block:limit:", 'Limite de bloqueios deve ser serializado por usuário.'],
  [socialRpcSql, "shiqi:friend-request:limit:", 'Limite de solicitações de amizade deve ser serializado por usuário.'],
  [moderationRpcSql, "shiqi:event:create:", 'Limite de eventos deve ser serializado por servidor.'],
  [moderationRpcSql, "shiqi:pins:limit:", 'Limite de servidores fixados deve ser serializado por usuário.'],
  [moderationRpcSql, "shiqi:reaction:message:", 'Limite de reações deve ser serializado por mensagem.'],
  [moderationRpcSql, 'shiqi:event-interest:', 'Alternância de interesse em evento deve ser serializada por usuário/evento.'],
  [draftSql, 'shiqi:event-interest:', 'O draft deve serializar interesse em eventos.'],
  [authRpcSql, "shiqi:rate:", 'Rate check de Auth deve ser serializado por chave.'],
  [draftSql, "shiqi:rate:", 'O draft deve serializar rate check de Auth.'],
];
for (const [source, lock, message] of lockChecks) assert.ok(source.includes(lock), message);

assert.ok(auth.includes('factorError') && auth.includes('clearError'), 'Erros de operação MFA não estão sendo verificados.');
assert.ok(auth.includes('s = await mintSession(email)'), 'Recuperação MFA deve emitir sessão nova após excluir o fator.');
assert.ok(ui.includes('api().logout(); // o Supabase encerra as sessões'),
  'A interface deve encerrar a sessão local após desligar MFA.');

const cleanupStart = auth.indexOf('async function removeUserStorageObjects(');
const deleteStart = auth.indexOf('async function accountDelete(');
const deleteEnd = auth.indexOf('// gera 8 códigos de recuperação', deleteStart);
const cleanup = auth.slice(cleanupStart, deleteStart);
const deleteAccount = auth.slice(deleteStart, deleteEnd);
assert.ok(cleanupStart >= 0 && cleanup.includes('.list(prefix,') &&
  cleanup.includes('limit: 1000') && cleanup.includes('offset,'),
  'A limpeza de Storage deve paginar a listagem de arquivos.');
assert.ok(cleanup.includes('if (entry.id === null) await visit('),
  'A limpeza de Storage deve percorrer subpastas.');
assert.ok(cleanup.includes('paths.slice(i, i + 1000)') &&
  cleanup.includes('.remove('),
  'A limpeza de Storage deve remover em lotes de no máximo 1.000 objetos.');
assert.ok(cleanup.includes('if (error)') &&
  cleanup.includes('storage_cleanup_failed'),
  'Falhas de listagem/remoção de Storage devem interromper a exclusão da conta.');
assert.ok(deleteAccount.indexOf('removeUserStorageObjects(') < deleteAccount.indexOf('purge_user_data') &&
  deleteAccount.indexOf('purge_user_data') < deleteAccount.indexOf('deleteUser('),
  'A conta só deve ser purgada e removida depois da limpeza de Storage.');

assert.ok(auth.includes('const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });') &&
  auth.includes('if (error) throw new HttpError(503, "mfa_unavailable"'),
  'Falha ao consultar fatores MFA deve bloquear o login (fail closed).');
assert.ok(auth.includes('const { error: lastError }') &&
  auth.includes('if (lastError) throw new HttpError(503, "code_unavailable"'),
  'Falha ao consultar cooldown não pode liberar envio de códigos.');
assert.ok(auth.includes('async function revokeUserSessions(userId: string)') &&
  auth.includes('if (error) throw new HttpError(503, "session_revocation_failed"') &&
  (auth.match(/await revokeUserSessions\\(user.id\\)/g) || []).length === 2,
  'Revogação de sessões deve ser verificada no reset e na desativação.');
assert.ok(auth.includes('async function reactivate(userId: string)') &&
  auth.includes('account_unavailable'),
  'Falha ao reativar perfil deve bloquear a emissão de sessão.');
assert.ok(auth.includes('client.auth.signOut({ scope: "local" })') &&
  auth.includes('session_cleanup_failed'),
  'A sessão temporária de verificação de senha deve ser encerrada.');

console.log('SHIQI static contract: OK (13 rotas Auth, 18 tabelas/RLS, 17 policies, 59 ACL revokes, privacidade de perfil/anexos, concorrência de voz e limites).');
console.log('Atenção: teste estático; não valida Deno, JWT, Supabase Auth, PostgreSQL ou envio de e-mail.');
