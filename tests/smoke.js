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
  const world = { events: [], interest: [], rx: [], rxCalls: [], settings: {}, saved: [], usernameCalls: [], servers: [], channels: [], members: [], messages: [], nextMsg: 1, nextId: 1, friendships: [], dms: [], blocks: [], voice: [], bans: [], favs: [], pins: [], plan: 'free', publicCalls: [], pls: [], ptracks: [], nextPl: 1, nextPt: 1, moves: [],
    profiles: [
      { id: 'u1', username: 'tester', display_name: 'Tester Um', bio: '', status_text: '', accent: '#9D8CCF', last_seen: null, created_at: '2026-11-16T10:00:00Z' },
      { id: 'u3', username: 'pedro', display_name: 'Pedro Alves', bio: '', status_text: '', accent: '#6FB3A0', last_seen: null, created_at: '2026-11-12T10:00:00Z' },
      { id: 'u2', username: 'marina', display_name: 'Marina Rocha', bio: 'Gosto de jogos de plataforma.', status_text: 'Jogando', accent: '#E58FB0', last_seen: new Date().toISOString(), created_at: '2026-11-10T10:00:00Z' }
    ] };
  const rest = (req, url, body, send) => {
    const path = url.pathname.replace('/rest/v1/', ''), q = url.searchParams, m = req.method();
    if (path.startsWith('rpc/')) {
      const fn = path.slice(4);
      if (fn === 'profiles_full') return send(200, world.profiles.filter((x) => (body.p_ids || []).includes(x.id)).map((x) => ({ id: x.id, bio: x.bio || '', status_text: x.status_text || '', accent: x.accent || '#9D8CCF', created_at: x.created_at || null, profile_updated_at: null })));
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
      if (fn === 'set_my_presence') { world.presence = body.p_status; return send(204, null); }
      if (fn === 'my_plan') return send(200, world.plan);
      if (fn === 'get_my_settings') return send(200, world.settings);
      if (fn === 'save_my_settings') { world.settings = body.p; world.saved.push(body.p); return send(204, null); }
      if (fn === 'my_age_group') return send(200, 'unknown');
      if (fn === 'change_username') { world.usernameCalls.push(body.p_username); return send(200, body.p_username); }
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
        world.friendships.push({ user_a: 'u1' < u.id ? 'u1' : u.id, user_b: 'u1' < u.id ? u.id : 'u1', requester: 'u1', status: 'pending', note: body.p_note || '' });
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
      if (fn === 'voice_set_state') { world.vstate = body; world.vcalls = (world.vcalls || []).concat([body]); world.voice.forEach((r) => { if (r.user_id === 'u1') Object.assign(r, { muted: !!body.p_muted || !!body.p_deafened, deafened: !!body.p_deafened, video: !!body.p_video, screen: !!body.p_screen }); }); return send(204, null); }
      if (fn === 'voice_leave') { world.voice = []; return send(204, null); }
      if (fn === 'create_event') { world.events.push({ id: 'ev' + (world.events.length + 1), title: body.p_title, description: body.p_description, place: body.p_place, starts_at: body.p_starts }); return send(200, 'ev1'); }
      if (fn === 'toggle_event_interest') { const i = world.interest.findIndex((x) => x.event_id === body.p_event); if (i >= 0) { world.interest.splice(i, 1); return send(200, false); } world.interest.push({ event_id: body.p_event, user_id: 'u1' }); return send(200, true); }
      if (fn === 'toggle_reaction') { const i = world.rx.findIndex((r) => r.message_id === body.p_message && r.emoji === body.p_emoji && r.user_id === 'u1'); world.rxCalls.push([body.p_message, body.p_emoji]); if (i >= 0) { world.rx.splice(i, 1); return send(200, false); } world.rx.push({ message_id: body.p_message, user_id: 'u1', emoji: body.p_emoji }); return send(200, true); }
      if (fn === 'respond_dm_request') { const d = world.dms.find((x) => x.id === body.p_channel); world.dmResp = [body.p_channel, body.p_accept]; if (d) { if (body.p_accept) d.req = false; else world.dms.splice(world.dms.indexOf(d), 1); } return send(204, null); }
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
    if (path === 'message_reactions') return send(200, world.rx);
    if (path === 'server_events') return send(200, world.events);
    if (path === 'event_interest') return send(200, world.interest);
    if (path === 'dm_members') return send(200, world.dms.flatMap((d) => [{ channel_id: d.id, user_id: 'u1', state: d.req ? 'request' : 'active' }, { channel_id: d.id, user_id: d.user, state: 'active' }]));
    if (path === 'server_members') return send(200, world.members);
    if (path === 'profiles') {
      if (m === 'PATCH') { Object.assign(world.profiles[0], body); return send(204, null); }
      return send(200, world.profiles);
    }
    if (path === 'messages') {
      const ch = (q.get('channel_id') || '').replace('eq.', '');
      if (m === 'POST') { const row = { id: world.nextMsg++, channel_id: body.channel_id, author_id: 'u1', content: body.content, created_at: new Date().toISOString(), edited_at: null, attachment_path: body.attachment_path || null, thread_of: body.thread_of || null }; world.messages.push(row); return send(201, [row]); }
      if (m === 'GET') {
        let rows = world.messages.filter((r) => !ch || r.channel_id === ch);
        const tof = q.get('thread_of') || '';
        if (tof === 'is.null') rows = rows.filter((r) => !r.thread_of); else if (/^eq\./.test(tof)) rows = rows.filter((r) => String(r.thread_of) === tof.slice(3)); else if (/^in\.\(/.test(tof)) { const ids = tof.slice(4, -1).split(','); rows = rows.filter((r) => r.thread_of && ids.includes(String(r.thread_of))); }
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
    if (world.slow && req.method() === 'GET' && /\/rest\/v1\/(messages|profiles|servers)/.test(url.pathname)) await new Promise((r) => setTimeout(r, world.slow));
    calls.push([req.method(), p, body]);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const send = (status, data) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(data) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    switch (p) {
      case '/qr/create': return send(200, { ok: true, id: '56c06bd4-0010-4975-9206-096939283ab0', poll_secret: 'ps', ttl: 120, url: 'https://square-chat.vercel.app/#qr?id=56c06bd4-0010-4975-9206-096939283ab0&s=abc' });
      case '/qr/poll': qrPolls++; return send(200, { ok: true, status: 'pending' });
      case '/login':
        if (body.password === 'errada123') return send(401, { ok: false, error: 'invalid_credentials', message: 'E-mail, nome de usuário ou senha incorretos.' });
        if (body.identifier === 'mfa@exemplo.com') {
          if (!body.code && !body.recovery_code) return send(200, { ok: true, mfa_required: true });
          if (body.code !== '123456') return send(400, { ok: false, error: 'wrong_totp', message: 'Esse código do aplicativo não confere.' });
        }
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
      case '/email/change/request': return send(200, { ok: true, email: body.new_email });
      case '/email/change/confirm': return send(200, { ok: true, email: body.new_email });
      case '/account/deactivate': return send(401, { ok: false, error: 'invalid_credentials', message: 'Senha incorreta.' });
      case '/qr/info': return send(200, { ok: true, device: 'Chrome no Windows' });
      case '/qr/approve': return send(200, { ok: true, status: 'approved' });
      default:
        if (/^\/storage\/v1\/object\/(avatars|attachments)\//.test(url.pathname)) { storageCalls.push([req.method(), url.pathname]); return send(200, { Key: 'ok' }); }
        if (url.pathname.startsWith('/rest/v1/')) return rest(req, url, body, send);
        if (url.pathname.startsWith('/auth/v1/logout')) return send(204, {});
        if (url.pathname === '/auth/v1/user' && req.method() === 'GET') return send(200, { id: 'u1', factors: [] });
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

  // 3. login ok -> app (menu principal novo)
  await page.fill('#login-id', 'mfa@exemplo.com');
  await page.fill('#login-pw', 'Senha1234!');
  await page.click('button.btn[type=submit]');
  await page.waitForSelector('#login-code', { timeout: 5000 });
  ok('conta com 2 etapas pede o código depois da senha', true);
  await page.fill('#login-code', '000000');
  await page.click('button.btn[type=submit]');
  await page.waitForSelector('.alert');
  ok('código errado de 2 etapas mostra erro', /não confere/.test(await page.textContent('.alert')));
  await page.click('[data-act="login-rec"]');
  ok('dá para trocar para código de recuperação', /recuperação/.test(await page.textContent('label[for="login-code"]')));
  await page.click('[data-act="login-rec"]');
  await page.fill('#login-code', '123456');
  await page.click('button.btn[type=submit]');
  await page.waitForSelector('.x .x-ph', { timeout: 5000 });
  ok('depois do login abre a página Amigos do menu principal', /Amigos/.test(await page.textContent('.x-tt')));
  ok('barra do usuário mostra o nome do perfil', ((await page.getAttribute('.ub-me', 'aria-label')) || '').includes('Tester Um'));
  ok('menu tem trilho, coluna, barra do usuário e Ativo agora', (await page.locator('.x-rail, .x-col, .x-ub, .x-act').count()) === 4);
  const colTxt = await page.textContent('.x-col');
  ok('coluna tem Amigos, Square Plus, Loja, Missões e Mensagens diretas', ['Amigos', 'Square Plus', 'Loja', 'Missões', 'Mensagens diretas', 'Encontre ou comece uma conversa'].every((t) => colTxt.includes(t)));
  ok('DM oficial da Square aparece', /OFICIAL/.test(colTxt) && /Mensagem Oficial da Square/.test(colTxt));
  ok('trilho tem Criar, Explorar e Baixar', (await page.locator('.x-rail .rt.act').count()) === 3);
  ok('Ativo agora mostra "está quieto"', /Por enquanto, está quieto/.test(await page.textContent('.x-act')));
  ok('sem amigos: a lista convida a adicionar', /ainda não tem amigos/.test(await page.textContent('#flist')));
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/2-app.png' });
  // páginas Loja / Missões / Square oficial
  await page.click('.cn:has-text("Loja")');
  await page.waitForSelector('.lj-h');
  const lh = await page.textContent('.lj-h');
  ok('Loja abre com abas Destaques, Navegar, Loja de Pontos e Lojas do jogo', ['Destaques', 'Navegar', 'Loja de Pontos', 'Lojas do jogo'].every((t) => lh.includes(t)));
  await page.click('[data-act="go-official"]');
  ok('mensagem oficial da Square abre e não aceita resposta', /Bem-vindo/.test(await page.textContent('.x-chat')) && (await page.locator('.x-chat .cbar input[disabled]').count()) === 1);
  await page.click('.cn:has-text("Amigos")');
  // status: Disponível / Ausente / Não perturbe / Invisível
  await page.click('.ub-me');
  await page.waitForSelector('.upop');
  const upTxt = await page.textContent('.upop');
  ok('cartão do usuário tem todas as linhas das fotos', ['Editar perfil', 'Disponível', 'Insígnias', '0 Pontos', 'Mudar de conta'].every((t) => upTxt.includes(t)));
  await page.click('.upop [data-sub="status"]');
  const stTxt = await page.textContent('.upop .fly');
  ok('menu de status tem as 4 opções', ['Disponível', 'Ausente', 'Não perturbe', 'Você não receberá notificação', 'Invisível', 'Você vai aparecer Off-line'].every((t) => stTxt.includes(t)));
  await page.hover('.upop .pi-w:has-text("Ausente")');
  ok('Ausente abre as durações', /Por 15 minutos/.test(await page.textContent('.upop')) && /Até eu mudar/.test(await page.textContent('.upop')));
  await page.click('.upop [data-act="status-set"][data-s="dnd"]');
  await page.waitForFunction(() => /Não perturbe/.test(document.querySelector('.ub-me').textContent));
  ok('mudar o status grava no banco e aparece na barra', world.presence === 'dnd');
  await page.click('.ub-me'); await page.click('.upop [data-sub="pts"]');
  ok('Pontos mostra desafios, Missões e Loja', /Desafios ativos/.test(await page.textContent('.upop .pts')) && /Compre um item da loja/.test(await page.textContent('.upop .pts')));
  await page.screenshot({ path: OUT + '/2b-barra.png' });
  await page.click('.upop [data-sub="status"]'); await page.click('.upop [data-act="status-set"][data-s="online"]');
  await page.waitForFunction(() => /Disponível/.test(document.querySelector('.ub-me').textContent));
  await page.click('.ub-me'); await page.click('.upop [data-sub="acct"]');
  ok('Mudar de conta mostra a conta atual e Gerenciar contas', /Gerenciar contas/.test(await page.textContent('.upop .fly')));
  await page.keyboard.press('Escape'); await page.click('.x-tt'); 
  // microfone e fone: menus
  await page.click('.ugc >> nth=0');
  await page.waitForSelector('.dpop.mic');
  const micTxt = await page.textContent('.dpop.mic');
  ok('menu do microfone tem tudo das fotos', ['Dispositivo de entrada', 'Perfil de entrada', 'Volume de entrada', 'Configurações de voz'].every((t) => micTxt.includes(t)));
  await page.click('.ugc >> nth=1');
  await page.waitForSelector('.dpop.head');
  const headTxt = await page.textContent('.dpop.head');
  ok('menu do fone tem saída, volume e Configurações de voz', ['Dispositivo de saída', 'Volume de saída', 'Configurações de voz'].every((t) => headTxt.includes(t)));
  await page.click('.dpop.head [data-act="open-settings"]');
  await page.waitForSelector('#setroot .set');
  ok('Configurações de voz abre a tela de Voz', /Voz|voz/.test(await page.textContent('#setroot .scontent')));
  await page.keyboard.press('Escape');
  // buscar conversa (Encontre ou comece uma conversa)
  await page.click('.qfind');
  await page.waitForSelector('#qs-in');
  ok('"Encontre ou comece uma conversa" abre a busca', true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.modal'));
  // Adicionar amigo (aba) com contador de 120
  await page.click('[data-act="ftab"][data-k="add"]');
  await page.waitForSelector('#af-user');
  ok('aba Adicionar amigo tem campo, mensagem opcional, contador 120 e Explorar Servidores Públicos', (await page.textContent('.x-pm')).includes('Explorar Servidores Públicos') && (await page.textContent('#af-cnt')) === '120' && /Personalize sua solicitação/.test(await page.getAttribute('#af-note', 'placeholder')));
  ok('botão de enviar pedido começa desligado', await page.isDisabled('#af-send'));
  await page.screenshot({ path: OUT + '/2c-add.png' });
  // criar servidor em passos (primeiro servidor)
  await page.click('[data-act="srv-new"]');
  await page.waitForSelector('.modal.sn');
  ok('primeiro servidor: "Crie seu primeiro servidor na Square" com molde e convite', /Crie seu primeiro servidor/.test(await page.textContent('.modal.sn')) && /Começar de um molde/.test(await page.textContent('.modal.sn')) && /Já tem um convite/.test(await page.textContent('.modal.sn')));
  await page.click('[data-act="sn-tpl"][data-k="own"]');
  ok('passo 2: "Conte-nos mais sobre o seu servidor"', /Conte-nos mais/.test(await page.textContent('.modal.sn')));
  await page.click('.sn-back');
  ok('Voltar retorna ao passo 1', /Começar de um molde/.test(await page.textContent('.modal.sn')));
  await page.click('[data-act="sn-tpl"][data-k="own"]');
  await page.click('[data-act="sn-kind"][data-k="community"]');
  ok('passo 3: nome já vem como "Servidor de …"', /Servidor de/.test(await page.inputValue('#mf-name')) && /Personalize o seu servidor/.test(await page.textContent('.modal.sn')));
  await page.fill('#mf-name', 'Clube do Teste');
  await page.click('[data-act="m-pub"]');
  await page.click('[data-act="modal-submit"]');
  await page.waitForSelector('.wlc', { timeout: 6000 });
  ok('criar servidor abre o servidor com o "Bem-vindo(a)"', /Clube do Teste/.test(await page.textContent('.x-tt')) && /Bem-vindo\(a\) a/.test(await page.textContent('.wlc')));
  ok('RPC create_server chamada com o nome e servidor marcado como público', calls.some((c) => c[1] === '/rest/v1/rpc/create_server' && c[2].p_name === 'Clube do Teste') && world.publicCalls.length === 1 && world.publicCalls[0].p_public === true);
  ok('servidor novo tem as 6 dicas, Geral e Sala principal', (await page.locator('.wlc .wc').count()) === 6 && /Geral/.test(await page.textContent('.x-col')) && /Sala principal/.test(await page.textContent('.x-col')));
  ok('o servidor entra no trilho', (await page.locator('.x-rail .rt[data-act="srv-open"]').count()) === 1);
  await page.screenshot({ path: OUT + '/2d-servidor.png' });
  // explorar
  await page.click('[data-act="srv-explore"]');
  await page.waitForSelector('.exrow');
  ok('Explorar lista servidores públicos', /Servidor Aberto/.test(await page.textContent('.exrow')));
  await page.click('[data-act="explore-join"]');
  await page.waitForFunction(() => document.querySelectorAll('.x-rail .rt[data-act="srv-open"]').length === 2, null, { timeout: 5000 });
  ok('entrar por Explorar põe o servidor no trilho e abre ele', /Servidor Aberto/.test(await page.textContent('.x-tt')));
  await page.click('.x-rail .rt[data-act="srv-open"] >> nth=0');
  await page.waitForSelector('.wlc');
  // 55 mensagens antigas no canal Geral (para testar o histórico) e recarrega
  for (let i = 0; i < 55; i++) world.messages.push({ id: i - 54, channel_id: 'srv1c1', author_id: 'u2', content: 'antiga ' + i, created_at: '2026-11-17T10:00:00Z', edited_at: null });
  await page.reload(); await page.waitForSelector('.x .x-ph');
  await page.click('.x-rail .rt[data-act="srv-open"] >> nth=0');
  await page.waitForSelector('#msgs .bub', { timeout: 6000 });
  // mandar mensagem de verdade
  await page.fill('#msg', 'Olá, mundo real');
  await page.press('#msg', 'Enter');
  await page.waitForFunction(() => /Olá, mundo real/.test(document.getElementById('msgs').textContent), null, { timeout: 5000 }).catch(async () => { console.log('DEBUG msgs:', await page.textContent('#msgs'), '| erros:', errors.join(' | ')); });
  ok('mensagem enviada aparece no chat e foi gravada', world.messages.some((m) => m.content === 'Olá, mundo real'));
  ok('chat mostra o botão de mensagens mais antigas', (await page.locator('#msgs .older').count()) === 1 && !/antiga 0\b/.test(await page.textContent('#msgs')));
  await page.click('#msgs .older');
  await page.waitForFunction(() => /antiga 0(?!\d)/.test(document.getElementById('msgs').textContent), null, { timeout: 4000 });
  ok('"ver mais antigas" carrega o resto do histórico e o botão some', (await page.locator('#msgs .older').count()) === 0);
  const srvId = (world.servers.find((x) => x.owner_id === 'u1') || world.servers[0]).id;
  // esqueleto de carregamento: com a rede lenta aparece enquanto o app abre
  world.slow = 1500;
  await page.reload();
  await page.waitForSelector('.x-main .sk', { timeout: 3000 });
  ok('esqueleto aparece enquanto o app carrega', (await page.locator('.x-main [aria-busy="true"] .sk').count()) > 3 && (await page.locator('.x-cs .sk').count()) > 3);
  await page.screenshot({ path: OUT + '/sk-app.png' });
  world.slow = 0;
  await page.waitForFunction(() => !document.querySelector('.x-main [aria-busy="true"]') && document.querySelector('.x-main'), null, { timeout: 8000 });
  ok('esqueleto some quando carrega', (await page.locator('.x-main [aria-busy="true"]').count()) === 0);
  await page.click(`.x-rail [data-act="srv-open"][data-id="${srvId}"]`);
  await page.waitForSelector('#msgs .msg, #msgs .m, #msgs');
  // tema escuro
  await page.evaluate(() => window.SQ_SET.setP('theme', 'dark'));
  ok('tema escuro aplica data-theme e inverte a página', (await page.evaluate(() => document.documentElement.dataset.theme + '|' + document.documentElement.style.filter)).startsWith('dark|invert(1)'));
  await page.screenshot({ path: OUT + '/dark-app.png' });
  await page.evaluate(() => window.SQ_SET.setP('theme', 'light'));
  ok('tema claro remove o filtro', (await page.evaluate(() => document.documentElement.style.filter)) === '');
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
  // filtro de spam: 2+ links de quem não é amigo ficam recolhidos
  const spam = { id: world.nextMsg++, channel_id: 'srv1c1', author_id: 'u2', content: 'GANHE http://a.example/x http://b.example/y', created_at: new Date().toISOString(), edited_at: null };
  world.messages.push(spam);
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'INSERT', record: spam } } }));
  await page.waitForSelector('#msgs .spamn', { timeout: 4000 });
  ok('spam suspeito aparece recolhido', !/GANHE/.test(await page.textContent('#msgs .spamn')));
  await page.click('#msgs .spamn [data-act="spam-show"]');
  ok('"Mostrar mesmo assim" revela a mensagem', /GANHE/.test(await page.textContent('#msgs')));

  // spoiler, link e botão de enviar
  const sp = { id: world.nextMsg++, channel_id: 'srv1c1', author_id: 'u2', content: 'olha ||segredo|| em https://exemplo.com/a', created_at: new Date().toISOString(), edited_at: null };
  world.messages.push(sp);
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'INSERT', record: sp } } }));
  await page.waitForSelector('#msgs button.spoiler', { timeout: 4000 });
  ok('spoiler fica escondido e abre ao clicar', await page.evaluate(() => { const b = document.querySelector('#msgs button.spoiler'); const h = !b.classList.contains('open'); b.click(); return h && b.classList.contains('open'); }));
  ok('link vira link clicável com selo do site', (await page.locator('#msgs a.lk[href="https://exemplo.com/a"] + .lkchip').count()) === 1);
  await page.evaluate(() => window.SQ_SET.setP('send_btn', true));
  await page.waitForTimeout(300);
  ok('botão de enviar sempre visível quando ligado', await page.evaluate(() => !document.getElementById('send-btn').hidden));
  await page.evaluate(() => window.SQ_SET.setP('send_btn', false));
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
  await page.click('[data-act="modal-open"][data-k="chan"] >> nth=0');
  await page.fill('#mf-name', 'Avisos');
  await page.click('[data-act="modal-submit"]');
  await page.waitForFunction(() => /Avisos/.test(document.body.textContent));
  ok('canal novo aparece na lista', world.channels.some((c) => c.name === 'Avisos' && c.kind === 'text'));
  // convite
  await page.click('[data-act="nav"][data-k="invite"] >> nth=0');
  await page.waitForSelector('#mf-link');
  ok('convite mostra o link com código', /#join\?c=abc123def0/.test(await page.inputValue('#mf-link')));
  await page.click('[data-act="modal-close"]');
  // editar o próprio perfil
  await page.click('.ub-me');
  await page.waitForSelector('.upop');
  await page.click('.upop .pgrp [data-act="edit-profile"]');
  await page.waitForSelector('#perfroot .pwin');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.waitForTimeout(150);
  ok('editor de perfil abre com os blocos das fotos', /Placa de identificação/.test(await page.textContent('#perfroot')) && /Avatar e decorações/.test(await page.textContent('#perfroot')) && /Cor da faixa/.test(await page.textContent('#perfroot')) && /Efeitos de perfil e molduras/.test(await page.textContent('#perfroot')) && /Mural/.test(await page.textContent('#perfroot')) && /Membro desde/.test(await page.textContent('#perfroot')));
  ok('sem alterações não aparece a barra de salvar', (await page.locator('#perfroot .pf-save').count()) === 0);
  await page.screenshot({ path: OUT + '/3a-perfil.png' });
  // janelas de decoração, efeito, moldura e placa
  for (const [k, titulo] of [['decor', 'Mudar decoração de avatar'], ['effect', 'Alterar o efeito de perfil'], ['frame', 'Alterar moldura de perfil'], ['plate', 'Alterar placa de identificação']]) {
    await page.click(`#perfroot [data-pf="${k}"]`);
    await page.waitForSelector('#perfroot .pm.wide');
    ok('janela "' + titulo + '"', (await page.textContent('#perfroot .pm.wide')).includes(titulo));
    if (process.env.DBG) await page.screenshot({ path: OUT + '/dbg-' + k + '.png' });
    await page.click('#perfroot .mgrid.sc .mit >> nth=1');
    ok('item da Loja aparece bloqueado com "Ir para a Loja" (' + k + ')', /Acesse a Loja para comprar/.test(await page.textContent('#perfroot .pm')) && /Ir para a Loja/.test(await page.textContent('#perfroot .pm')));
    if (k === 'decor') await page.screenshot({ path: OUT + '/3b-decoracao.png' });
    if (k === 'frame') await page.screenshot({ path: OUT + '/3c-moldura.png' });
    await page.click('#perfroot .pmf [data-pf="mclose"] >> nth=0');
  }
  // cor da faixa
  await page.click('#perfroot [data-pf="picker"]');
  await page.fill('#phexi', '78BE9D');
  await page.waitForTimeout(300);
  ok('seletor de cor muda a faixa do cartão', (await page.evaluate(() => getComputedStyle(document.querySelector('#perfroot .pbn')).backgroundColor)) === 'rgb(120, 190, 157)');
  await page.screenshot({ path: OUT + '/3d-cor.png' });
  // widgets (guardados no navegador)
  await page.click('#perfroot .pf-lh');
  await page.click('#perfroot [data-pf="widget"][data-k="w1"]');
  await page.fill('#pf-wg', 'Meu jogo de corrida');
  await page.click('#perfroot [data-pf="wgsave"]');
  ok('widget do mural guarda o texto', /Meu jogo de corrida/.test(await page.textContent('#perfroot .pwg')));
  await page.click('#perfroot [data-pf="tab"][data-k="act"]');
  ok('aba Atividade mostra a explicação', /nenhuma atividade/.test(await page.textContent('#perfroot')));
  await page.click('#perfroot [data-pf="tab"][data-k="wish"]');
  ok('aba Lista de desejos vazia leva à Loja', /lista de desejos está vazia/.test(await page.textContent('#perfroot')));
  await page.click('#perfroot [data-pf="tab"][data-k="mural"]');
  // foto: enviar -> recortar -> aplicar -> salvar
  await page.click('#perfroot [data-pf="img"]');
  await page.waitForSelector('#perfroot .pimg');
  await page.screenshot({ path: OUT + '/3e-imagem.png' });
  await page.setInputFiles('#pf-file', { name: 'foto.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#pf-cv');
  ok('recorte abre com zoom e girar', (await page.locator('#pf-zoom').count()) === 1 && (await page.locator('[data-pf="rot"]').count()) === 1);
  await page.screenshot({ path: OUT + '/3f-recorte.png' });
  await page.click('#perfroot [data-pf="capply"]');
  await page.waitForSelector('#perfroot .pf-save');
  ok('depois de aplicar aparece "alterações não salvas"', /não salvas/.test(await page.textContent('#perfroot .pf-save')));
  await page.fill('#pf-bio', 'Minha bio de teste');
  await page.fill('#pf-status', 'Programando');
  await page.click('#perfroot [data-pf="save"]');
  await page.waitForFunction(() => { const e = document.querySelector('.ub-me .xav'); return !!e && /avatars/.test(e.getAttribute('style') || ''); }, null, { timeout: 6000 });
  ok('foto enviada ao Storage na pasta da pessoa e salva no perfil', storageCalls.some((c) => c[0] === 'POST' && /\/avatars\/u1\/\d+\.jpg$/.test(c[1])) && /^u1\/\d+\.jpg$/.test(world.profiles[0].avatar_path || ''));
  ok('salvar grava bio, status e cor no banco', world.profiles[0].bio === 'Minha bio de teste' && world.profiles[0].status_text === 'Programando' && world.profiles[0].accent.toLowerCase() === '#78be9d');
  await page.click('#perfroot [data-pf="close"]');
  ok('fechar o editor', (await page.locator('#perfroot .pwin').count()) === 0);
  // loja, missões e Square Plus
  await page.click('.x-rail .rt.home');
  await page.click('.cn:has-text("Loja")');
  await page.waitForSelector('#lj .jhero');
  ok('Loja abre em Destaques com faixa e carrossel', (await page.locator('#lj .jtrack .jt').count()) >= 4 && /Encontre seu estilo/.test(await page.textContent('#lj')));
  await page.screenshot({ path: OUT + '/4a-loja.png' });
  await page.click('.lj-h [data-lj="dd"][data-k="browse"]');
  await page.click('.jmenu [data-lj="browse"][data-type="frame"]');
  await page.waitForSelector('#lj .jside');
  ok('Navegar filtra por tipo (molduras)', (await page.locator('#lj .jt').count()) > 0 && /Tipo de item/.test(await page.textContent('#lj')));
  await page.screenshot({ path: OUT + '/4b-navegar.png' });
  await page.click('#lj [data-lj="page"][data-n="2"] >> nth=0').catch(() => {});
  await page.click('.lj-h [data-lj="tab"][data-k="points"]');
  await page.waitForSelector('#lj .jpt-hero');
  ok('Loja de Pontos mostra itens exclusivos', (await page.locator('#lj .jx').count()) >= 8);
  await page.screenshot({ path: OUT + '/4c-pontos.png' });
  await page.fill('#lj-q', 'lua');
  await page.waitForSelector('#lj-body .jt');
  ok('busca da loja filtra itens', (await page.locator('#lj-body .jt').count()) > 0 && /Resultados/.test(await page.textContent('#lj-body')));
  await page.fill('#lj-q', '');
  await page.click('.lj-h [data-lj="tab"][data-k="feat"]');
  await page.click('#lj .jt >> nth=0');
  await page.waitForSelector('.jmod');
  await page.click('.jmod [data-lj="wish"]');
  await page.click('.jmod [data-lj="closeitem"].jx2');
  ok('item abre em janela e entra na lista de desejos', (await page.evaluate(() => (JSON.parse(localStorage.getItem('sq.wish.u1') || '[]')).length)) === 1);
  await page.click('.cn:has-text("Missões")');
  await page.waitForSelector('#lj .jqg');
  ok('Missões lista os cartões', (await page.locator('#lj .jq').count()) >= 12);
  await page.screenshot({ path: OUT + '/4d-missoes.png' });
  await page.click('.cn:has-text("Square Plus")');
  await page.waitForSelector('#lj .jp-hero');
  ok('Square Plus mostra planos e comparação', /ESCOLHA SEU PLANO/.test(await page.textContent('#lj')) && (await page.locator('#lj .jtr').count()) > 10);
  await page.screenshot({ path: OUT + '/4e-plus.png', fullPage: false });
  // celular: nenhuma tela pode ter rolagem horizontal
  for (const [w, h] of [[360, 740], [768, 1024]]) {
    await page.setViewportSize({ width: w, height: h });
    const wide = async (nome) => {
      await page.waitForTimeout(120);
      const o = await page.evaluate(() => { const d = document.documentElement; const bad = []; document.querySelectorAll('body *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.right > window.innerWidth + 1) { let p = e.parentElement, clipped = false; while (p && p !== document.body) { p = p.parentElement; } if (bad.length < 8) bad.push((e.className || e.tagName) + ':' + Math.round(r.right)); } }); return [d.scrollWidth - window.innerWidth, bad.join(' | ')]; });
      await page.screenshot({ path: OUT + `/m${w}-${nome}.png` });
      ok(`${w}px: sem rolagem horizontal em ${nome}`, o[0] <= 0, String(o[0]));
    };
    const go = (t) => page.evaluate((t) => { const e = t ? [...document.querySelectorAll('.cn')].find((x) => x.textContent.includes(t)) : document.querySelector('.x-rail .rt.home'); if (e) e.click(); }, t);
    await go(''); await wide('Início');
    await go('Loja'); await wide('Loja');
    await go('Missões'); await wide('Missões');
    await go('Square Plus'); await wide('Plus');
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click('.x-rail .rt[data-act="srv-open"] >> nth=0');
  await page.waitForSelector('#msg');
  for (const [w, h] of [[360, 740], [768, 1024]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    await page.screenshot({ path: OUT + `/m${w}-chat.png` });
    await page.evaluate(() => window.SQ_PERFIL.open());
    await page.waitForTimeout(250);
    await page.screenshot({ path: OUT + `/m${w}-perfil.png` });
    await page.evaluate(() => window.SQ_PERFIL.close());
    await page.evaluate(() => window.SQ_SET.open && window.SQ_SET.open());
    await page.waitForTimeout(250);
    await page.screenshot({ path: OUT + `/m${w}-config.png` });
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForSelector('#msg');
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
  await page.click('.xsearch');
  await page.fill('#sq', 'tudo bem');
  await page.waitForSelector('.panel .res', { timeout: 5000 });
  ok('busca de mensagens acha a mensagem no canal', (await page.locator('.panel .res').count()) >= 1);
  await page.click('[data-act="close-panel"]');
  world.messages.push({ id: world.nextMsg++, channel_id: c1, author_id: 'u2', content: 'Oi @tester, vem jogar!', created_at: new Date().toISOString(), edited_at: null, attachment_path: null });
  await page.click('.x-ti [data-act="nav"][data-k="notif"]');
  await page.click('[data-act="mentions-open"]');
  await page.waitForSelector('.panel .res', { timeout: 5000 });
  ok('painel de menções lista quem mencionou você', /Marina/.test(await page.textContent('.panel')));
  await page.click('[data-act="close-panel"]');
  // reações
  await page.waitForSelector('#msgs .bub', { timeout: 5000 });
  const mid = await page.locator('#msgs [data-act="rx-pick"]').first().getAttribute('data-id');
  await page.locator('#msgs [data-act="rx-pick"]').first().click({ force: true });
  await page.waitForSelector('#msgs .rxp');
  await page.click('#msgs .rxp [data-act="rx"][data-e="🔥"]');
  await page.waitForSelector('#msgs .rxc.on', { timeout: 5000 });
  ok('reagir a uma mensagem mostra o contador e chama o banco', /🔥\s*1/.test(await page.textContent('#msgs .rxc.on')) && world.rxCalls.some((c) => String(c[0]) === mid && c[1] === '🔥'));
  await page.click('#msgs .rxc.on');
  await page.waitForFunction(() => !document.querySelector('#msgs .rxc'), null, { timeout: 5000 });
  ok('clicar de novo na reação a remove', true);
  // tópicos
  await page.locator('#msgs [data-act="thread-open"]').first().click({ force: true });
  await page.waitForSelector('.modal #th-r');
  await page.fill('#th-r', 'Resposta no tópico');
  await page.press('#th-r', 'Enter');
  await page.waitForSelector('.modal .thr', { timeout: 5000 });
  ok('tópico: resposta gravada com thread_of e mostrada na janela', /Resposta no tópico/.test(await page.textContent('.modal .thlist')) && world.messages.some((x) => x.content === 'Resposta no tópico' && x.thread_of));
  await page.click('.modal [data-act="modal-close"]');
  await page.waitForSelector('#msgs .tcb', { timeout: 8000 });
  ok('tópico: a resposta não aparece no chat principal, só o contador', !/Resposta no tópico/.test(await page.textContent('#msgs')) && /1 resposta/.test(await page.textContent('#msgs .tcb')));
  // eventos
  await page.click('[data-act="events"]');
  await page.waitForSelector('.modal [data-act="event-new"]');
  await page.click('[data-act="event-new"]');
  await page.fill('#ev-t', 'Noite de jogos');
  await page.fill('#ev-d', new Date(Date.now() + 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  await page.click('.modal [data-act="modal-submit"]');
  await page.waitForSelector('.evrow', { timeout: 5000 });
  ok('criar evento: aparece na lista', /Noite de jogos/.test(await page.textContent('.evrow')) && world.events.length === 1);
  await page.click('[data-act="event-int"]');
  await page.waitForFunction(() => /1 pessoa interessada/.test(document.querySelector('.evrow').textContent), null, { timeout: 5000 });
  ok('"Tenho interesse" conta uma pessoa', true);
  await page.click('.modal [data-act="modal-close"]');
  // figurinhas
  await page.click('[data-act="sticker-toggle"]');
  await page.click('.stkp [data-act="sticker"][data-ch="🦊"]');
  await page.waitForSelector('#msgs .stk', { timeout: 5000 });
  ok('figurinha enviada aparece grande no chat', (await page.textContent('#msgs .stk')).includes('🦊') && world.messages.some((m) => m.content === '::sticker::🦊'));
  // etapa 7: voz
  const vch = world.channels.find((c) => c.kind === 'voice').id;
  // celular: clicar no canal abre o painel (folha de baixo)
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250);
  await page.click('[data-act="drawer"]');
  await page.click('[data-act="vjoin"]');
  await page.waitForSelector('.vp.pre', { timeout: 6000 });
  ok('celular: canal de voz abre o painel com "Ainda não tem ninguém aqui" e o botão de entrar', /Ainda não tem ninguém aqui/.test(await page.textContent('.vp.pre')) && (await page.locator('.vp.pre [data-act="vconnect"]').count()) === 1 && !world.voice.length);
  await page.screenshot({ path: OUT + '/2j-voz-previa-cel.png' });
  await page.click('.vp.pre [data-act="vback"] >> nth=0');
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(250);
  // computador: clicar no canal entra direto, sem painel
  await page.click('[data-act="vjoin"]');
  await page.waitForSelector('.vbar', { timeout: 6000 });
  ok('computador: entra direto na chamada (sem painel) e mostra o cartão "Voz conectada" com 4 botões', (await page.locator('.vp').count()) === 0 && (await page.locator('.vbar .vbbs .vbb').count()) === 4 && /Voz conectada/.test(await page.textContent('.vbar')) && !!world.voice.length);
  await page.screenshot({ path: OUT + '/2j-voz-previa.png' });
  await page.click('[data-act="vjoin"]');
  await page.waitForSelector('.vp.call.desk .vt', { timeout: 6000 });
  ok('clicar no canal conectado abre a tela da chamada, com o cartão de convite (sozinho)', (await page.locator('.vp.call .vt').count()) === 1 && /Você/.test(await page.textContent('.vp.call .vt')) && /Convidar para voz/.test(await page.textContent('.vp.call .vcard')) && (await page.locator('.vdock .vdb').count()) === 8);
  await page.waitForSelector('.vbar', { timeout: 6000 });
  await page.waitForSelector('.xvu', { timeout: 6000 });
  ok('entrar na voz: barra "Voz conectada" e a pessoa aparece na sala', /Voz conectada/.test(await page.textContent('.vbar')) && /Tester/.test(await page.textContent('.xvg')));
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
  ok('mudo na chamada é enviado ao banco (voice_set_state)', (world.vcalls || []).some((c) => c.p_muted === true));
  // câmera: liga, avisa o banco e mostra o vídeo no bloco
  await page.click('.vp.call [data-act="vcam"]');
  await page.waitForSelector('.vp.call .vt video', { timeout: 8000 });
  ok('câmera: liga, avisa o banco e o vídeo aparece no seu bloco', (world.vcalls || []).some((c) => c.p_video === true) && (await page.locator('.vdb[data-act="vcam"][aria-pressed="true"]').count()) === 1);
  await page.click('.vp.call [data-act="vcam"]');
  await page.waitForFunction(() => !document.querySelector('.vp.call .vt video'), null, { timeout: 6000 });
  ok('câmera: desliga e volta a foto', (world.vcalls || []).some((c) => c.p_video === false));
  // efeitos sonoros: toca e avisa os outros
  await page.click('.vp.call [data-act="vfx"]');
  await page.click('.vfxp [data-act="vsfx"][data-id="bell"]');
  for (let i = 0; i < 20 && !wsIn.some((j) => j.event === 'broadcast' && j.payload && j.payload.event === 'sfx'); i++) await page.waitForTimeout(100);
  ok('efeito sonoro: mostra o emoji e avisa os outros pelo canal da sala', wsIn.some((j) => j.event === 'broadcast' && j.payload && j.payload.event === 'sfx' && j.payload.payload.id === 'bell'));
  // outra pessoa entra na sala: aparece o bloco dela
  world.voice.push({ channel_id: vch, user_id: 'u2', seen_at: new Date().toISOString(), muted: true, deafened: false, video: false, screen: false });
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'INSERT', table: 'voice_members', record: { channel_id: vch, user_id: 'u2' } } } }));
  await page.waitForFunction(() => document.querySelectorAll('.vp.call .vt').length === 2, null, { timeout: 6000 });
  ok('outra pessoa na chamada: segundo bloco, com o ícone de mudo dela, e o cartão de convite some', (await page.locator('.vp.call .vt .vbd').count()) === 1 && (await page.locator('.vp.call .vcard').count()) === 0);
  world.voice = world.voice.filter((r) => r.user_id === 'u1');
  await page.click('.vp.call [data-act="vback"] >> nth=0');
  await page.waitForSelector('.vbar');
  ok('voltar ao chat mantém a chamada (barra "Voz conectada" com Abrir)', (await page.locator('.vp').count()) === 0 && (await page.locator('.vbar [data-act="vopen"]').count()) === 1);
  await page.click('.vbar [data-act="vopen"]');
  await page.waitForSelector('.vp.call .vt');
  ok('Abrir na barra volta para a tela da chamada', true);
  await page.screenshot({ path: OUT + '/2j-voz.png' });
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250); await page.screenshot({ path: OUT + '/2j-voz-cel.png' }); ok('celular: a chamada não gera rolagem lateral', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)); await page.setViewportSize({ width: 1440, height: 900 });
  await page.click('.vp.call [data-act="vhang"]');
  await page.waitForFunction(() => !document.querySelector('.vbar') && !document.querySelector('.vp'), null, { timeout: 4000 });
  ok('sair da voz: avisa os outros ("bye") e limpa a sala', wsIn.some((j) => j.event === 'broadcast' && j.payload && j.payload.event === 'bye') && world.voice.length === 0);
  // etapa 8: banir e desbanir (só o dono do servidor)
  if (!(await page.locator('.banlnk').count())) await page.click('.x-ph [data-act="nav"][data-k="members"]');
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

  // amigos e conversas privadas (menu novo)
  await page.click('.x-rail .rt.home');
  await page.waitForSelector('#flist');
  ok('ícone da Square no trilho volta para Amigos', /Amigos/.test(await page.textContent('.x-tt')));
  await page.click('[data-act="ftab"][data-k="add"]');
  await page.fill('#af-user', '@Marina');
  await page.fill('#af-note', 'Oi, sou eu!');
  ok('contador da mensagem do pedido desce de 120', (await page.textContent('#af-cnt')) === String(120 - 'Oi, sou eu!'.length));
  await page.click('#af-send');
  await page.waitForFunction(() => /Pedido|pedido/.test((document.getElementById('toast') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  ok('pedido de amizade enviado pelo @usuário', world.friendships.length === 1 && world.friendships[0].requester === 'u1' && world.friendships[0].status === 'pending');
  ok('o pedido leva a mensagem opcional', world.friendships[0].note === 'Oi, sou eu!');
  await page.fill('#af-user', 'ninguemassim');
  await page.click('#af-send');
  await page.waitForFunction(() => /Não encontramos/.test((document.getElementById('toast') || {}).textContent || ''), null, { timeout: 5000 });
  ok('@usuário que não existe mostra erro em português', true);
  // o cartão de quem recebeu o pedido mostra "Cancelar pedido"
  await page.click(`.x-rail [data-act="srv-open"][data-id="${srvId}"]`);
  await page.waitForSelector('#msgs');
  await page.click('#msgs [data-act="profile"][data-id="u2"]');
  await page.waitForSelector('.pcard');
  ok('cartão de pedido enviado oferece cancelar', /Cancelar pedido/.test(await page.textContent('.mfoot')));
  await page.click('[data-act="modal-close"]');
  // Marina aceita (chega pelo tempo real)
  world.friendships[0].status = 'accepted';
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'UPDATE', table: 'friendships', record: { requester: 'u1', status: 'accepted' } } } }));
  await page.click('.x-rail .rt.home');
  await page.click('[data-act="ftab"][data-k="all"]');
  await page.waitForFunction(() => document.querySelectorAll('#flist .fr').length === 1, null, { timeout: 5000 });
  ok('amiga aceita aparece em Todos os amigos', /Marina Rocha/.test(await page.textContent('#flist')) && /Todos os amigos — 1/.test(await page.textContent('#flist')));
  await page.click('[data-act="ftab"][data-k="online"]');
  ok('aba Disponível mostra só quem está online', /Disponível — 1/.test(await page.textContent('#flist')));
  await page.click('[data-act="ftab"][data-k="all"]');
  await page.fill('#gsearch', 'zzz');
  ok('busca sem resultado', /Nenhum amigo/.test(await page.textContent('#flist')));
  await page.fill('#gsearch', 'marina');
  ok('busca filtra os amigos', (await page.locator('#flist .fr').count()) === 1);
  await page.fill('#gsearch', '');
  await page.click('#flist [data-act="fmenu"]');
  await page.waitForSelector('.pop.fm');
  ok('os três pontinhos do amigo abrem um menu com Ver perfil', /Ver perfil/.test(await page.textContent('.pop.fm')));
  await page.click('.pop.fm [data-act="profile"]');
  await page.waitForSelector('.pcard');
  ok('cartão de amigo oferece enviar mensagem e remover', /Enviar mensagem/.test(await page.textContent('.mfoot')) && /Remover amigo/.test(await page.textContent('.mfoot')));
  await page.click('[data-act="dm"]');
  await page.waitForSelector('.x-chat #msg', { timeout: 5000 });
  ok('Enviar mensagem abre a conversa privada', /Marina/.test(await page.textContent('.x-tt')) && /começo da sua conversa/.test(await page.textContent('#msgs')));
  await page.fill('#msg', 'Oi Marina, tudo bem?');
  await page.press('#msg', 'Enter');
  await page.waitForFunction(() => /Oi Marina, tudo bem/.test(document.getElementById('msgs').textContent));
  ok('conversa privada: mensagem enviada ao canal da conversa', world.messages.some((m) => /^dm/.test(m.channel_id) && m.content === 'Oi Marina, tudo bem?'));
  ok('a conversa aparece em Mensagens diretas', (await page.locator('.x-col .dmr[data-act="dm-open"]').count()) === 1);
  await page.screenshot({ path: OUT + '/2g-dm.png' });
  const dmId = world.dms[0].id;
  const rowdm = { id: world.nextMsg++, channel_id: dmId, author_id: 'u2', content: 'Tudo ótimo!', created_at: new Date().toISOString(), edited_at: null };
  world.messages.push(rowdm);
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'INSERT', table: 'messages', record: rowdm } } }));
  await page.waitForFunction(() => /Tudo ótimo/.test(document.getElementById('msgs').textContent), null, { timeout: 4000 });
  ok('resposta da amiga chega em tempo real na conversa privada', true);
  // pedido recebido: sino mostra e aceita
  world.friendships.push({ user_a: 'u1', user_b: 'u3', requester: 'u3', status: 'pending', note: 'Sou o Pedro' });
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'INSERT', table: 'friendships', record: { requester: 'u3', status: 'pending' } } } }));
  await page.waitForTimeout(700);
  await page.click('.x-ti [data-act="nav"][data-k="notif"]');
  await page.waitForSelector('.panel .it.req');
  ok('caixa de entrada mostra o pedido de amizade recebido', /Pedro Alves/.test(await page.textContent('.panel')));
  await page.click('.panel [data-act="fr-accept"]');
  await page.waitForTimeout(500);
  await page.click('[data-act="close-panel"]').catch(() => {});
  await page.click('.cn:has-text("Amigos")');
  await page.waitForFunction(() => document.querySelectorAll('#flist .fr').length === 2, null, { timeout: 5000 });
  ok('aceitar o pedido adiciona o novo amigo', world.friendships.every((f) => f.status === 'accepted'));
  // não lidas
  world.dms.push({ id: 'dm9', user: 'u3' });
  const rowp = { id: world.nextMsg++, channel_id: 'dm9', author_id: 'u3', content: 'E aí, Tester?', created_at: new Date().toISOString(), edited_at: null };
  world.messages.push(rowp);
  wsConn.send(JSON.stringify({ topic: 'realtime:sq', event: 'postgres_changes', payload: { data: { type: 'INSERT', table: 'messages', record: rowp } } }));
  await page.waitForSelector('.x-col .dmr .udot, #flist .udot', { timeout: 6000 });
  ok('bolinha de não lida aparece na conversa que chegou', (await page.locator('.rt.home .udot').count()) === 1);
  await page.click('#flist .fr:has(.udot) .fmain, .x-col .dmr:has(.udot)');
  await page.waitForFunction(() => /E aí, Tester/.test((document.getElementById('msgs') || {}).textContent || ''), null, { timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector('.udot'), null, { timeout: 5000 });
  ok('abrir a conversa apaga a bolinha', true);
  await page.click('.x-ph [data-act="profile"]');
  await page.waitForSelector('.blink');
  await page.click('.blink');
  await page.waitForSelector('.modal:has-text("Bloquear pessoa")');
  await page.click('[data-act="modal-submit"]');
  await page.waitForFunction(() => /Amigos/.test(document.querySelector('.x-tt').textContent), null, { timeout: 6000 });
  ok('bloquear remove a amizade e volta para Amigos', world.blocks.length === 1 && world.blocks[0].blocked === 'u3' && world.friendships.every((x) => x.user_a !== 'u3' && x.user_b !== 'u3'));
  await page.screenshot({ path: OUT + '/2i-bloqueado.png' });
  // celular
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(300);
  ok('menu no celular sem rolagem lateral', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok('no celular a coluna fica escondida atrás do botão de menu', (await page.isVisible('.x-burger')) && !(await page.locator('.x-left.open').count()));
  await page.screenshot({ path: OUT + '/2c-painel-celular.png' });
  await page.click('.x-burger');
  await page.waitForTimeout(400);
  ok('botão de menu abre a gaveta com trilho, coluna e barra do usuário', (await page.locator('.x-left.open').count()) === 1 && (await page.isVisible('.x-left .ub-me')));
  await page.screenshot({ path: OUT + '/2c-gaveta-celular.png' });
  await page.click('.x-bk', { position: { x: 370, y: 400 } });
  await page.setViewportSize({ width: 1440, height: 900 });
  ok('sessão salva', !!(await page.evaluate(() => localStorage.getItem('sq.session'))));

  // 4. recarregar mantém sessão
  await page.reload();
  await page.waitForSelector('.x .x-ph', { timeout: 5000 });
  ok('recarregar mantém a sessão', true);

  // 4b. configurações
  await page.click('.x-ub [data-act="settings"]');
  await page.waitForSelector('#setroot .set');
  ok('Configurações abrem pela engrenagem da barra do usuário', (await page.locator('#setroot .snavb').count()) >= 16 && /Informações da conta/.test(await page.textContent('#setroot .scontent')));
  const navText = await page.textContent('#setroot .snavl');
  ok('menu lateral tem Conta, Dados, Mensagens, Notificações, Plus, Voz, Aparência, Apps, Desenvolvedor e Sair', ['Conta', 'Dados e privacidade', 'Permissões de mensagens', 'Notificações', 'Square Plus', 'Impulso de servidor', 'Voz e vídeo', 'Aparência', 'Acessibilidade', 'Sistema', 'Idioma e Horário', 'Apps conectados', 'Desenvolvedor', 'Sair'].every((t) => new RegExp(t).test(navText)));
  ok('e-mail aparece escondido até clicar em Mostrar', /\*+@/.test(await page.textContent('#setroot .semail')));
  await page.click('#setroot [data-sa="show-email"]');
  ok('Mostrar revela o e-mail', !/\*{3}/.test(await page.textContent('#setroot .semail')));
  await page.fill('#sset-q', 'senha');
  ok('busca filtra o menu', (await page.locator('#setroot .snavb:not(.out)').count()) <= 3 && /Conta/.test(await page.textContent('#setroot .snavl')));
  await page.fill('#sset-q', '');
  await page.click('#setroot [data-sa="page"][data-id="access"]');
  await page.click('#setroot [data-k="chat_display"][data-v="compact"]');
  ok('Acessibilidade: modo compacto muda a tela na hora', await page.evaluate(() => document.documentElement.classList.contains('pf-compact')));
  await page.click('#setroot [data-k="reduce_motion"]');
  ok('movimento reduzido liga a classe', await page.evaluate(() => document.documentElement.classList.contains('pf-reduce')));
  await page.waitForFunction(() => true); await page.waitForTimeout(1200);
  ok('preferências são salvas na conta', world.saved.length >= 1 && world.settings.chat_display === 'compact' && world.settings.reduce_motion === true);
  ok('preferências ficam no navegador', await page.evaluate(() => /compact/.test(Object.keys(localStorage).filter((k) => k.indexOf('sq.prefs.') === 0).map((k) => localStorage.getItem(k)).join(''))));
  await page.click('#setroot [data-sa="page"][data-id="voice"]');
  await page.click('#setroot [data-k="input_profile"][data-v="studio"]');
  ok('perfil Estúdio desliga eco, ruído e ganho no microfone', await page.evaluate(() => { const c = window.SQ_SET.audioConstraints(); return c.echoCancellation === false && c.noiseSuppression === false && c.autoGainControl === false; }));
  await page.click('#setroot [data-sa="page"][data-id="account"]');
  await page.click('#setroot [data-sa="ed-user"]'); await page.waitForSelector('#setroot .smodal #u-in');
  await page.fill('#u-in', 'novo.nome'); await page.click('#setroot [data-sa="save-user"]');
  await page.waitForFunction(() => !document.querySelector('#setroot .smodal'));
  ok('trocar @usuário chama o banco', world.usernameCalls[0] === 'novo.nome');
  await page.click('#setroot [data-sa="ed-email"]'); await page.waitForSelector('#setroot .smodal #em-new');
  await page.fill('#em-new', 'novo@exemplo.com'); await page.fill('#em-pw', 'Senha1234!'); await page.click('#setroot [data-sa="em-send"]');
  await page.waitForSelector('#setroot .smodal #em-code');
  await page.fill('#em-code', 'ABC234'); await page.click('#setroot [data-sa="em-ok"]');
  await page.waitForFunction(() => !document.querySelector('#setroot .smodal'));
  ok('trocar e-mail: pede código e confirma no servidor', calls.some((c) => c[1] === '/email/change/request' && c[2].new_email === 'novo@exemplo.com') && calls.some((c) => c[1] === '/email/change/confirm' && c[2].code === 'ABC234'));
  await page.click('#setroot [data-sa="ed-mfa"]'); await page.waitForSelector('#setroot .smodal [data-sa="mfa-start"]');
  ok('2 etapas desligada oferece "Ligar"', true);
  await page.click('#setroot [data-sa="modal-close"]');
  await page.click('#setroot [data-sa="deact"]'); await page.waitForSelector('#setroot .smodal #da-pw');
  await page.fill('#da-pw', 'errada'); await page.click('#setroot [data-sa="deact-ok"]');
  await page.waitForFunction(() => /Senha incorreta/.test((document.getElementById('da-err') || {}).textContent || ''));
  ok('desativar conta com senha errada mostra erro', true);
  await page.click('#setroot [data-sa="modal-close"]');
  await page.click('#setroot [data-sa="page"][data-id="plus"]'); await page.click('#setroot .splus-hero [data-sa="pay"]');
  await page.waitForSelector('#toast .toast');
  ok('Square Plus: pagamento avisa que ainda não existe', /ainda não/.test(await page.textContent('#toast')));
  await page.keyboard.press('Escape');
  ok('Esc fecha as Configurações', (await page.locator('#setroot .set').count()) === 0);

  // solicitação de mensagem de quem não é amigo
  world.profiles.push({ id: 'u9', username: 'estranho', display_name: 'Estranho Nove', bio: '', status_text: '', accent: '#9D8CCF', last_seen: null, created_at: '2026-11-10T10:00:00Z' });
  world.dms.push({ id: 'dmreq', user: 'u9', req: true });
  await page.evaluate(() => window.SQ_API.reload());
  await page.click('.x-rail .rt.home').catch(() => {});
  await page.waitForSelector('.dmrq', { timeout: 6000 });
  ok('solicitação de mensagem aparece em "Solicitações de mensagens"', /Solicitações de mensagens/.test(await page.textContent('.x-col')) && /Estranho Nove/.test(await page.textContent('.dmrq')));
  await page.click('.dmrq [data-act="dmreq"][data-ok="1"]');
  await page.waitForFunction(() => !document.querySelector('.dmrq') && /Estranho Nove/.test(document.querySelector('.x-col').textContent), null, { timeout: 6000 });
  ok('aceitar a solicitação chama o banco e move a conversa para a lista', world.dmResp && world.dmResp[0] === 'dmreq' && world.dmResp[1] === true);

  // 5. logout
  await page.click('.x-ub [data-act="settings"]');
  await page.waitForSelector('#setroot .set');
  await page.click('#setroot [data-sa="logout"]');
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
  await page.waitForSelector('.x .x-ph', { timeout: 5000 });
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
