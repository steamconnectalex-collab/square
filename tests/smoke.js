// Teste de fumaça do site real com a rede do Supabase simulada.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'site');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
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
  // ---- banco simulado (servidores, canais, membros, mensagens, perfis) ----
  const world = { servers: [], channels: [], members: [], messages: [], nextMsg: 1, nextId: 1,
    profiles: [
      { id: 'u1', username: 'tester', display_name: 'Tester Um', bio: '', status_text: '', accent: '#9D8CCF', last_seen: null, created_at: '2026-11-16T10:00:00Z' },
      { id: 'u2', username: 'marina', display_name: 'Marina Rocha', bio: 'Gosto de jogos de plataforma.', status_text: 'Jogando', accent: '#E58FB0', last_seen: new Date().toISOString(), created_at: '2026-11-10T10:00:00Z' }
    ] };
  const rest = (req, url, body, send) => {
    const path = url.pathname.replace('/rest/v1/', ''), q = url.searchParams, m = req.method();
    if (path.startsWith('rpc/')) {
      const fn = path.slice(4);
      if (fn === 'create_server') {
        const id = 'srv' + world.nextId++;
        world.servers.push({ id, name: body.p_name, owner_id: 'u1', created_at: new Date().toISOString() });
        world.members.push({ server_id: id, user_id: 'u1', role: 'owner' }, { server_id: id, user_id: 'u2', role: 'member' });
        world.channels.push({ id: id + 'c1', server_id: id, name: 'Geral', kind: 'text', position: 0 }, { id: id + 'c2', server_id: id, name: 'Sala principal', kind: 'voice', position: 1 });
        return send(200, id);
      }
      if (fn === 'create_channel') {
        const id = 'ch' + world.nextId++;
        world.channels.push({ id, server_id: body.p_server, name: body.p_name, kind: body.p_kind, position: world.channels.length });
        return send(200, id);
      }
      if (fn === 'create_invite') return send(200, 'abc123def0');
      if (fn === 'join_server') return send(400, { message: 'invalid_invite' });
      return send(404, {});
    }
    if (path === 'servers') return send(200, world.servers);
    if (path === 'channels') return send(200, world.channels);
    if (path === 'server_members') return send(200, world.members);
    if (path === 'profiles') {
      if (m === 'PATCH') { Object.assign(world.profiles[0], body); return send(204, null); }
      return send(200, world.profiles);
    }
    if (path === 'messages') {
      const ch = (q.get('channel_id') || '').replace('eq.', '');
      if (m === 'POST') { const row = { id: world.nextMsg++, channel_id: body.channel_id, author_id: 'u1', content: body.content, created_at: new Date().toISOString(), edited_at: null }; world.messages.push(row); return send(201, [row]); }
      if (m === 'GET') {
        let rows = world.messages.filter((r) => r.channel_id === ch);
        const gt = (q.get('id') || '').match(/^gt\.(\d+)/); if (gt) rows = rows.filter((r) => r.id > +gt[1]);
        rows = rows.slice().sort((a, b) => (q.get('order') === 'id.desc' ? b.id - a.id : a.id - b.id));
        return send(200, rows);
      }
    }
    return send(404, {});
  };

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
        if (url.pathname.startsWith('/rest/v1/')) return rest(req, url, body, send);
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
  await page.waitForSelector('.hub', { timeout: 5000 });
  ok('depois do login abre o painel inicial', true);
  ok('painel mostra o nome do perfil', ((await page.getAttribute('.ubar .pic', 'aria-label')) || '').includes('Tester Um'));
  ok('painel tem todos os blocos', (await page.locator('.w-fr, .w-chat, .w-most, .w-mus, .w-news, .ubar').count()) === 6);
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/2-app.png' });
  // barra do usuário expande e recolhe
  const w0 = (await page.locator('#ubar').boundingBox()).width;
  await page.click('#b-dots');
  await page.waitForTimeout(800);
  const w1 = (await page.locator('#ubar').boundingBox()).width;
  ok('barra do usuário expande ao clicar nos três pontos', w1 > w0 * 1.6);
  ok('aparecem os 5 botões extras', (await page.locator('.xtra .tb').evaluateAll((l) => l.filter((b) => getComputedStyle(b).opacity === '1').length)) === 5);
  await page.screenshot({ path: OUT + '/2b-barra.png' });
  await page.click('.xtra .tb:last-child');
  await page.waitForTimeout(800);
  ok('seta recolhe a barra', (await page.locator('#ubar').boundingBox()).width < w1 * 0.7);
  // abas de notícias
  await page.click('#tab-free');
  ok('aba Jogos grátis troca o conteúdo', await page.isVisible('#pane-free') && !(await page.isVisible('#pane-news')));
  // player
  ok('disco gira ao tocar', await page.locator('#disc.spin').count() === 1);
  await page.click('#mplay');
  ok('pausar para o disco', await page.locator('#disc.spin').count() === 0);
  await page.click('#mplay');
  // conta nova: sem servidores
  ok('conta nova mostra estado vazio com convite para criar servidor', /ainda não está em nenhum servidor/.test(await page.textContent('.hchat')));
  await page.screenshot({ path: OUT + '/2d-vazio.png' });
  // criar servidor pela janela
  await page.click('.hcta .mbtn:not(.ghost)');
  await page.waitForSelector('.modal');
  await page.fill('#mf-name', 'Clube do Teste');
  await page.click('[data-act="modal-submit"]');
  await page.waitForSelector('.ap .chat', { timeout: 6000 }).catch(async () => { console.log('DEBUG modal:', await page.textContent('.mbody').catch(() => 'sem modal'), '| erros:', errors.join(' | '), '| chamadas:', JSON.stringify(calls.slice(-6))); });
  ok('criar servidor abre o servidor novo', /Clube do Teste/.test(await page.textContent('.top h1')));
  ok('servidor novo tem os canais Geral e Sala principal', /Geral/.test(await page.textContent('body')) && /Sala principal/.test(await page.textContent('body')));
  ok('RPC create_server chamada com o nome', calls.some((c) => c[1] === '/rest/v1/rpc/create_server' && c[2].p_name === 'Clube do Teste'));
  // mandar mensagem de verdade
  await page.fill('#msg', 'Olá, mundo real');
  await page.press('#msg', 'Enter');
  await page.waitForFunction(() => /Olá, mundo real/.test(document.getElementById('msgs').textContent), null, { timeout: 5000 }).catch(async () => { console.log('DEBUG msgs:', await page.textContent('#msgs'), '| erros:', errors.join(' | '), '| calls:', JSON.stringify(calls.slice(-5))); });
  ok('mensagem enviada aparece no chat e foi gravada', world.messages.length === 1 && world.messages[0].content === 'Olá, mundo real');
  // mensagem de outra pessoa chega por atualização automática
  world.messages.push({ id: world.nextMsg++, channel_id: 'srv1c1', author_id: 'u2', content: 'Oi do outro lado', created_at: new Date().toISOString(), edited_at: null });
  await page.waitForFunction(() => /Oi do outro lado/.test(document.getElementById('msgs').textContent), null, { timeout: 8000 });
  ok('mensagem de outro usuário chega sozinha', true);
  await page.screenshot({ path: OUT + '/2e-chat.png' });
  // cartão de perfil de outra pessoa
  await page.click('#msgs [data-act="profile"][data-id="u2"]');
  await page.waitForSelector('.pcard');
  ok('cartão mostra nome, @usuário e bio', /Marina Rocha/.test(await page.textContent('.pcard')) && /@marina/.test(await page.textContent('.pcard')) && /jogos de plataforma/.test(await page.textContent('.pcard')));
  await page.screenshot({ path: OUT + '/2f-cartao.png' });
  await page.click('[data-act="modal-close"]');
  ok('fechar o cartão', (await page.locator('.modal').count()) === 0);
  // criar canal
  await page.click('[data-act="modal-open"][data-k="chan"]');
  await page.fill('#mf-name', 'Avisos');
  await page.click('[data-act="modal-submit"]');
  await page.waitForFunction(() => /Avisos/.test(document.body.textContent));
  ok('canal novo aparece na lista', world.channels.some((c) => c.name === 'Avisos' && c.kind === 'text'));
  // convite
  await page.click('[data-act="nav"][data-k="invite"]');
  await page.waitForSelector('#mf-link');
  ok('convite mostra o link com código', /#join\?c=abc123def0/.test(await page.inputValue('#mf-link')));
  await page.click('[data-act="modal-close"]');
  // editar o próprio perfil
  await page.click('.who .pic');
  await page.waitForSelector('.pcard');
  await page.click('[data-act="edit-profile"]');
  await page.fill('#mf-bio', 'Minha bio de teste');
  await page.click('[data-act="modal-submit"]');
  await page.waitForFunction(() => !document.querySelector('.modal'));
  ok('editar perfil grava a bio no banco', world.profiles[0].bio === 'Minha bio de teste');
  // painel inicial agora com dados reais
  await page.click('.tbh');
  await page.waitForSelector('.hub');
  ok('ícone de conversa volta ao painel', true);
  await page.click('[data-act="gsearch"]');
  await page.fill('#gsearch', 'marina');
  ok('busca filtra os amigos (membros reais)', (await page.locator('.frow').count()) === 1);
  await page.fill('#gsearch', '');
  await page.click('[data-act="gsearch"]');
  await page.fill('#hmsg', 'Oi pessoal');
  await page.press('#hmsg', 'Enter');
  await page.waitForFunction(() => /Oi pessoal/.test(document.getElementById('hmsgs').textContent));
  ok('mensagem aparece na conversa do painel', true);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(300);
  ok('painel no celular sem rolagem lateral', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: OUT + '/2c-painel-celular.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  ok('sessão salva', !!(await page.evaluate(() => localStorage.getItem('sq.session'))));

  // 4. recarregar mantém sessão
  await page.reload();
  await page.waitForSelector('.hub', { timeout: 5000 });
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
  await page.waitForSelector('.hub', { timeout: 5000 });
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
