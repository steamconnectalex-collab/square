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
const sendStart = app.indexOf('async function sendImage(file) {');
const sendEnd = app.indexOf('async function doSend()', sendStart);
const sendFlow = app.slice(sendStart, sendEnd);
assert.ok(sendStart >= 0 && sendFlow.includes('uploadAttachmentViaCore(path, blob'),
  'O envio de imagens deve passar pelo serviço Rust.');
assert.ok(!sendFlow.includes("storageCall('POST', path, blob"),
  'O envio de anexos não deve continuar enviando diretamente ao Storage.');
const avatarStart = app.indexOf('uploadAvatar: async (blob) => {');
const avatarEnd = app.indexOf('removeAvatar: async () => {', avatarStart);
const avatarFlow = app.slice(avatarStart, avatarEnd);
assert.ok(avatarStart >= 0 && avatarFlow.includes("storageCall('POST', path, blob, 'image/jpeg')"),
  'O fluxo de avatar deve continuar usando o bucket avatars diretamente.');
assert.ok(core.includes('.route("/v1/attachments/upload", post(upload_attachment))'),
  'A rota Rust de upload deve existir.');
assert.ok(core.includes('.upload(&claims.sub, object_path, token, format, &body)'),
  'O serviço Rust deve encaminhar a identidade JWT original ao Storage.');

console.log('Contrato frontend/Rust de anexos: OK');
