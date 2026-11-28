'use strict';

// Garante que cada RPC chamada pelos módulos web tenha definição no pacote SQL canônico.
// É uma verificação estática: não substitui autorização/RLS em PostgreSQL real.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'apps', 'web');
const docsDir = path.join(root, 'docs');
const jsFiles = fs.readdirSync(webDir).filter((name) => name.endsWith('.js'));
const sqlFiles = fs.readdirSync(docsDir).filter((name) => name.startsWith('CANONICAL_') && name.endsWith('.sql'));
const js = jsFiles.map((name) => fs.readFileSync(path.join(webDir, name), 'utf8')).join('\\n');
const sql = sqlFiles.map((name) => fs.readFileSync(path.join(docsDir, name), 'utf8')).join('\\n');

const calls = new Set([...js.matchAll(/\\brpc\\s*\\(\\s*['"]([a-z_][a-z0-9_]*)['"]/gi)].map((match) => match[1].toLowerCase()));
const definitions = new Set([...sql.matchAll(/\\bfunction\\s+(?:public|private)\\.([a-z_][a-z0-9_]*)\\s*\\(/gi)].map((match) => match[1].toLowerCase()));
const missing = [...calls].filter((name) => !definitions.has(name)).sort();

assert.ok(jsFiles.length > 0, 'Nenhum módulo JavaScript do frontend foi encontrado.');
assert.ok(sqlFiles.length > 0, 'Nenhum SQL canônico foi encontrado.');
assert.deepEqual(missing, [], 'RPCs chamadas pelo frontend sem definição SQL: ' + missing.join(', '));

console.log('Contrato frontend/SQL: OK (' + calls.size + ' RPCs verificadas em ' + jsFiles.length + ' módulos web).');
