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
const moderationRpcSql = read('docs/CANONICAL_MODERATION_EVENTS_VOICE_RPCS.sql');
const privateSql = read('docs/CANONICAL_PRIVATE_FUNCTIONS.sql');
const aclSql = read('docs/CANONICAL_FUNCTION_ACL.sql');
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
assert.ok(!auth.includes('case "/qr/'), 'Rota QR não deve estar na cópia paralela.');

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
  assert.ok(sql.includes('function public.' + rpc + '('), 'Definição SQL ausente: ' + rpc);
  assert.ok(auth.includes('.rpc("' + rpc + '"') || auth.includes(".rpc('" + rpc + "'"),
    'Chamada RPC ausente: ' + rpc);
}

const memberHelper = serverRpcSql.slice(serverRpcSql.indexOf('function public.is_server_member('));
assert.ok(memberHelper.includes('security definer') && memberHelper.includes("set search_path to ''"),
  'Helper is_server_member precisa de SECURITY DEFINER e search_path vazio.');
assert.equal(count(tablesSql, 'create table public.'), 18, 'Contagem inesperada de tabelas.');
assert.equal(count(rlsSql, 'enable row level security'), 18, 'Todas as tabelas devem ter RLS.');
assert.equal(count(rlsSql, 'create policy '), 17, 'Contagem inesperada de policies.');
assert.equal(count(aclSql, 'revoke execute on function '), 58, 'A ACL deve revogar as 58 assinaturas.');

assert.ok(auth.includes('factorError') && auth.includes('clearError'), 'Erros de operação MFA não estão sendo verificados.');
assert.ok(auth.includes('s = await mintSession(email)'), 'Recuperação MFA deve emitir sessão nova após excluir o fator.');
assert.ok(ui.includes('api().logout(); // o Supabase encerra as sessões'),
  'A interface deve encerrar a sessão local após desligar MFA.');

console.log('SHIQI Auth static contract: OK (13 rotas, 18 tabelas/RLS, 17 policies, 58 ACL revokes).');
console.log('Atenção: teste estático; não valida Deno, JWT, Supabase Auth, PostgreSQL ou envio de e-mail.');
