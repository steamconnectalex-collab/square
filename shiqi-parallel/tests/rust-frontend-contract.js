'use strict';

// Contrato estático entre a interface SHIQI e o serviço Rust paralelo.
// Não usa tokens reais nem faz chamadas externas.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'apps/web/app.js'), 'utf8');
const config = fs.readFileSync(path.join(root, 'apps/web/config.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'services/core/src/main.rs'), 'utf8');

assert.ok(config.includes("CORE_URL: 'https://shiqi-core-development.up.railway.app'"),
  'A interface deve apontar somente para o serviço Rust do ambiente paralelo.');
assert.ok(app.includes("base + '/v1/attachments/upload'"),
  'O envio de anexos deve usar a rota Rust.');
assert.ok(app.includes("'x-attachment-path': path"),
  'O upload deve encaminhar o caminho validado do anexo.');
assert.ok(app.includes("authorization: 'Bearer ' + t"),
  'O upload deve encaminhar o JWT renovado da sessão do usuário.');
assert.ok(app.includes('uploadAttachmentViaCore(path, blob'),
  'O fluxo de envio de imagens deve usar o serviço Rust.');
assert.ok(app.includes("storageCall('POST', path, blob") === false,
  'O fluxo de anexos não deve continuar enviando diretamente ao Storage.');
assert.ok(app.includes("storageCall('POST', path, blob, 'image/jpeg')") === false,
  'O fluxo de avatar não deve ser confundido com o upload de anexos.');
assert.ok(app.includes("storageCall('POST', path, blob, 'image/jpeg', 'avatars')") ||
  app.includes("storageCall('POST', path, blob, 'image/jpeg', 'avatars'"),
  'O fluxo de avatar deve continuar usando Storage diretamente.');
assert.ok(core.includes('.route("/v1/attachments/upload", post(upload_attachment))'),
  'A rota Rust de upload deve existir.');
assert.ok(core.includes('storage.upload(&claims.sub, object_path, token, format, &body)'),
  'O serviço Rust deve encaminhar a identidade JWT original ao Storage.');

console.log('Contrato frontend/Rust de anexos: OK');
