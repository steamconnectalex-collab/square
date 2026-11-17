// Teste de fumaça do site real com a rede do Supabase simulada.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'site');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
});

const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'OK  ' : 'FAIL', name, extra]); };

(async () => {
  await new Promise((r) => server.listen(3100, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });

  const calls = [];
  const session = { access_token: 'tok-abc', refresh_token: 'ref-abc', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer' };
  let qrPolls = 0;
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('https://fonts.gstatic.com/**', (r) => r.abort());
  await ctx.route('https://vjkqyqdabypdylhoupha.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    const p = url.pathname.replace('/functions/v1/auth', '');
    calls.push([req.method(), p, body]);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const send = (status, data) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(data) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    switch (p) {
      case '/qr/create': return send(200, { ok: true, id: '56c06bd4-0010-4975-9206-096939283ab0', poll_secret: 'ps', ttl: 120, url: 'https://square-chat.vercel.app/#qr?id=56c06bd4-0010-4975-9206-096939283ab0&s=abc' });
      case '/qr/poll': qrPolls++; return send(200, { ok: true, status: 'pending' });
      case '/login':
        if (body.password === 'errada123') return send(401, { ok: false, error: 'invalid_credentials', message: 'E-mail, nome de usuário ou senha incorretos.' });
        if (body.identifier === 'novo@exemplo.com') return send(403, { ok: false, error: 'unverified', message: 'x', email: 'novo@exemplo.com' });
        return send(200, { ok: true, session, user: { id: 'u1', email: 'teste@exemplo.com' }, profile: { username: 'tester', display_name: 'Tester Um' } });
      case '/signup':
        if (body.username === 'ocupado') return send(409, { ok: false, error: 'username_taken', message: 'Esse nome de usuário já está em uso. Escolha outro.' });
        return send(200, { ok: true, email: body.email.toLowerCase(), sent: true });
      case '/verify':
        if (body.code !== 'ABC234') return send(400, { ok: false, error: 'wrong_code', message: 'Esse código não confere. Confira o e-mail e tente de novo.', attempts_left: 4 });
        return send(200, { ok: true, session, user: { id: 'u1', email: body.email }, profile: { username: 'tester', display_name: 'Tester Um' } });
      case '/forgot': return send(200, { ok: true });
      case '/reset': return send(200, { ok: true, session, user: { id: 'u1', email: body.email }, profile: { username: 'tester', display_name: 'Tester Um' } });
      case '/qr/info': return send(200, { ok: true, device: 'Chrome no Windows' });
      case '/qr/approve': return send(200, { ok: true, status: 'approved' });
      default:
        if (url.pathname.startsWith('/rest/v1/profiles')) return send(200, [{ username: 'tester', display_name: 'Tester Um' }]);
        if (url.pathname.startsWith('/auth/v1/logout')) return send(204, {});
        return send(404, {});
    }
  });

  const base = 'http://localhost:3100/';
  // 0. home
  await page.goto(base);
  await page.waitForSelector('.home h1');
  ok('home abre na raiz', /Converse, jogue/.test(await page.textContent('.home h1')));
  ok('home: marca Square.', (await page.textContent('.home header a')).includes('Square.'));
  await page.screenshot({ path: OUT + '/0-home.png', fullPage: true });
  await page.click('.home nav a[data-act="soon"]');
  await page.waitForSelector('#toast .toast');
  ok('home: link sem destino mostra aviso', /Em breve/.test(await page.textContent('#toast')));
  await page.click('.home header a[href="#login"]');
  await page.waitForSelector('[data-form="login"]');
  ok('home: Entrar leva ao login', true);
  await page.click('.pill');
  await page.waitForSelector('.home h1');
  ok('logo do acesso volta para a home', true);

  // 1. login + QR
  await page.goto(base + '#login');
  await page.waitForSelector('[data-form="login"]');
  await page.waitForSelector('#qr-box svg', { timeout: 5000 });
  ok('login renderiza', true);
  ok('QR real desenhado (svg)', (await page.locator('#qr-box .qrbox > svg > path').count()) === 1);
  await page.screenshot({ path: OUT + '/1-login.png' });
  await page.waitForTimeout(2300);
  ok('QR faz polling', qrPolls >= 1, 'polls=' + qrPolls);

  // 2. login inválido
  await page.fill('#login-id', 'teste@exemplo.com');
  await page.fill('#login-pw', 'errada123');
  await page.click('button.btn[type=submit]');
  await page.waitForSelector('.alert');
  ok('erro de credencial aparece', /incorretos/.test(await page.textContent('.alert')));

  // 3. login ok -> app
  await page.fill('#login-pw', 'Senha1234!');
  await page.click('button.btn[type=submit]');
  await page.waitForSelector('.who strong', { timeout: 5000 });
  ok('app abre com nome do perfil', (await page.textContent('.who strong')).includes('Tester Um'));
  await page.screenshot({ path: OUT + '/2-app.png' });
  ok('sessão salva', !!(await page.evaluate(() => localStorage.getItem('sq.session'))));

  // 4. recarregar mantém sessão
  await page.reload();
  await page.waitForSelector('.who strong', { timeout: 5000 });
  ok('recarregar mantém a sessão', true);

  // 5. logout
  const menuBtn = page.locator('[data-act="menu"]');
  await menuBtn.click();
  await page.click('[data-act="logout"]');
  await page.waitForSelector('[data-form="login"]');
  ok('logout volta ao login', !(await page.evaluate(() => localStorage.getItem('sq.session'))));

  // 6. cadastro com erro de servidor + sucesso + verificação
  await page.click('[data-act="to-register"]');
  await page.waitForSelector('[data-form="register"]');
  await page.click('button.btn[type=submit]');
  ok('validação local do cadastro', (await page.locator('.err').count()) >= 3);
  await page.fill('#r-email', 'Novo@Exemplo.com');
  await page.fill('#r-user', 'ocupado');
  await page.fill('#r-pass', 'Senha1234!');
  await page.selectOption('#r-day', '10'); await page.selectOption('#r-month', '5'); await page.selectOption('#r-year', '2000');
  await page.click('button.btn[type=submit]');
  await page.waitForSelector('#r-user.bad');
  ok('erro do servidor no campo (username_taken)', /em uso/.test(await page.textContent('.field:has(#r-user) .err')));
  await page.fill('#r-user', 'novo.user');
  await page.screenshot({ path: OUT + '/3-register.png', fullPage: true });
  await page.click('button.btn[type=submit]');
  await page.waitForSelector('#otp');
  ok('vai para a tela do código', /novo@exemplo\.com/.test(await page.textContent('.head p')));
  await page.fill('#otp', 'zzzzzz'); // 6 caracteres: envia sozinho
  await page.waitForSelector('#otp-msg .err');
  ok('código errado mostra erro', /não confere/.test(await page.textContent('#otp-msg')));
  await page.screenshot({ path: OUT + '/4-verify.png' });
  await page.fill('#otp', 'abc-234');
  // o campo envia sozinho ao completar 6 caracteres; se ainda não enviou, clica
  await page.click('button.btn[type=submit]', { timeout: 1500 }).catch(() => {});
  await page.waitForSelector('.who strong', { timeout: 5000 });
  ok('código certo entra no app', true);
  await page.evaluate(() => { localStorage.clear(); });

  // 7. link do e-mail de redefinição
  await page.goto(base + '#reset?e=teste%40exemplo.com&c=Y4BGFL');
  await page.waitForSelector('[data-form="newpass"]');
  ok('link de redefinição abre nova senha', /teste@exemplo\.com/.test(await page.textContent('.head p')));
  ok('fragmento com o código some da barra de endereço', !/Y4BGFL/.test(page.url()), page.url());
  await page.fill('#n-pass', 'NovaSenha99');
  await page.fill('#n-conf', 'NovaSenha99');
  await page.click('button.btn[type=submit]');
  await page.waitForSelector('#t-done', { timeout: 5000 });
  ok('senha atualizada', true);
  await page.screenshot({ path: OUT + '/5-done.png' });
  const resetCall = calls.find((c) => c[1] === '/reset');
  ok('reset enviou e-mail+código+senha', resetCall && resetCall[2].code === 'Y4BGFL' && resetCall[2].password === 'NovaSenha99');

  // 8. esqueci a senha
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto('about:blank');
  await page.goto(base + '#forgot');
  await page.waitForSelector('[data-form="forgot"]');
  await page.fill('#f-email', 'teste@exemplo.com');
  await page.click('button.btn[type=submit]');
  await page.waitForSelector('#t-sent');
  ok('esqueci a senha -> confira seu e-mail', true);

  // 9. aprovar QR a partir de dispositivo logado
  await page.evaluate((s) => { localStorage.setItem('sq.session', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3000, user: { id: 'u1', email: 'teste@exemplo.com' } })); localStorage.setItem('sq.profile', JSON.stringify({ username: 'tester', display_name: 'Tester Um' })); }, session);
  await page.goto('about:blank');
  await page.goto(base + '#qr?id=56c06bd4-0010-4975-9206-096939283ab0&s=abc');
  await page.waitForSelector('[data-act="qr-approve"]', { timeout: 5000 }).catch(() => {});
  ok('tela de aprovar QR mostra o dispositivo', /Chrome no Windows/.test(await page.textContent('body')));
  await page.screenshot({ path: OUT + '/6-approve.png' });
  await page.click('[data-act="qr-approve"]');
  await page.waitForSelector('text=Login autorizado', { timeout: 5000 });
  const appr = calls.find((c) => c[1] === '/qr/approve');
  ok('aprovação enviou id e segredo', appr && appr[2].id && appr[2].approve_secret === 'abc' && appr[2].decision === 'approve');

  // 10. mobile
  await page.evaluate(() => { localStorage.clear(); });
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await m.route('**/*', (r) => (r.request().url().startsWith('http://localhost:3100') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"id":"56c06bd4-0010-4975-9206-096939283ab0","poll_secret":"p","ttl":120,"url":"https://square-chat.vercel.app/#qr?id=x&s=y"}' })));
  const mp = await m.newPage();
  await mp.goto(base);
  await mp.waitForSelector('.home h1');
  const homeOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('mobile: sem rolagem horizontal na home', homeOverflow <= 0, 'overflow=' + homeOverflow);
  await mp.screenshot({ path: OUT + '/7-home-mobile.png', fullPage: true });
  await mp.goto(base + '#login');
  await mp.waitForSelector('[data-form="login"]');
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('mobile: sem rolagem horizontal no login', overflow <= 0, 'overflow=' + overflow);
  await mp.screenshot({ path: OUT + '/7-login-mobile.png' });

  console.log(results.map((r) => r.join('  ')).join('\n'));
  console.log('erros de página:', errors.length ? errors.join(' | ') : 'nenhum');
  await browser.close();
  server.close();
})().catch((e) => { console.error('ERRO NO TESTE', e); process.exit(1); });
