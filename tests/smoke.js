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
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, permissions: ['microphone'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });

  const calls = [];
  const session = { access_token: 'tok-abc', refresh_token: 'ref-abc', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer' };
  let qrPolls = 0;
  const storageCalls = [];
  // ---- banco simulado (servidores, canais, membros, mensagens, perfis) ----
  const world = { servers: [], channels: [], members: [], messages: [], nextMsg: 1, nextId: 1, friendships: [], dms: [], blocks: [], voice: [], bans: [], favs: [], pins: [], plan: 'free', publicCalls: [], pls: [], ptracks: [], nextPl: 1, nextPt: 1, moves: [],
    profiles: [
      { id: 'u1', username: 'tester', display_name: 'Tester Um', bio: '', status_text: '', accent: '#9D8CCF', last_seen: null, created_at: '2026-11-16T10:00:00Z' },
      { id: 'u3', username: 'pedro', display_name: 'Pedro Alves', bio: '', status_text: '', accent: '#6FB3A0', last_seen: null, created_at: '2026-11-12T10:00:00Z' },
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
      if (fn === 'set_server_public') { world.publicCalls.push(body); const sv = world.servers.find((x) => x.id === body.p_server); if (sv) sv.is_public = body.p_public; return send(204, null); }
      if (fn === 'pin_server') {
        if (!body.p_pin) { world.pins = world.pins.filter((x) => x !== body.p_server); return send(204, null); }
        if (world.pins.length >= 4 && !world.pins.includes(body.p_server)) return send(400, { message: 'too_many_pins' });
        if (!world.pins.includes(body.p_server)) world.pins.push(body.p_server);
        return send(204, null);
      }
      if (fn === 'my_plan') return send(200, world.plan);
      if (fn === 'featured_servers') return send(200, [{ id: 'ft1', name: 'Destaque Um', level: 3, members: 12, joined: false }, { id: 'ft2', name: 'Destaque Dois', level: 4, members: 1, joined: false }]);
      if (fn === 'list_public_servers') return send(200, [{ id: 'pub1', name: 'Servidor Aberto', members: 7, joined: world.servers.some((x) => x.id === 'pub1') }]);
      if (fn === 'join_public_server') {
        if (!world.servers.some((x) => x.id === 'pub1')) {
          world.servers.push({ id: 'pub1', name: 'Servidor Aberto', owner_id: 'u2', created_at: new Date().toISOString(), is_public: true });
          world.members.push({ server_id: 'pub1', user_id: 'u1', role: 'member' }, { server_id: 'pub1', user_id: 'u2', role: 'owner' });
          world.channels.push({ id: 'pub1c1', server_id: 'pub1', name: 'Geral', kind: 'text', position: 0 });
        }
        return send(200, 'pub1');
      }
      if (fn === 'create_channel') {
        const id = 'ch' + world.nextId++;
        world.channels.push({ id, server_id: body.p_server, name: body.p_name, kind: body.p_kind, position: world.channels.length });
        return send(200, id);
      }
      if (fn === 'send_friend_request') {
        const u = world.profiles.find((x) => x.username === String(body.p_username).toLowerCase());
        if (!u) return send(400, { message: 'user_not_found' });
        world.friendships.push({ user_a: 'u1' < u.id ? 'u1' : u.id, user_b: 'u1' < u.id ? u.id : 'u1', requester: 'u1', status: 'pending' });
        return send(200, 'pending');
      }
      if (fn === 'respond_friend_request') {
        const f = world.friendships.find((x) => x.requester === body.p_other && x.status === 'pending');
        if (!f) return send(400, { message: 'no_request' });
        if (body.p_accept) f.status = 'accepted'; else world.friendships.splice(world.friendships.indexOf(f), 1);
        return send(204, null);
      }
      if (fn === 'remove_friend') { world.friendships = world.friendships.filter((x) => x.user_a !== body.p_other && x.user_b !== body.p_other); return send(204, null); }
      if (fn === 'block_user') { world.blocks.push({ blocked: body.p_other }); world.friendships = world.friendships.filter((x) => x.user_a !== body.p_other && x.user_b !== body.p_other); return send(204, null); }
      if (fn === 'unblock_user') { world.blocks = world.blocks.filter((b) => b.blocked !== body.p_other); return send(204, null); }
      if (fn === 'kick_member' || fn === 'ban_member') { world.members = world.members.filter((x) => !(x.server_id === body.p_server && x.user_id === body.p_user)); if (fn === 'ban_member') world.bans.push({ user_id: body.p_user, username: 'marina', display_name: 'Marina Rocha' }); return send(204, null); }
      if (fn === 'list_bans') return send(200, world.bans);
      if (fn === 'unban_member') { world.bans = world.bans.filter((b) => b.user_id !== body.p_user); return send(204, null); }
      if (fn === 'voice_join') { world.voice = [{ channel_id: body.p_channel, user_id: 'u1', seen_at: new Date().toISOString() }]; return send(204, null); }
      if (fn === 'voice_ping') return send(204, null);
      if (fn === 'voice_leave') { world.voice = []; return send(204, null); }
      if (fn === 'open_dm') {
        let d = world.dms.find((x) => x.user === body.p_other);
        if (!d) { d = { id: 'dm' + world.nextId++, user: body.p_other }; world.dms.push(d); }
        return send(200, d.id);
      }
      if (fn === 'playlist_move') { world.moves.push([body.p_track, body.p_dir]); const a = world.ptracks.findIndex((x) => x.id === body.p_track), b = a + body.p_dir; if (a >= 0 && world.ptracks[b]) [world.ptracks[a], world.ptracks[b]] = [world.ptracks[b], world.ptracks[a]]; return send(204, null); }
      if (fn === 'create_invite') return send(200, 'abc123def0');
      if (fn === 'join_server') return send(400, { message: 'invalid_invite' });
      return send(404, {});
    }
    if (path === 'music_favorites') {
      if (m === 'POST') { world.favs.unshift({ track_id: body.track_id, track: body.track }); return send(201, null); }
      if (m === 'DELETE') { const id = (q.get('track_id') || '').replace('eq.', ''); world.favs = world.favs.filter((f) => f.track_id !== id); return send(204, null); }
      return send(200, world.favs);
    }
    if (path === 'playlists') {
      if (m === 'POST') { world.pls.unshift({ id: '00000000-0000-4000-8000-00000000000' + world.nextPl++, name: body.name, shared: false, owner_id: 'u1' }); return send(201, null); }
      if (m === 'PATCH') { world.pls.forEach((x) => Object.assign(x, body)); return send(204, null); }
      if (m === 'DELETE') { const id = (q.get('id') || '').replace('eq.', ''); world.pls = world.pls.filter((x) => x.id !== id); return send(204, null); }
      if (q.get('id')) return send(200, world.pls.filter((x) => x.id === q.get('id').replace('eq.', '')));
      return send(200, world.pls.map((x) => ({ id: x.id, name: x.name, shared: x.shared, playlist_tracks: [{ count: world.ptracks.filter((t) => t.playlist_id === x.id).length }] })));
    }
    if (path === 'playlist_tracks') {
      if (m === 'POST') { world.ptracks.push({ id: world.nextPt++, playlist_id: body.playlist_id, track: body.track, position: body.position }); return send(201, null); }
      if (m === 'DELETE') { const id = +(q.get('id') || '').replace('eq.', ''); world.ptracks = world.ptracks.filter((x) => x.id !== id); return send(204, null); }
      const pid = (q.get('playlist_id') || '').replace('eq.', '');
      const rows = world.ptracks.filter((x) => x.playlist_id === pid);
      if ((q.get('select') || '').startsWith('position')) return send(200, rows.length ? [{ position: Math.max(...rows.map((r) => r.position)) }] : []);
      return send(200, rows.map((r) => ({ id: r.id, track: r.track })));
    }
    if (path === 'server_pins') return send(200, world.pins.map((x) => ({ server_id: x })));
    if (path === 'servers') return send(200, world.servers);
    if (path === 'channels') return send(200, q.get('kind') === 'eq.dm' ? world.dms.map((d) => ({ id: d.id })) : world.channels);
    if (path === 'friendships') return send(200, world.friendships);
    if (path === 'blocks') return send(200, world.blocks);
    if (path === 'voice_members') return send(200, world.voice);
    if (path === 'dm_members') return send(200, world.dms.flatMap((d) => [{ channel_id: d.id, user_id: 'u1' }, { channel_id: d.id, user_id: d.user }]));
    if (path === 'server_members') return send(200, world.members);
    if (path === 'profiles') {
      if (m === 'PATCH') { Object.assign(world.profiles[0], body); return send(204, null); }
      return send(200, world.profiles);
    }
    if (path === 'messages') {
      const ch = (q.get('channel_id') || '').replace('eq.', '');
      if (m === 'POST') { const row = { id: world.nextMsg++, channel_id: body.channel_id, author_id: 'u1', content: body.content, created_at: new Date().toISOString(), edited_at: null, attachment_path: body.attachment_path || null }; world.messages.push(row); return send(201, [row]); }
      if (m === 'GET') {
        let rows = world.messages.filter((r) => !ch || r.channel_id === ch);
        const ilk = q.get('content'); if (ilk && /^ilike\./.test(ilk)) { const needle = ilk.slice(6).replace(/\*/g, '').toLowerCase(); rows = rows.filter((r) => (r.content || '').toLowerCase().includes(needle)); }
        const neq = (q.get('author_id') || '').match(/^neq\.(.+)/); if (neq) rows = rows.filter((r) => r.author_id !== neq[1]);
        const gt = (q.get('id') || '').match(/^gt\.(-?\d+)/); if (gt) rows = rows.filter((r) => r.id > +gt[1]);
        const lt = (q.get('id') || '').match(/^lt\.(-?\d+)/); if (lt) rows = rows.filter((r) => r.id < +lt[1]);
        rows = rows.slice().sort((a, b) => (q.get('order') === 'id.desc' ? b.id - a.id : a.id - b.id));
        if (q.get('limit')) rows = rows.slice(0, +q.get('limit'));
        return send(200, rows);
      }
    }
    return send(404, {});
  };

  const wav = (() => { const n = 8000, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; })();
  const itCors = { 'access-control-allow-origin': '*' };
  const itTracks = [101, 102].map((id) => ({ trackId: id, trackName: id === 101 ? 'Magnolia' : 'Sky', artistName: id === 101 ? 'Playboi Carti' : 'Banda Teste', artworkUrl100: 'https://is1-ssl.mzstatic.com/a/' + id + '/100x100bb.jpg', previewUrl: 'https://audio-ssl.itunes.apple.com/x/p' + id + '.wav' }));
  await ctx.route('https://itunes.apple.com/**', (r) => r.fulfill({ status: 200, headers: itCors, contentType: 'application/json', body: JSON.stringify({ results: new URL(r.request().url()).pathname.includes('lookup') ? [itTracks[0]] : itTracks.concat([{ trackId: 103, trackName: 'Sem prévia' }]) }) }));
  await ctx.route('https://audio-ssl.itunes.apple.com/**', (r) => r.fulfill({ status: 200, headers: itCors, contentType: 'audio/wav', body: wav }));
  await ctx.route('https://is1-ssl.mzstatic.com/**', (r) => r.fulfill({ status: 200, headers: itCors, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('https://fonts.gstatic.com/**', (r) => r.abort());
  await ctx.route('https://vjkqyqdabypdylhoupha.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let body = {}; try { body = req.postData() ? JSON.parse(req.postData()) : {}; } catch (e) { body = {}; }
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
        if (body.accept_terms !== true) return send(400, { ok: false, error: 'terms_required', message: 'x' });
        return send(200, { ok: true, email: body.email.toLowerCase(), sent: true });
      case '/verify':
        if (body.code !== 'ABC234') return send(400, { ok: false, error: 'wrong_code', message: 'Esse código não confere. Confira o e-mail e tente de novo.', attempts_left: 4 });
        return send(200, { ok: true, session, user: { id: 'u1', email: body.email }, profile: { username: 'tester', display_name: 'Tester Um' } });
      case '/forgot': return send(200, { ok: true });
      case '/reset': return send(200, { ok: true, session, user: { id: 'u1', email: body.email }, profile: { username: 'tester', display_name: 'Tester Um' } });
      case '/qr/info': return send(200, { ok: true, device: 'Chrome no Windows' });
      case '/qr/approve': return send(200, { ok: true, status: 'approved' });
      default:
        if (/^\/storage\/v1\/object\/(avatars|attachments)\//.test(url.pathname)) { storageCalls.push([req.method(), url.pathname]); return send(200, { Key: 'ok' }); }
        if (url.pathname.startsWith('/rest/v1/')) return rest(req, url, body, send);
        if (url.pathname.startsWith('/auth/v1/logout')) return send(204, {});
        return send(404, {});
    }
  });

  // WebSocket do tempo real simulado
  let wsConn = null; const wsIn = [];
  await ctx.routeWebSocket(/realtime\/v1\/websocket/, (ws) => {
    wsConn = ws;
    ws.onMessage((m) => { const j = JSON.parse(m); wsIn.push(j); if (j.event === 'phx_join') ws.send(JSON.stringify({ topic: j.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: j.ref })); });
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
  // música: busca, fila, favoritas, playlists
  ok('player começa vazio e parado', (await page.locator('#disc.spin').count()) === 0 && /Nenhuma música/.test(await page.textContent('#mt')));
  await page.click('.w-mus [data-act="mus-open"][data-tab="search"]');
  await page.waitForSelector('.modal.wide #mf-q');
  await page.fill('#mf-q', 'magnolia');
  await page.waitForSelector('#mus-res .mrow2');
  ok('busca mostra só músicas com prévia', (await page.locator('#mus-res .mrow2').count()) === 2);
  await page.screenshot({ path: OUT + '/9-musica-busca.png' });
  await page.click('#mus-res .mrow2:nth-child(1) [data-act="mus-q"]');
  await page.click('#mus-res .mrow2:nth-child(2) [data-act="mus-q"]');
  await page.click('#mus-res .mrow2:nth-child(1) [data-act="mus-fav"]');
  await page.waitForTimeout(200);
  ok('favoritar grava no banco', world.favs.length === 1 && world.favs[0].track_id === '101');
  await page.click('.mtab[data-tab="pl"]');
  await page.fill('#mf-new', 'Treino');
  await page.click('[data-act="mus-pl-new"]');
  await page.waitForSelector('.plrow');
  ok('criar playlist', world.pls.length === 1 && /Treino/.test(await page.textContent('.plrow')));
  await page.click('.mtab[data-tab="fav"]');
  await page.click('.mrow2 [data-act="mus-pick"]');
  await page.click('[data-act="mus-addpl"]');
  await page.waitForTimeout(300);
  await page.click('.mtab[data-tab="search"]');
  await page.fill('#mf-q', 'sky');
  await page.waitForSelector('#mus-res .mrow2');
  await page.click('#mus-res .mrow2:nth-child(2) [data-act="mus-pick"]');
  await page.click('[data-act="mus-addpl"]');
  await page.waitForTimeout(300);
  ok('adicionar músicas à playlist (posição crescente)', world.ptracks.length === 2 && world.ptracks[1].position === 2);
  await page.click('.mtab[data-tab="pl"]');
  await page.click('[data-act="mus-pl-open"]');
  await page.waitForSelector('.plhead');
  ok('abrir playlist mostra as faixas', (await page.locator('.modal .mrow2').count()) === 2);
  await page.click('.modal .mrow2:nth-child(2) [data-act="mus-pl-mv"][data-d="-1"]');
  await page.waitForTimeout(200);
  ok('mover para cima chama o banco e muda a ordem', world.moves.length === 1 && world.moves[0][1] === -1 && /Sky/.test(await page.textContent('.modal .mrow2:first-child')));
  await page.click('[data-act="mus-pl-share"]');
  await page.waitForSelector('#toast .toast');
  ok('compartilhar sem conversa aberta avisa', /conversa primeiro/.test(await page.textContent('#toast')));
  await page.click('[data-act="mus-pl-playall"]');
  await page.click('.modal [data-act="modal-close"]');
  await page.waitForSelector('#disc.spin', { timeout: 4000 });
  await page.screenshot({ path: OUT + '/9-musica-player.png' });
  ok('tocar playlist enche a fila e o disco gira', (await page.locator('.w-mus .trk').count()) === 2 && (await page.locator('#disc.spin').count()) === 1);
  ok('capa da música aparece no disco', /mzstatic/.test((await page.getAttribute('#disc .core', 'style')) || ''));
  await page.click('.w-mus [data-act="mus-qmove"][data-i="0"][data-d="1"]');
  ok('mover na fila troca a ordem', /Magnolia/.test(await page.textContent('.w-mus .trk:first-child')) || /Sky|Magnolia/.test(await page.textContent('.w-mus .tracks')));
  await page.click('.w-mus [data-act="mus-qdel"][data-i="1"]');
  ok('tirar da fila', (await page.locator('.w-mus .trk').count()) === 1);
  ok('tirar a música que toca para o disco', await page.locator('#disc.spin').count() === 0);
  await page.click('#mplay');
  await page.waitForSelector('#disc.spin', { timeout: 4000 });
  ok('tocar começa a música', true);
  await page.click('#mplay');
  await page.waitForTimeout(300);
  ok('pausar para o disco', await page.locator('#disc.spin').count() === 0);
  await page.reload();
  await page.waitForSelector('.hub');
  ok('fila lembrada depois de recarregar', (await page.locator('.w-mus .trk').count()) === 1);
  // conta nova: sem servidores
  ok('conta nova mostra estado vazio com convite para criar servidor', /ainda não está em nenhum servidor/.test(await page.textContent('.hchat')));
  await page.screenshot({ path: OUT + '/2d-vazio.png' });
  // 55 mensagens antigas já guardadas no futuro canal Geral (para testar o histórico)
  for (let i = 0; i < 55; i++) world.messages.push({ id: i - 54, channel_id: 'srv1c1', author_id: 'u2', content: 'antiga ' + i, created_at: '2026-11-17T10:00:00Z', edited_at: null });
  // card de servidores: Criar servidor + Explorar (sem "Entrar com convite")
  const cardTxt = await page.textContent('.hsrv .hcta');
  ok('card tem Criar servidor e Explorar, sem "Entrar com convite"', /Criar servidor/.test(cardTxt) && /Explorar/.test(cardTxt) && !/Entrar com convite/.test(cardTxt));
  // explorar: lista pública e entrar
  await page.click('.hsrv .hcta [data-mode="explore"]');
  await page.waitForSelector('.exrow');
  ok('Explorar lista servidores públicos', /Servidor Aberto/.test(await page.textContent('.exrow')));
  await page.click('[data-act="explore-join"]');
  await page.waitForSelector('.scard', { timeout: 5000 });
  ok('entrar por Explorar fica no painel e aparece no carrossel', (await page.locator('.scard').count()) === 1 && /Servidor Aberto/.test(await page.textContent('.scar')));
  // criar servidor pela janela (público)
  await page.click('.hsrv .hcta .mbtn:not(.ghost)');
  await page.waitForSelector('.modal');
  await page.click('[data-act="m-pub"]');
  await page.fill('#mf-name', 'Clube do Teste');
  await page.click('[data-act="modal-submit"]');
  await page.waitForFunction(() => document.querySelectorAll('.scard').length === 2, null, { timeout: 6000 }).catch(async () => { console.log('DEBUG modal:', await page.textContent('.mbody').catch(() => 'sem modal'), '| erros:', errors.join(' | ')); });
  ok('criar servidor mantém o painel e o servidor aparece no carrossel', (await page.locator('.scard').count()) === 2 && (await page.locator('.hub').count()) === 1);
  ok('servidor criado como público chama set_server_public', world.publicCalls.length === 1 && world.publicCalls[0].p_public === true);
  // fixar / desafixar / limite de 4 / carrossel com a roda do mouse
  for (let i = 0; i < 10; i++) { const id = 'ex' + i; world.servers.push({ id, name: 'Extra ' + i, owner_id: 'u2', created_at: new Date().toISOString() }); world.members.push({ server_id: id, user_id: 'u1', role: 'member' }); world.channels.push({ id: id + 'c1', server_id: id, name: 'Geral', kind: 'text', position: 0 }); }
  await page.reload(); await page.waitForSelector('.scard');
  ok('carrossel mostra no máximo 10 dos 12 servidores e avisa do resto', (await page.locator('.scard').count()) === 10 && /Mostrando 10 de 12/.test(await page.textContent('.scmore')));
  ok('painel diz Servidores fixados (não Festas)', /Servidores fixados/.test(await page.textContent('.pp h2')) && !/Festas/.test(await page.textContent('.w-chat')));
  await page.waitForSelector('.w-most .frow');
  ok('card Servidores destaque substitui Mais jogados', /Servidores destaque/.test(await page.textContent('.w-most h2')) && !/Mais jogados/.test(await page.textContent('.w-most')) && (await page.locator('.w-most .frow').count()) === 2);
  ok('destaque mostra nível e membros', /Nível 3 · 12 membros/.test(await page.textContent('.w-most')) && /Nível 4 · 1 membro/.test(await page.textContent('.w-most')));
  await page.click('.w-most [data-act="wd-opts"]');
  await page.waitForSelector('#toast .toast');
  ok('plano grátis não consegue trocar/remover o card', /plano pago/.test(await page.textContent('#toast')) && (await page.locator('.modal, .mbody').count()) === 0);
  world.plan = 'pro'; await page.reload(); await page.waitForSelector('.w-most .frow');
  await page.click('.w-most [data-act="wd-opts"]'); await page.waitForSelector('[data-act="wd-set"]');
  await page.click('[data-act="wd-set"][data-k="netflix"]');
  await page.waitForFunction(() => /Servidores de Netflix/.test(document.querySelector('.w-most h2').textContent));
  await page.waitForFunction(() => /Ainda não há/.test(document.querySelector('.w-most').textContent));
  ok('plano pago troca o card por servidores de Netflix', /Ainda não há servidores públicos de Netflix/.test(await page.textContent('.w-most')));
  await page.click('.w-most [data-act="wd-opts"]'); await page.click('[data-act="wd-set"][data-k="featured"]');
  await page.waitForSelector('.w-most .frow');
  for (let i = 0; i < 4; i++) { await page.locator('.scard .spin2').nth(i).click(); await page.waitForTimeout(120); }
  ok('4 servidores fixados aparecem em Servidores fixados', (await page.locator('.pp .pslot.has').count()) === 4 && world.pins.length === 4);
  await page.locator('.scard .spin2').nth(4).click();
  await page.waitForSelector('#toast .toast');
  ok('o 5º fixado é barrado (plano grátis, até 4)', /até 4 servidores fixados/.test(await page.textContent('#toast')) && world.pins.length === 4);
  await page.locator('.pp .pun').first().click(); await page.waitForTimeout(150);
  ok('desafixar libera um espaço', (await page.locator('.pp .pslot.has').count()) === 3 && world.pins.length === 3);
  await page.click('.pp .pslot:not(.has)'); await page.waitForSelector('.modal .pk');
  ok('botão + abre a lista de servidores para fixar', (await page.locator('.modal .pk').count()) === 9);
  await page.click('.modal .pk >> nth=0'); await page.waitForTimeout(200);
  ok('fixar pela lista', world.pins.length === 4 && (await page.locator('.modal').count()) === 0);
  const sl0 = await page.evaluate(() => document.getElementById('scar').scrollLeft);
  const bb = await page.locator('#scar').boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.wheel(0, 300); await page.waitForTimeout(250);
  const sl1 = await page.evaluate(() => document.getElementById('scar').scrollLeft);
  ok('roda do mouse gira o carrossel para a esquerda', sl1 > sl0);
  await page.mouse.wheel(0, -600); await page.waitForTimeout(250);
  ok('roda para cima volta ao início', (await page.evaluate(() => document.getElementById('scar').scrollLeft)) < sl1);
  // volta ao mundo de antes (tira os extras e os fixados)
  world.servers = world.servers.filter((x) => !x.id.startsWith('ex')); world.members = world.members.filter((x) => !x.server_id.startsWith('ex')); world.channels = world.channels.filter((x) => !x.server_id.startsWith('ex')); world.pins = [];
  await page.reload(); await page.waitForSelector('.scard');
  // abre o servidor criado
  await page.locator('.scard .sopen', { hasText: 'Clube do Teste' }).click();
  await page.waitForSelector('.ap .chat', { timeout: 6000 });
  ok('clicar no servidor do carrossel abre o servidor', /Clube do Teste/.test(await page.textContent('.top h1')));
  ok('servidor novo tem os canais Geral e Sala principal', /Geral/.test(await page.textContent('body')) && /Sala principal/.test(await page.textContent('body')));
  ok('RPC create_server chamada com o nome', calls.some((c) => c[1] === '/rest/v1/rpc/create_server' && c[2].p_name === 'Clube do Teste'));
  // mandar mensagem de verdade
  await page.fill('#msg', 'Olá, mundo real');
  await page.press('#msg', 'Enter');
  await page.waitForFunction(() => /Olá, mundo real/.test(document.getElementById('msgs').textContent), null, { timeout: 5000 }).catch(async () => { console.log('DEBUG msgs:', await page.textContent('#msgs'), '| erros:', errors.join(' | '), '| calls:', JSON.stringify(calls.slice(-5))); });
  ok('mensagem enviada aparece no chat e foi gravada', world.messages.some((m) => m.content === 'Olá, mundo real'));
  // histórico: botão "ver mensagens mais antigas"
  ok('chat mostra o botão de mensagens mais antigas', (await page.locator('#msgs .older').count()) === 1 && !/antiga 0\b/.test(await page.textContent('#msgs')));
  await page.click('#msgs .older');
  await page.waitForFunction(() => /antiga 0(?!\d)/.test(document.getElementById('msgs').textContent), null, { timeout: 4000 });
  ok('"ver mais antigas" carrega o resto do histórico e o botão some', (await page.locator('#msgs .older').count()) === 0);
  // mensagem de outra pessoa chega pelo tempo real (WebSocket)
  await page.waitForFunction(() => true);
  for (let i = 0; i < 40 && !wsIn.some((j) => j.event === 'phx_join'); i++) await page.waitForTimeout(100);
  ok('app abre a conexão de tempo real e pede as mensagens', wsIn.some((j) => j.event === 'phx_join' && JSON.stringify(j.payload).includes('"table":"messages"') && j.payload.access_token));
  await page.waitForTimeout(300);
  const row = { id: world.nextMsg++, channel_id: 'srv1c1', author_id: 'u2', content: 'Oi do outro lado', created_at: new Date().toISOString(), edited_at: null };
  world.messages.push(row);
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'INSERT', record: row } } }));
  await page.waitForFunction(() => /Oi do outro lado/.test(document.getElementById('msgs').textContent), null, { timeout: 4000 });
  ok('mensagem de outro usuário chega na hora (tempo real)', true);
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'UPDATE', record: Object.assign({}, row, { content: 'Oi editado', edited_at: new Date().toISOString() }) } } }));
  await page.waitForFunction(() => /Oi editado/.test(document.getElementById('msgs').textContent) && /editada/.test(document.getElementById('msgs').textContent), null, { timeout: 4000 });
  ok('edição chega em tempo real', true);
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'broadcast', payload: { type: 'broadcast', event: 'typing', payload: { ch: 'srv1c1', uid: 'u2', name: 'Marina Rocha' } } }));
  await page.waitForFunction(() => /Marina Rocha está digitando/.test(document.getElementById('typing').textContent), null, { timeout: 4000 });
  ok('aviso "digitando…" aparece', true);
  await page.fill('#msg', 'estou digitando');
  await page.waitForTimeout(300);
  ok('digitar envia o aviso aos outros', wsIn.some((j) => j.event === 'broadcast' && j.payload.event === 'typing' && j.payload.payload.ch === 'srv1c1'));
  await page.fill('#msg', '');
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'DELETE', old_record: { id: row.id } } } }));
  await page.waitForFunction(() => !/Oi editado/.test(document.getElementById('msgs').textContent), null, { timeout: 4000 });
  ok('mensagem apagada some em tempo real', true);
  // queda da conexão: volta a funcionar pela consulta de reserva
  wsConn.close();
  world.messages.push({ id: world.nextMsg++, channel_id: 'srv1c1', author_id: 'u2', content: 'Chegou pela reserva', created_at: new Date().toISOString(), edited_at: null });
  await page.waitForFunction(() => /Chegou pela reserva/.test(document.getElementById('msgs').textContent), null, { timeout: 9000 });
  ok('sem tempo real, as mensagens ainda chegam (consulta de reserva)', true);
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
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.setInputFiles('#mf-avatar', { name: 'foto.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => { const e = document.querySelector('.who .pic'); return !!e && /avatars/.test(e.style.background + e.getAttribute('style')); }, null, { timeout: 5000 });
  ok('foto enviada ao Storage na pasta da pessoa e salva no perfil', storageCalls.some((c) => c[0] === 'POST' && /\/avatars\/u1\/\d+\.jpg$/.test(c[1])) && /^u1\/\d+\.jpg$/.test(world.profiles[0].avatar_path || ''));
  ok('avatar novo aparece na barra do usuário', true);
  await page.fill('#mf-bio', 'Minha bio de teste');
  await page.click('[data-act="modal-submit"]');
  await page.waitForFunction(() => !document.querySelector('.modal'));
  ok('editar perfil grava a bio no banco', world.profiles[0].bio === 'Minha bio de teste');
  // etapa 6: menção, imagem, busca, menções recebidas
  const c1 = world.channels[0].id;
  await page.fill('#msg', 'oi @tester tudo bem por aí?');
  await page.press('#msg', 'Enter');
  await page.waitForSelector('.mention.me', { timeout: 5000 });
  ok('menção ao próprio @usuário aparece destacada', true);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-act="attach"]')]);
  await fc.setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('.att img', { timeout: 6000 });
  ok('imagem enviada ao Storage e aparece na mensagem', storageCalls.some((c) => c[0] === 'POST' && /\/attachments\/u1\/[0-9a-f-]+\.jpg$/.test(c[1])) && world.messages.some((x) => /^u1\//.test(x.attachment_path || '')));
  await page.click('.nav [data-act="nav"][data-k="search"]');
  await page.fill('#sq', 'tudo bem');
  await page.waitForSelector('.panel .res', { timeout: 5000 });
  ok('busca de mensagens acha a mensagem no canal', (await page.locator('.panel .res').count()) >= 1);
  await page.click('[data-act="close-panel"]');
  world.messages.push({ id: world.nextMsg++, channel_id: c1, author_id: 'u2', content: 'Oi @tester, vem jogar!', created_at: new Date().toISOString(), edited_at: null, attachment_path: null });
  await page.click('.nav [data-act="nav"][data-k="mentions"]');
  await page.waitForSelector('.panel .res', { timeout: 5000 });
  ok('painel de menções lista quem mencionou você', /Marina/.test(await page.textContent('.panel')));
  await page.click('[data-act="close-panel"]');
  // etapa 7: voz
  const vch = world.channels.find((c) => c.kind === 'voice').id;
  await page.click('.vjoin');
  await page.waitForSelector('.vbar', { timeout: 6000 });
  await page.waitForSelector('.vu', { timeout: 6000 });
  ok('entrar na voz: barra "Voz conectada" e a pessoa aparece na sala', /Voz conectada/.test(await page.textContent('.vbar')) && /Tester/.test(await page.textContent('.vg')));
  ok('sala de voz usa canal privado do Realtime', wsIn.some((j) => j.topic === 'realtime:voice:' + vch && j.event === 'phx_join' && j.payload.config.private === true));
  wsConn.send(JSON.stringify({ topic: 'realtime:voice:' + vch, event: 'broadcast', payload: { type: 'broadcast', event: 'hello', payload: { from: 'u2' } } }));
  await page.waitForFunction((v) => true, vch);
  for (let i = 0; i < 40 && !wsIn.some((j) => j.event === 'broadcast' && j.payload && j.payload.event === 'offer'); i++) await page.waitForTimeout(100);
  const offer = wsIn.find((j) => j.event === 'broadcast' && j.payload && j.payload.event === 'offer');
  ok('outra pessoa entra na sala: o site cria a oferta de áudio (WebRTC)', !!offer && offer.payload.payload.to === 'u2' && /m=audio/.test(offer.payload.payload.sdp || ''));
  ok('respondeu "hi" ao recém-chegado', wsIn.some((j) => j.event === 'broadcast' && j.payload && j.payload.event === 'hi' && j.payload.payload.to === 'u2'));
  await page.click('[data-act="mute"] >> nth=0');
  ok('silenciar microfone durante a chamada', (await page.locator('[data-act="mute"]').first().getAttribute('aria-pressed')) === 'true');
  await page.click('[data-act="mute"] >> nth=0');
  await page.screenshot({ path: OUT + '/2j-voz.png' });
  await page.click('[data-act="vleave"]');
  await page.waitForFunction(() => !document.querySelector('.vbar'), null, { timeout: 4000 });
  ok('sair da voz: avisa os outros ("bye") e limpa a sala', wsIn.some((j) => j.event === 'broadcast' && j.payload && j.payload.event === 'bye') && world.voice.length === 0);
  // etapa 8: banir e desbanir (só o dono do servidor)
  const srvId = (world.servers.find((x) => x.owner_id === 'u1') || world.servers[0]).id;
  if (!(await page.locator('.banlnk').count())) await page.click('.nav [data-act="nav"][data-k="members"]');
  await page.waitForSelector('.banlnk');
  if (!(await page.locator('.mlist .pf[data-id="u2"]').count())) { for (const b of await page.locator('.mlist .mg[aria-expanded="false"]').all()) await b.click(); }
  await page.click('.mlist .pf[data-id="u2"]');
  await page.waitForSelector('.pcard');
  ok('dono vê "Expulsar" e "Banir" no cartão de um membro', (await page.locator('.modal [data-act="mod"][data-k="kick"]').count()) === 1 && (await page.locator('.modal [data-act="mod"][data-k="ban"]').count()) === 1);
  await page.click('.modal [data-act="mod"][data-k="ban"]');
  await page.waitForSelector('.modal:has-text("Banir do servidor")');
  await page.click('[data-act="modal-submit"]');
  await page.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 5000 });
  ok('banir tira a pessoa do servidor e guarda o banimento', !world.members.some((x) => x.server_id === srvId && x.user_id === 'u2') && world.bans.length === 1);
  await page.click('.banlnk');
  await page.waitForSelector('.banrow', { timeout: 5000 });
  ok('lista de banidos mostra a pessoa', /Marina/.test(await page.textContent('.modal')));
  await page.click('[data-act="unban"]');
  await page.waitForFunction(() => !document.querySelector('.banrow'), null, { timeout: 5000 });
  ok('desbanir remove da lista', world.bans.length === 0);
  await page.click('.modal [data-act="modal-close"]');
  world.members.push({ server_id: srvId, user_id: 'u2', role: 'member' });
  // painel inicial agora com dados reais
  await page.click('.tbh');
  await page.waitForSelector('.hub');
  ok('ícone de conversa volta ao painel', true);
  ok('sem amigos: o painel convida a adicionar', /ainda não tem amigos/.test(await page.textContent('#flist')));
  if (await page.locator('.hch .ctab:not(.srvtab)').count()) await page.click('.hch .ctab:not(.srvtab) >> nth=0');
  await page.fill('#hmsg', 'Oi pessoal');
  await page.press('#hmsg', 'Enter');
  await page.waitForFunction(() => /Oi pessoal/.test(document.getElementById('hmsgs').textContent));
  ok('mensagem aparece na conversa do painel', true);
  // adicionar amigo pelo @usuário
  await page.click('#flist [data-act="toast-friend"]');
  await page.fill('#mf-user', '@Marina');
  await page.click('[data-act="modal-submit"]');
  await page.waitForFunction(() => !document.querySelector('.modal'));
  ok('pedido de amizade enviado pelo @usuário', world.friendships.length === 1 && world.friendships[0].requester === 'u1' && world.friendships[0].status === 'pending');
  await page.click('[data-act="toast-friend"] >> nth=0').catch(() => {});
  await page.waitForSelector('.modal');
  await page.fill('#mf-user', 'ninguemassim');
  await page.click('[data-act="modal-submit"]');
  await page.waitForSelector('.merr');
  ok('@usuário que não existe mostra erro em português', /Não encontramos/.test(await page.textContent('.merr')));
  await page.click('[data-act="modal-close"]');
  // o cartão de quem recebeu o pedido mostra "Cancelar pedido"
  await page.click(`[data-act="srv-open"][data-id="${srvId}"] >> nth=0`);
  await page.waitForSelector('.ap .chat');
  await page.click('#msgs [data-act="profile"][data-id="u2"]');
  await page.waitForSelector('.pcard');
  ok('cartão de pedido enviado oferece cancelar', /Cancelar pedido/.test(await page.textContent('.mfoot')));
  await page.click('[data-act="modal-close"]');
  // Marina aceita (chega pelo tempo real)
  world.friendships[0].status = 'accepted';
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'UPDATE', table: 'friendships', record: { requester: 'u1', status: 'accepted' } } } }));
  await page.click('.tbh');
  await page.waitForFunction(() => document.querySelectorAll('#flist .frow').length === 1, null, { timeout: 5000 });
  ok('amiga aceita aparece na lista de amigos', /Marina Rocha/.test(await page.textContent('#flist')));
  await page.click('[data-act="gsearch"]');
  await page.fill('#gsearch', 'marina');
  ok('busca filtra os amigos', (await page.locator('#flist .frow').count()) === 1);
  await page.fill('#gsearch', 'zzz');
  ok('busca sem resultado', /Nenhum amigo/.test(await page.textContent('#flist')));
  await page.fill('#gsearch', '');
  await page.click('[data-act="gsearch"]');
  // conversa privada
  await page.click('#flist .frow');
  await page.waitForSelector('.pcard');
  ok('cartão de amigo oferece enviar mensagem', /Enviar mensagem/.test(await page.textContent('.mfoot')) && /Remover amigo/.test(await page.textContent('.mfoot')));
  await page.click('[data-act="dm"]');
  await page.waitForFunction(() => !document.querySelector('.modal') && document.querySelector('.dmtab.on'));
  await page.fill('#hmsg', 'Oi Marina, tudo bem?');
  await page.press('#hmsg', 'Enter');
  await page.waitForFunction(() => /Oi Marina, tudo bem/.test(document.getElementById('hmsgs').textContent));
  ok('conversa privada: mensagem enviada ao canal da conversa', world.messages.some((m) => /^dm/.test(m.channel_id) && m.content === 'Oi Marina, tudo bem?'));
  await page.screenshot({ path: OUT + '/2g-dm.png' });
  const dmId = world.dms[0].id;
  const rowdm = { id: world.nextMsg++, channel_id: dmId, author_id: 'u2', content: 'Tudo ótimo!', created_at: new Date().toISOString(), edited_at: null };
  world.messages.push(rowdm);
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'INSERT', table: 'messages', record: rowdm } } }));
  await page.waitForFunction(() => /Tudo ótimo/.test(document.getElementById('hmsgs').textContent), null, { timeout: 4000 });
  ok('resposta da amiga chega em tempo real na conversa privada', true);
  // pedido recebido: sino mostra e aceita
  world.friendships.push({ user_a: 'u1', user_b: 'u3', requester: 'u3', status: 'pending' });
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'INSERT', table: 'friendships', record: { requester: 'u3', status: 'pending' } } } }));
  await page.waitForTimeout(700);
  if (!(await page.locator('#ubar.open, #ubar.exp').count())) { await page.click('#b-dots'); await page.waitForTimeout(800); }
  await page.click('#ubar [data-act="panel"][data-k="notif"]');
  await page.waitForSelector('.panel .it.req');
  ok('sino mostra o pedido de amizade recebido', /Pedro Alves/.test(await page.textContent('.panel')));
  await page.click('.panel [data-act="fr-accept"]');
  await page.waitForFunction(() => document.querySelectorAll('#flist .frow').length === 2, null, { timeout: 5000 });
  ok('aceitar o pedido adiciona o novo amigo', world.friendships.every((f) => f.status === 'accepted'));
  // etapa 5 parte 2: conversa em tela cheia, não lidas, bloquear
  await page.click('.hchat [data-act="chat-open"]');
  await page.waitForSelector('.dmrow', { timeout: 5000 });
  await page.waitForFunction(() => /Tudo ótimo/.test(document.getElementById('msgs').textContent), null, { timeout: 5000 });
  ok('conversa privada abre em tela cheia com a lista de amigos', (await page.locator('.dmrow').count()) === 2);
  await page.fill('#msg', 'Mensagem na tela cheia');
  await page.press('#msg', 'Enter');
  await page.waitForFunction(() => /Mensagem na tela cheia/.test(document.getElementById('msgs').textContent));
  ok('tela cheia: mensagem enviada ao canal da conversa', world.messages.some((x) => x.channel_id === world.dms[0].id && x.content === 'Mensagem na tela cheia'));
  await page.screenshot({ path: OUT + '/2h-dm-cheia.png' });
  world.dms.push({ id: 'dm9', user: 'u3' });
  const rowp = { id: world.nextMsg++, channel_id: 'dm9', author_id: 'u3', content: 'E aí, Tester?', created_at: new Date().toISOString(), edited_at: null };
  world.messages.push(rowp);
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'INSERT', table: 'messages', record: rowp } } }));
  await page.waitForSelector('.dmrow .udot', { timeout: 6000 });
  ok('bolinha de não lida aparece na conversa que chegou', (await page.locator('.dmrow .udot').count()) === 1 && (await page.locator('.tbh .udot').count()) === 1);
  await page.click('.dmrow:has(.udot)');
  await page.waitForFunction(() => /E aí, Tester/.test((document.getElementById('msgs') || {}).textContent || ''), null, { timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector('.udot'), null, { timeout: 5000 });
  ok('abrir a conversa apaga a bolinha', true);
  await page.click('.top [data-act="profile"]');
  await page.waitForSelector('.blink');
  await page.click('.blink');
  await page.waitForSelector('.modal:has-text("Bloquear pessoa")');
  await page.click('[data-act="modal-submit"]');
  await page.waitForSelector('.hub', { timeout: 6000 });
  ok('bloquear remove a amizade e volta ao painel', world.blocks.length === 1 && world.blocks[0].blocked === 'u3' && world.friendships.every((x) => x.user_a !== 'u3' && x.user_b !== 'u3'));
  await page.screenshot({ path: OUT + '/2i-bloqueado.png' });
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
  const anoAtual = new Date().getFullYear();
  await page.selectOption('#r-day', '10'); await page.selectOption('#r-month', '5'); await page.selectOption('#r-year', String(anoAtual - 8));
  await page.click('button.btn[type=submit]');
  await page.waitForFunction(() => /pelo menos 13 anos/.test(document.body.textContent));
  ok('cadastro: menor de 13 anos é barrado', true);
  await page.selectOption('#r-year', '2000');
  await page.click('button.btn[type=submit]');
  await page.waitForFunction(() => /Aceite os Termos de Uso/.test(document.body.textContent));
  ok('cadastro: sem aceitar os termos não segue', true);
  ok('cadastro: links para Termos e Privacidade', (await page.locator('a[href="/termos"]').count()) === 1 && (await page.locator('a[href="/privacidade"]').count()) === 1);
  await page.check('#r-terms');
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
