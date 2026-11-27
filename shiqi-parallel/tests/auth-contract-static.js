'use strict';

// Testes estáticos do contrato Auth da cópia paralela SHIQI.
// Não substituem testes de runtime contra Supabase Auth/Postgres.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

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
  assert.match(auth, new RegExp('case\\s+["\\']' + route.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '["\\']'));
}

assert.match(auth, /Deno\\.serve\\s*\\(/);
assert.match(auth, /if \\(!SUPABASE_URL \\|\\| !SERVICE_KEY \\|\\| !ANON_KEY\\)/);
assert.doesNotMatch(auth, /https:\\/\\/(?:www\\.)?shiqi\\.com\\.br|square-chat-silk|square-chat-steamconnectalex/);
assert.doesNotMatch(auth, /case\\s+["']\\/qr\\//);

const sql = [authRpcSql, socialRpcSql, serverRpcSql, moderationRpcSql, privateSql].join('\\n');
for (const table of ['profiles', 'email_codes', 'mfa_recovery']) {
  assert.match(tablesSql, new RegExp('create\\s+table\\s+public\\.' + table + '\\b', 'i'));
  assert.match(auth, new RegExp('\\.from\\(["\\']' + table + '["\\']\\)'));
}
for (const rpc of [
  'rate_check', 'get_auth_user_by_email', 'verify_email_code',
  'get_login_email_by_username', 'revoke_user_sessions', 'purge_user_data',
]) {
  assert.match(sql, new RegExp('create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.' + rpc + '\\s*\\(', 'i'));
  assert.match(auth, new RegExp('\\.rpc\\(["\\']' + rpc + '["\\']'));
}

assert.match(serverRpcSql, /function public\\.is_server_member\\(p_server uuid\\)[\\s\\S]*?security definer[\\s\\S]*?set search_path to ''/i);
assert.equal((tablesSql.match(/create\\s+table\\s+public\\./gi) || []).length, 18);
assert.equal((rlsSql.match(/enable row level security/gi) || []).length, 18);
assert.equal((rlsSql.match(/create policy /gi) || []).length, 17);
assert.equal((aclSql.match(/revoke execute on function /gi) || []).length, 58);

assert.match(auth, /factorError/);
assert.match(auth, /clearError/);
assert.match(auth, /s = await mintSession\\(email\\)/);
assert.match(ui, /api\\(\\)\\.logout\\(\\); \\/\\/ o Supabase encerra as sessões/);

console.log('SHIQI Auth static contract: OK (13 rotas, 18 tabelas/RLS, 17 policies, 58 ACL revokes).');
console.log('Atenção: teste estático; não valida Deno, JWT, Supabase Auth, PostgreSQL ou envio de e-mail.');
