(() => {
'use strict';

/* =====================================================================
   Square. — site real: acesso à conta (cadastro com código, login, QR Code,
   recuperação de senha) + tela principal.
   Backend: Supabase Edge Function "auth" + Supabase Auth/PostgREST.
   ===================================================================== */

const C = window.SQ_CONFIG;
const BRAND = 'Square.';
const $root = document.getElementById('root');

/* ---------------------------------------------------------------- util */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
const userOk = (v) => /^[A-Za-z0-9._]{3,20}$/.test(String(v).trim());
const normCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

const mem = {};
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v == null ? (mem[k] ?? null) : JSON.parse(v); } catch (e) { return mem[k] ?? null; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
  del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) { /* sem armazenamento */ } }
};
const tab = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ok */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ok */ } }
};

async function api(path, body, token) {
  let res;
  try {
    res = await fetch(C.FN + path, {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body || {})
    });
  } catch (e) {
    throw { error: 'network', message: 'Sem conexão. Verifique sua internet e tente de novo.' };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign({ status: res.status }, data && data.error ? data : { error: 'server_error', message: 'Algo deu errado. Tente de novo em instantes.' });
  }
  return data;
}

function toast(text) {
  const el = document.getElementById('toast');
  el.innerHTML = `<div class="toast" role="status">${esc(text)}</div>`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.innerHTML = ''; }, 2400);
}

/* --------------------------------------------------------------- icons */
const ic = (d, s = 18, c = '#55555F', w = 1.7) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const D = {
  bubble: '<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3.5 7.5 8.5 6 8.5-6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  gamepad: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4M15.5 11.5h.01M18 13.5h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  micOff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/>',
  head: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  leave: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.3c2.2.7 3.5 2.6 3.5 5.7"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  help: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><path d="M12 17h.01"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  dm: '<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 9h8M8 12.5h5"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M7.5 8a2.5 2.5 0 1 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 1 1 0 5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  dots: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>',
  prev: '<path d="M6 5v14M18 5.5v13L8.5 12z"/>',
  next: '<path d="M18 5v14M6 5.5v13l9.5-6.5z"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  userPlus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6 1.4 0 2.6.3 3.7.9M18 14v6M15 17h6"/>',
  chevL: '<path d="m15 6-6 6 6 6"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  clip: '<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.2 17.2a1.7 1.7 0 0 1-2.4-2.4L14.5 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
const logoMark = (s = 18) => ic(D.bubble, s, '#FFFFFF', 1.8);
const logo = (s = 18) => `<span class="logo" aria-hidden="true">${logoMark(s)}</span>`;

/* --------------------------------------------------------------- state */
const freshR = () => ({ email: '', display: '', user: '', pass: '', day: '', month: '', year: '', opt: false, terms: false, show: false, touched: false, srv: {}, busy: false, err: '' });
const freshV = () => ({ code: '', err: '', notice: '', busy: false, coolUntil: 0 });
const freshF = () => ({ email: '', touched: false, busy: false, err: '', notice: '' });
const freshN = () => ({ email: '', code: '', manual: false, pass: '', conf: '', show: false, touched: false, busy: false, err: '' });

const S = {
  view: '', session: null, profile: null, after: null,
  lId: '', lPw: '', lShow: false, lTouched: false, lErr: '', lBusy: false,
  qr: null,
  r: freshR(), pendingEmail: tab.get('sq.pending') || '', v: freshV(), f: freshF(), n: freshN(),
  ap: null
};
let timers = { qrPoll: null, qrClock: null, resend: null };

/* ------------------------------------------------------------- sessão */
function saveSession(d) {
  const s = d.session;
  S.session = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: d.user || s.user || null };
  store.set('sq.session', S.session);
  if (d.profile) { S.profile = d.profile; store.set('sq.profile', S.profile); }
}
function clearSession() {
  S.session = null; S.profile = null;
  store.del('sq.session'); store.del('sq.profile');
}
async function freshToken() {
  const s = S.session;
  if (!s) return null;
  if (s.expires_at - Date.now() / 1000 > 60) return s.access_token;
  try {
    const r = await fetch(C.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { apikey: C.SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    });
    if (r.status === 400 || r.status === 401 || r.status === 403) { clearSession(); return null; }
    if (!r.ok) return s.access_token;
    const j = await r.json();
    S.session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + j.expires_in, user: { id: j.user.id, email: j.user.email } };
    store.set('sq.session', S.session);
    return j.access_token;
  } catch (e) { return s.access_token; }
}
async function loadProfile() {
  const t = await freshToken();
  if (!t) return;
  try {
    const r = await fetch(C.SUPABASE_URL + '/rest/v1/profiles?select=username,display_name&limit=1', { headers: { apikey: C.SUPABASE_KEY, authorization: 'Bearer ' + t, accept: 'application/json' } });
    if (!r.ok) return;
    const rows = await r.json();
    if (rows && rows[0]) { S.profile = rows[0]; store.set('sq.profile', S.profile); }
  } catch (e) { /* mantém o que já temos */ }
}
async function logout() {
  const tok = S.session && S.session.access_token;
  clearSession();
  S.lId = ''; S.lPw = ''; S.lTouched = false; S.lErr = '';
  go('login');
  if (tok) fetch(C.SUPABASE_URL + '/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: C.SUPABASE_KEY, authorization: 'Bearer ' + tok } }).catch(() => {});
}
const displayName = () => (S.profile && S.profile.display_name) || (S.session && S.session.user && S.session.user.email ? S.session.user.email.split('@')[0] : 'Você');

async function onSignedIn(d) {
  saveSession(d);
  S.lPw = ''; S.lBusy = false; S.lErr = '';
  S.r = freshR(); S.v = freshV(); S.pendingEmail = ''; tab.del('sq.pending');
  A = null; // depois de entrar, a tela principal é sempre o painel inicial
  if (S.after) { const a = S.after; S.after = null; go(a); } else go('app');
}

/* ---------------------------------------------------------- navegação */
const AUTH_ONLY = ['login', 'register', 'verify', 'forgot', 'forgotSent'];
function parseHash() {
  const h = location.hash.replace(/^#/, '');
  const i = h.indexOf('?');
  return { name: i < 0 ? h : h.slice(0, i), q: new URLSearchParams(i < 0 ? '' : h.slice(i + 1)) };
}
function go(name) {
  const h = '#' + name;
  if (location.hash === h) route(); else location.hash = h;
}
function stopTimers() {
  clearInterval(timers.qrPoll); clearInterval(timers.qrClock); clearInterval(timers.resend);
  timers = { qrPoll: null, qrClock: null, resend: null };
  stopAppTimers();
}
function route() {
  stopTimers();
  const { name, q } = parseHash();
  const authed = !!S.session;
  let view = 'login';
  switch (name) {
    case '': view = authed ? 'app' : 'home'; break;
    case 'home': view = 'home'; break;
    case 'register': view = 'register'; break;
    case 'verify': view = S.pendingEmail ? 'verify' : 'login'; break;
    case 'forgot': view = 'forgot'; break;
    case 'forgot-sent': view = S.f.email ? 'forgotSent' : 'forgot'; break;
    case 'reset': {
      S.n = Object.assign(freshN(), { email: (q.get('e') || '').trim().toLowerCase(), code: normCode(q.get('c')) });
      history.replaceState(null, '', location.pathname + '#new-password');
      view = S.n.email && S.n.code ? 'newPass' : 'forgot';
      break;
    }
    case 'new-password': view = S.n.email ? 'newPass' : 'forgot'; break;
    case 'done': view = authed ? 'passDone' : 'login'; break;
    case 'qr': {
      const id = q.get('id'), s = q.get('s');
      if (id && s) { S.ap = { id, s, state: 'loading', device: '', err: '' }; history.replaceState(null, '', location.pathname + '#qr'); }
      if (!S.ap) { view = authed ? 'app' : 'login'; break; }
      if (!authed) { S.after = 'qr'; history.replaceState(null, '', location.pathname + '#login'); view = 'login'; break; }
      view = 'approve';
      break;
    }
    case 'app': view = authed ? 'app' : 'login'; break;
    default: view = 'login';
  }
  if (authed && AUTH_ONLY.includes(view)) { go('app'); return; }
  S.view = view;
  if (view === 'app') { initApp(); startMusic(); }
  render({ top: true });
  setTimeout(() => { const el = document.querySelector('[data-autofocus]'); if (el) el.focus(); }, 0);
  if (view === 'login') qrEnsure();
  if (view === 'verify') startResendTick();
  if (view === 'approve') loadApprove();
}

/* ------------------------------------------------------------- render */
function render(o = {}) {
  const ae = document.activeElement;
  const snap = {
    id: ae && ae.id && $root.contains(ae) ? ae.id : null,
    s: ae && typeof ae.selectionStart === 'number' ? [ae.selectionStart, ae.selectionEnd] : null,
    scroll: {}
  };
  ['msgs', 'hmsgs', 'sscroll', 'mlist', 'flist'].forEach((id) => { const el = document.getElementById(id); if (el) snap.scroll[id] = el.scrollTop; });
  const views = { home: homeView, login: loginView, register: registerView, verify: verifyView, forgot: forgotView, forgotSent: forgotSentView, newPass: newPassView, passDone: passDoneView, approve: approveView, app: appView };
  $root.innerHTML = (views[S.view] || loginView)();
  if (o.top) window.scrollTo(0, 0);
  Object.keys(snap.scroll).forEach((id) => { const el = document.getElementById(id); if (el) el.scrollTop = snap.scroll[id]; });
  if (o.scroll) { ['msgs', 'hmsgs'].forEach((id) => { const el = document.getElementById(id); if (el) el.scrollTop = el.scrollHeight; }); }
  if (snap.id && !o.top) {
    const el = document.getElementById(snap.id);
    if (el) { el.focus(); if (snap.s && el.setSelectionRange) { try { el.setSelectionRange(snap.s[0], snap.s[1]); } catch (e) { /* tipo sem seleção */ } } }
  }
  if (S.view === 'app' && A && A.world === 'ready') ensureThread(curKey());
  if (S.view === 'app' && A) updateTyping();
}

/* ----------------------------------------------------- peças de acesso */
const shell = (inner) => `<div class="au"><div class="glow g1" aria-hidden="true"></div><div class="glow g2" aria-hidden="true"></div><div class="glow g3" aria-hidden="true"></div>
<header><a class="pill" href="#home" aria-label="${BRAND} — voltar ao início">${logo(18)}${BRAND}</a></header><main>${inner}</main></div>`;

function pwField(id, bind, value, show, bad, auto) {
  return `<div class="pw"><input id="${id}" class="inp${bad ? ' bad' : ''}" type="${show ? 'text' : 'password'}" data-bind="${bind}" value="${esc(value)}" autocomplete="${auto}" aria-invalid="${!!bad}">
<button type="button" class="hov" data-act="toggle-pw" data-target="${id}" data-bind-show="${bind}" aria-label="${show ? 'Ocultar senha' : 'Mostrar senha'}">${show ? 'Ocultar' : 'Mostrar'}</button></div>`;
}
const textField = (id, label, bind, value, o = {}) => `<div class="field">
<label class="lbl" for="${id}">${label}${o.req ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
<input id="${id}" class="inp${o.err ? ' bad' : ''}" type="${o.type || 'text'}" data-bind="${bind}" value="${esc(value)}" placeholder="${esc(o.ph || '')}" autocomplete="${o.auto || 'off'}" autocapitalize="none" spellcheck="false" ${o.focus ? 'data-autofocus' : ''} aria-invalid="${!!o.err}">
${o.err ? `<div class="err" role="alert">${esc(o.err)}</div>` : ''}</div>`;
const alertBox = (m) => (m ? `<div class="alert" role="alert">${esc(m)}</div>` : '');
const submitBtn = (busy, text, busyText) => `<button type="submit" class="btn"${busy ? ' disabled' : ''}>${busy ? busyText : text}</button>`;

/* ----- home (página inicial; HTML gerado por tools/build-home.js em site/home.js) ----- */
function homeView() { return window.SQ_HOME || ''; }

/* ----- login ----- */
function loginView() {
  const idBad = S.lTouched && !S.lId.trim();
  const pwBad = S.lTouched && !S.lPw;
  return shell(`<section class="card wide" aria-labelledby="t-login">
<form class="stack grow" data-form="login" novalidate>
  <div class="center"><h1 id="t-login" class="ttl big">Boas-vindas de volta!</h1><p class="lead">Que bom ver você por aqui de novo.</p></div>
  ${S.after === 'qr' ? '<div class="info" role="status">Entre na sua conta para autorizar o login no outro dispositivo.</div>' : ''}
  <div class="field">
    <label class="lbl" for="login-id">E-mail ou nome de usuário <span class="req" aria-hidden="true">*</span></label>
    <input id="login-id" class="inp${idBad ? ' bad' : ''}" type="text" data-bind="lId" value="${esc(S.lId)}" autocomplete="username" autocapitalize="none" spellcheck="false" data-autofocus aria-invalid="${idBad}">
    ${idBad ? '<div class="err" role="alert">Informe seu e-mail ou nome de usuário.</div>' : ''}
  </div>
  <div class="field">
    <label class="lbl" for="login-pw">Senha <span class="req" aria-hidden="true">*</span></label>
    ${pwField('login-pw', 'lPw', S.lPw, S.lShow, pwBad, 'current-password')}
    ${pwBad ? '<div class="err" role="alert">Informe sua senha.</div>' : ''}
    <button type="button" class="lnk sl" data-act="to-forgot">Esqueceu sua senha?</button>
  </div>
  ${alertBox(S.lErr)}
  ${submitBtn(S.lBusy, 'Entrar', 'Entrando…')}
  <div class="small">Precisando de uma conta? <button type="button" class="lnk" data-act="to-register">Registre-se</button></div>
</form>
<div class="qrcol">
  <div id="qr-box">${qrBoxHTML()}</div>
  <h2>Entrar com código QR</h2>
  <p>Escaneie com a câmera de um celular em que você já está conectado e entre na hora, sem digitar a senha.</p>
</div>
</section>`);
}

/* ----- registro ----- */
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function dobParts(r) {
  const d = +r.day, m = +r.month, y = +r.year;
  if (!d || !m || !y) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || dt.getTime() > Date.now()) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function regErrors() {
  const r = S.r, e = {};
  if (!validEmail(r.email)) e.email = 'Informe um e-mail válido, como nome@exemplo.com.';
  if (!userOk(r.user)) e.user = 'Use de 3 a 20 letras, números, ponto ou sublinhado.';
  if (r.pass.length < 8) e.pass = 'Use pelo menos 8 caracteres.';
  const dob = dobParts(r);
  if (!dob) e.dob = 'Informe uma data de nascimento válida.';
  else { const t = new Date(), cut = (t.getFullYear() - 13) + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); if (dob > cut) e.dob = 'É preciso ter pelo menos 13 anos para criar uma conta.'; }
  if (!r.terms) e.terms = 'Aceite os Termos de Uso e a Política de Privacidade para continuar.';
  return e;
}
function registerView() {
  const r = S.r;
  const e = r.touched ? Object.assign({}, regErrors(), r.srv) : Object.assign({}, r.srv);
  const opts = (list, val) => list.map((o) => `<option value="${o.v}"${String(val) === o.v ? ' selected' : ''}>${o.l}</option>`).join('');
  const days = Array.from({ length: 31 }, (_, i) => ({ v: String(i + 1), l: String(i + 1) }));
  const months = MONTHS.map((n, i) => ({ v: String(i + 1), l: n.charAt(0).toUpperCase() + n.slice(1) }));
  const years = []; for (let y = new Date().getFullYear(); y >= 1920; y--) years.push({ v: String(y), l: String(y) });
  const passMsg = e.pass ? ' bad' : '';
  return shell(`<section class="card" aria-labelledby="t-reg">
<form class="stack" data-form="register" novalidate>
  <h1 id="t-reg" class="ttl center">Criar uma conta</h1>
  ${textField('r-email', 'E-mail', 'r.email', r.email, { req: true, ph: 'voce@exemplo.com', err: e.email, auto: 'email', type: 'email', focus: true })}
  ${textField('r-display', 'Nome exibido', 'r.display', r.display, { ph: 'Como você quer ser chamado', auto: 'nickname' })}
  ${textField('r-user', 'Nome de usuário', 'r.user', r.user, { req: true, ph: 'seu.usuario', err: e.user, auto: 'username' })}
  <div class="field">
    <label class="lbl" for="r-pass">Senha <span class="req" aria-hidden="true">*</span></label>
    ${pwField('r-pass', 'r.pass', r.pass, r.show, e.pass, 'new-password')}
    <div class="hint${passMsg}" id="r-hint">Use pelo menos 8 caracteres.</div>
  </div>
  <div class="field">
    <span class="lbl" id="dob-label">Data de nascimento <span class="req" aria-hidden="true">*</span></span>
    <div class="dob${e.dob ? ' bad' : ''}" role="group" aria-labelledby="dob-label">
      <select id="r-day" aria-label="Dia" data-bind="r.day"><option value="">Dia</option>${opts(days, r.day)}</select>
      <select id="r-month" aria-label="Mês" data-bind="r.month"><option value="">Mês</option>${opts(months, r.month)}</select>
      <select id="r-year" aria-label="Ano" data-bind="r.year"><option value="">Ano</option>${opts(years, r.year)}</select>
    </div>
    ${e.dob ? `<div class="err" role="alert">${esc(e.dob)}</div>` : ''}
  </div>
  <div class="chk"><input id="r-opt" type="checkbox" data-bind="r.opt"${r.opt ? ' checked' : ''}><label for="r-opt">(Opcional) Pode me mandar e-mails com novidades, dicas e ofertas especiais. Você pode mudar isso a qualquer momento.</label></div>
  <div class="chk"><input id="r-terms" type="checkbox" data-bind="r.terms"${r.terms ? ' checked' : ''}><label for="r-terms">Li e aceito os <a href="/termos" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</a>. Tenho pelo menos 13 anos.</label></div>
  ${e.terms ? `<div class="err" role="alert">${esc(e.terms)}</div>` : ''}
  ${alertBox(r.err)}
  ${submitBtn(r.busy, 'Criar conta', 'Criando conta…')}
  <div class="small">Já tem uma conta? <button type="button" class="lnk" data-act="to-login">Entre aqui</button></div>
</form></section>`);
}

/* ----- verificação do cadastro ----- */
function otpBoxes(code) { return [0, 1, 2, 3, 4, 5].map((i) => `<b class="${i === code.length && code.length < 6 ? 'cur' : ''}">${esc(code.charAt(i))}</b>`).join(''); }
function verifyView() {
  const v = S.v;
  return shell(`<section class="card" aria-labelledby="t-verify">
<form class="stack g20" data-form="verify" novalidate>
  <div class="head"><span class="ico">${ic(D.mail, 26, '#44444C', 1.6)}</span>
    <h1 id="t-verify" class="ttl">Confirme seu e-mail</h1>
    <p>Enviamos um código de 6 caracteres, com letras e números, para <strong>${esc(S.pendingEmail)}</strong>.</p></div>
  <div class="field" style="gap:10px">
    <label class="lbl center" for="otp">Código de verificação</label>
    <div class="otp${v.err ? ' bad' : ''}" id="otp-wrap">${otpBoxes(v.code)}<input id="otp" type="text" data-bind="v.code" value="${esc(v.code)}" maxlength="12" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" inputmode="text" data-autofocus aria-invalid="${!!v.err}"></div>
    <div id="otp-msg">${v.err ? `<div class="err center" role="alert">${esc(v.err)}</div>` : ''}${v.notice ? `<div class="hint center" role="status">${esc(v.notice)}</div>` : ''}</div>
  </div>
  ${submitBtn(v.busy, 'Verificar e entrar', 'Verificando…')}
  <div class="row"><span>Não chegou? <button type="button" class="lnk" id="resend" data-act="resend">Reenviar código</button></span>
    <button type="button" class="lnk" data-act="to-register">Usar outro e-mail</button></div>
</form></section>`);
}
function paintOtp() {
  const wrap = document.getElementById('otp-wrap');
  if (!wrap) return;
  const bs = wrap.querySelectorAll('b');
  bs.forEach((b, i) => { b.textContent = S.v.code.charAt(i); b.className = i === S.v.code.length && S.v.code.length < 6 ? 'cur' : ''; });
  wrap.classList.toggle('bad', !!S.v.err);
  const msg = document.getElementById('otp-msg');
  if (msg) msg.innerHTML = S.v.err ? `<div class="err center" role="alert">${esc(S.v.err)}</div>` : (S.v.notice ? `<div class="hint center" role="status">${esc(S.v.notice)}</div>` : '');
}
function startResendTick() {
  clearInterval(timers.resend);
  const tick = () => {
    const b = document.getElementById('resend');
    if (!b) return;
    const left = Math.ceil((S.v.coolUntil - Date.now()) / 1000);
    if (left > 0) { b.disabled = true; b.textContent = `Reenviar em ${left}s`; } else { b.disabled = false; b.textContent = 'Reenviar código'; }
  };
  tick();
  timers.resend = setInterval(tick, 1000);
}

/* ----- esqueci a senha ----- */
function forgotView() {
  const f = S.f; const bad = f.touched && !validEmail(f.email);
  return shell(`<section class="card" aria-labelledby="t-forgot">
<form class="stack g20" data-form="forgot" novalidate>
  <div class="head"><h1 id="t-forgot" class="ttl">Esqueceu a senha?</h1><p>Digite o e-mail da sua conta. Vamos enviar um código de verificação para ele.</p></div>
  ${textField('f-email', 'E-mail', 'f.email', f.email, { req: true, ph: 'voce@exemplo.com', err: bad ? 'Informe o e-mail cadastrado, no formato nome@exemplo.com.' : '', auto: 'email', type: 'email', focus: true })}
  ${alertBox(f.err)}
  ${submitBtn(f.busy, 'Enviar código', 'Enviando…')}
  <button type="button" class="lnk sc" data-act="to-login">Voltar ao login</button>
</form></section>`);
}
function forgotSentView() {
  const f = S.f;
  return shell(`<section class="card stack g20" aria-labelledby="t-sent">
  <div class="head"><span class="ico">${ic(D.mail, 26, '#44444C', 1.6)}</span>
    <h1 id="t-sent" class="ttl">Confira seu e-mail</h1>
    <p>Se existir uma conta com <strong>${esc(f.email)}</strong>, enviamos uma mensagem com o código de verificação e o botão para redefinir a senha.</p></div>
  ${f.notice ? `<div class="hint center" role="status">${esc(f.notice)}</div>` : ''}
  <button type="button" class="btn" data-act="manual-code">Já tenho o código</button>
  <div class="row"><span>Não chegou? <button type="button" class="lnk" data-act="resend-reset">Reenviar e-mail</button></span>
    <button type="button" class="lnk" data-act="to-login">Voltar ao login</button></div>
</section>`);
}

/* ----- nova senha ----- */
function newPassView() {
  const n = S.n;
  const lenOk = n.pass.length >= 8, matchOk = n.pass !== '' && n.pass === n.conf;
  const passBad = n.touched && !lenOk, confBad = n.touched && !matchOk;
  return shell(`<section class="card" aria-labelledby="t-new">
<form class="stack" data-form="newpass" novalidate>
  <div class="head"><h1 id="t-new" class="ttl">Criar nova senha</h1><p>Escolha uma senha nova para a sua conta${n.email ? ` <strong>${esc(n.email)}</strong>` : ''}.</p></div>
  ${n.manual ? `<div class="field"><label class="lbl" for="n-code">Código recebido por e-mail <span class="req" aria-hidden="true">*</span></label>
    <input id="n-code" class="inp${n.touched && n.code.length < 6 ? ' bad' : ''}" type="text" data-bind="n.code" value="${esc(n.code)}" maxlength="12" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="6 caracteres" data-autofocus></div>` : ''}
  <div class="field"><label class="lbl" for="n-pass">Nova senha <span class="req" aria-hidden="true">*</span></label>
    ${pwField('n-pass', 'n.pass', n.pass, n.show, passBad, 'new-password')}</div>
  <div class="field"><label class="lbl" for="n-conf">Confirmar nova senha <span class="req" aria-hidden="true">*</span></label>
    <input id="n-conf" class="inp${confBad ? ' bad' : ''}" type="${n.show ? 'text' : 'password'}" data-bind="n.conf" value="${esc(n.conf)}" autocomplete="new-password" aria-invalid="${confBad}" ${n.manual ? '' : 'data-autofocus'}></div>
  <ul class="rules" aria-label="Requisitos da senha">
    <li id="rule-len" class="${lenOk ? 'on' : ''}"><i aria-hidden="true"></i>Pelo menos 8 caracteres</li>
    <li id="rule-match" class="${matchOk ? 'on' : ''}"><i aria-hidden="true"></i>As duas senhas são iguais</li>
  </ul>
  ${alertBox(n.err)}
  ${n.err ? '<button type="button" class="lnk sc" data-act="to-forgot">Pedir um novo código</button>' : ''}
  ${submitBtn(n.busy, 'Salvar nova senha', 'Salvando…')}
</form></section>`);
}
function paintRules() {
  const n = S.n;
  const a = document.getElementById('rule-len'), b = document.getElementById('rule-match');
  if (a) a.className = n.pass.length >= 8 ? 'on' : '';
  if (b) b.className = n.pass !== '' && n.pass === n.conf ? 'on' : '';
}
function passDoneView() {
  return shell(`<section class="card stack g20" aria-labelledby="t-done">
  <div class="head"><span class="ico ok">${ic(D.check, 26, '#1B6B47', 2)}</span>
    <h1 id="t-done" class="ttl">Senha atualizada</h1><p>Tudo certo. Agora você já pode acessar a sua conta.</p></div>
  <button type="button" class="btn" data-act="to-app" data-autofocus>Acessar minha conta</button>
</section>`);
}

/* ----- autorizar login por QR (dispositivo já conectado) ----- */
function approveView() {
  const a = S.ap || {};
  let inner;
  if (a.state === 'loading') inner = '<div class="spin" role="status" aria-label="Carregando"></div>';
  else if (a.state === 'ask') {
    inner = `<div class="head"><span class="ico">${ic(D.at, 26, '#44444C', 1.6)}</span>
      <h1 class="ttl">Entrar em outro dispositivo?</h1>
      <p>Alguém está tentando entrar na ${BRAND} como <strong>${esc(displayName())}</strong> a partir de <strong>${esc(a.device)}</strong>. Só autorize se foi você.</p></div>
      ${alertBox(a.err)}
      <button type="button" class="btn" data-act="qr-approve"${a.busy ? ' disabled' : ''}>${a.busy ? 'Autorizando…' : 'Autorizar login'}</button>
      <button type="button" class="lnk sc" data-act="qr-deny">Não fui eu, negar</button>`;
  } else if (a.state === 'done') {
    inner = `<div class="head"><span class="ico ok">${ic(D.check, 26, '#1B6B47', 2)}</span><h1 class="ttl">Login autorizado</h1><p>Pronto! O outro dispositivo já deve estar entrando na sua conta.</p></div>
      <button type="button" class="btn ghost" data-act="to-app">Ir para o app</button>`;
  } else if (a.state === 'denied') {
    inner = `<div class="head"><span class="ico">${ic(D.close, 24, '#B3261E', 2)}</span><h1 class="ttl">Login negado</h1><p>Tudo bem, ninguém entrou na sua conta. Se não foi você, vale trocar a sua senha.</p></div>
      <button type="button" class="btn ghost" data-act="to-app">Ir para o app</button>`;
  } else {
    inner = `<div class="head"><span class="ico">${ic(D.close, 24, '#B3261E', 2)}</span><h1 class="ttl">Código expirado</h1><p>${esc(a.err || 'Esse QR Code expirou ou já foi usado. Gere um novo na tela de login do outro dispositivo.')}</p></div>
      <button type="button" class="btn ghost" data-act="to-app">Ir para o app</button>`;
  }
  return shell(`<section class="card stack g20" aria-live="polite">${inner}</section>`);
}
async function loadApprove() {
  const a = S.ap; if (!a) return;
  try {
    const d = await api('/qr/info', { id: a.id, approve_secret: a.s });
    a.state = 'ask'; a.device = d.device; a.err = '';
  } catch (e) { a.state = 'gone'; a.err = e.message; }
  if (S.view === 'approve') render();
}
async function decideApprove(decision) {
  const a = S.ap; if (!a || a.busy) return;
  a.busy = true; a.err = ''; render();
  try {
    const tok = await freshToken();
    if (!tok) { S.after = 'qr'; go('login'); return; }
    await api('/qr/approve', { id: a.id, approve_secret: a.s, decision }, tok);
    a.state = decision === 'deny' ? 'denied' : 'done';
  } catch (e) {
    if (e.error === 'expired' || e.status === 410) { a.state = 'gone'; a.err = e.message; } else a.err = e.message;
  }
  a.busy = false;
  if (S.view === 'approve') render();
}

/* ----------------------------------------------------------------- QR */
function qrSvg(text) {
  const m = window.SquareQR.matrix(text, 'M');
  const n = m.length, q = 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) d += `M${c + q} ${r + q}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" shape-rendering="crispEdges" role="img" aria-label="Código QR para entrar"><path d="${d}" fill="#1D1D22"/></svg>`;
}
function qrBoxHTML() {
  const q = S.qr || { state: 'loading' };
  let inner;
  if (q.state === 'ready') {
    try { inner = qrSvg(q.url) + `<div class="qrlogo" aria-hidden="true"><span>${logoMark(16)}</span></div>`; } catch (e) { q.state = 'error'; }
  }
  if (q.state === 'loading') inner = '<div class="spin" role="status" aria-label="Gerando código"></div>';
  else if (q.state !== 'ready') {
    const msg = q.state === 'denied' ? 'Login recusado no outro dispositivo.' : q.state === 'error' ? 'Não foi possível gerar o código.' : 'Este código expirou.';
    inner = `<div class="qrover"><span>${msg}</span><button type="button" data-act="qr-new">Gerar novo código</button></div>`;
  }
  return `<div class="qrbox">${inner}</div>`;
}
function paintQr() { const el = document.getElementById('qr-box'); if (el) el.innerHTML = qrBoxHTML(); }
function qrEnsure() {
  const q = S.qr;
  if (q && q.state === 'ready' && Date.now() < q.exp - 10000) { qrWatch(); paintQr(); return; }
  qrStart();
}
async function qrStart() {
  clearInterval(timers.qrPoll); clearInterval(timers.qrClock);
  S.qr = { state: 'loading' }; paintQr();
  try {
    const d = await api('/qr/create', {});
    S.qr = { state: 'ready', id: d.id, poll: d.poll_secret, url: d.url, exp: Date.now() + d.ttl * 1000 };
    if (S.view !== 'login') return;
    paintQr(); qrWatch();
  } catch (e) { S.qr = { state: 'error' }; paintQr(); }
}
function qrWatch() {
  clearInterval(timers.qrPoll); clearInterval(timers.qrClock);
  timers.qrPoll = setInterval(qrTick, 2000);
  timers.qrClock = setInterval(() => { if (S.qr && S.qr.state === 'ready' && Date.now() > S.qr.exp) { qrStop('expired'); } }, 1000);
}
function qrStop(state) { clearInterval(timers.qrPoll); clearInterval(timers.qrClock); if (S.qr) S.qr.state = state; paintQr(); }
let qrBusy = false;
async function qrTick() {
  const q = S.qr;
  if (!q || q.state !== 'ready' || qrBusy || document.hidden) return;
  qrBusy = true;
  try {
    const d = await api('/qr/poll', { id: q.id, poll_secret: q.poll });
    if (S.qr !== q) return;
    if (d.status === 'approved') { clearInterval(timers.qrPoll); clearInterval(timers.qrClock); S.qr = null; await onSignedIn(d); }
    else if (d.status === 'denied') qrStop('denied');
    else if (d.status === 'expired') qrStop('expired');
  } catch (e) {
    // 404 = o servidor não conhece mais este código; outras falhas (rede) tentam de novo no próximo ciclo
    if (e && e.status === 404 && S.qr === q) qrStop('expired');
  } finally { qrBusy = false; }
}

/* ------------------------------------------------------ ações de acesso */
async function doLogin() {
  S.lTouched = true;
  if (!S.lId.trim() || !S.lPw) { render(); return; }
  S.lBusy = true; S.lErr = ''; render();
  try {
    const d = await api('/login', { identifier: S.lId.trim(), password: S.lPw });
    await onSignedIn(d);
  } catch (e) {
    S.lBusy = false;
    if (e.error === 'unverified') {
      S.pendingEmail = e.email; tab.set('sq.pending', e.email);
      S.v = freshV(); S.v.notice = 'Falta confirmar seu e-mail. Digite o código que enviamos para a sua caixa de entrada.'; S.v.coolUntil = Date.now() + 30000;
      go('verify'); return;
    }
    S.lErr = e.message || 'Não foi possível entrar agora.';
    if (S.view === 'login') render();
  }
}
async function doRegister() {
  const r = S.r;
  r.touched = true; r.err = '';
  if (Object.keys(regErrors()).length) { render(); const bad = document.querySelector('.inp.bad, .dob.bad select'); if (bad) bad.focus(); return; }
  r.busy = true; r.srv = {}; render();
  try {
    const d = await api('/signup', {
      email: r.email.trim(), username: r.user.trim(), display_name: r.display.trim(), password: r.pass,
      birth_date: dobParts(r), marketing_opt_in: !!r.opt, accept_terms: !!r.terms
    });
    S.pendingEmail = d.email; tab.set('sq.pending', d.email);
    S.v = freshV(); S.v.coolUntil = Date.now() + 30000;
    if (d.sent === false) S.v.notice = 'Já enviamos um código há poucos instantes. Confira sua caixa de entrada.';
    r.pass = ''; r.busy = false;
    go('verify');
  } catch (e) {
    r.busy = false;
    const m = { email_taken: 'email', invalid_email: 'email', username_taken: 'user', invalid_username: 'user', weak_password: 'pass', invalid_birth_date: 'dob', too_young: 'dob', terms_required: 'terms' }[e.error];
    if (m) r.srv = { [m]: e.message }; else r.err = e.message || 'Não foi possível criar a conta agora.';
    if (S.view === 'register') render();
  }
}
async function doVerify() {
  const v = S.v;
  if (v.busy) return;
  if (v.code.length < 6) { v.err = 'Digite os 6 caracteres do código.'; paintOtp(); return; }
  v.busy = true; v.err = ''; v.notice = ''; render();
  try {
    const d = await api('/verify', { email: S.pendingEmail, code: v.code });
    await onSignedIn(d);
  } catch (e) {
    v.busy = false; v.err = e.message || 'Não foi possível verificar o código.';
    if (e.error === 'wrong_code' || e.error === 'expired' || e.error === 'locked') v.code = '';
    if (S.view === 'verify') { render(); startResendTick(); const el = document.getElementById('otp'); if (el) el.focus(); }
  }
}
async function doResend() {
  const v = S.v;
  if (Date.now() < v.coolUntil) return;
  v.err = ''; v.notice = '';
  try {
    await api('/resend', { email: S.pendingEmail });
    v.coolUntil = Date.now() + 30000; v.notice = 'Enviamos um novo código. Confira seu e-mail.';
  } catch (e) {
    if (e.retry_after) v.coolUntil = Date.now() + e.retry_after * 1000;
    v.err = e.message;
  }
  paintOtp(); startResendTick();
}
async function doForgot() {
  const f = S.f; f.touched = true; f.err = '';
  if (!validEmail(f.email)) { render(); return; }
  f.busy = true; render();
  try {
    await api('/forgot', { email: f.email.trim() });
    f.email = f.email.trim().toLowerCase(); f.busy = false; f.notice = '';
    go('forgot-sent');
  } catch (e) { f.busy = false; f.err = e.message; if (S.view === 'forgot') render(); }
}
async function doResendReset() {
  S.f.notice = '';
  try { await api('/forgot', { email: S.f.email }); S.f.notice = 'Pronto. Se houver uma conta, o e-mail chega em instantes.'; }
  catch (e) { S.f.notice = e.message; }
  if (S.view === 'forgotSent') render();
}
async function doReset() {
  const n = S.n; n.touched = true; n.err = '';
  const lenOk = n.pass.length >= 8, matchOk = n.pass === n.conf;
  if (!lenOk || !matchOk || n.code.length < 6) { render(); return; }
  n.busy = true; render();
  try {
    const d = await api('/reset', { email: n.email, code: n.code, password: n.pass });
    saveSession(d);
    S.n = freshN();
    go('done');
  } catch (e) { n.busy = false; n.err = e.message; if (S.view === 'newPass') render(); }
}

/* =====================================================================
   TELA PRINCIPAL — dados reais do Supabase (servidores, canais, mensagens e perfis).
   Ainda de demonstração: jogos, música, notícias, amigos/DM, voz.
   ===================================================================== */
const G = {
  lilac: 'linear-gradient(135deg,#D9CDF2,#9D8CCF)', rose: 'linear-gradient(135deg,#FAD3DC,#E897AB)',
  sky: 'linear-gradient(135deg,#C9E6F0,#7DB8CF)', mint: 'linear-gradient(135deg,#CBE9D9,#78BE9D)',
  sand: 'linear-gradient(135deg,#F9E5C0,#EBBA6C)', slate: 'linear-gradient(135deg,#DCDCE4,#9A9AA7)'
};
const TILES = ['linear-gradient(160deg,#F4C7D3,#B79BDB)', 'linear-gradient(160deg,#F7DDB5,#E39B6B)', 'linear-gradient(160deg,#BFE3EE,#6C9AD0)', 'linear-gradient(160deg,#CBE9D9,#78BE9D)', 'linear-gradient(160deg,#F4C7D3,#E06A7A)', 'linear-gradient(160deg,#DCDCE4,#9A9AA7)'];
const ACCENTS = ['#9D8CCF', '#E897AB', '#7DB8CF', '#78BE9D', '#EBBA6C', '#9A9AA7'];
const hashOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const gradFor = (id) => { const k = Object.keys(G); return G[k[hashOf(id) % k.length]]; };
const tileFor = (id) => TILES[hashOf(id) % TILES.length];
/* Fotos de teste desligadas (USE_TEST_PHOTOS = false): sem imagens de exemplo; as pastas site/img/ ficam no repositório, mas não vão mais para o site. */
const USE_TEST_PHOTOS = false;
const ph = (file, fallback) => (USE_TEST_PHOTOS ? `url('img/${file}.jpg') center/cover no-repeat, ${fallback}` : fallback);
const avatarUrl = (path) => C.SUPABASE_URL + '/storage/v1/object/public/avatars/' + path;
const avBg = (path, fallback) => (path ? `url('${avatarUrl(path)}') center/cover no-repeat, ${fallback}` : fallback);
const meBg = () => (A && A.me && A.me.g) || G.lilac;
const meIni = (name) => (A && A.me && A.me.avatar ? '' : (name.charAt(0) || '?').toUpperCase());
const myId = () => (S.session && S.session.user && S.session.user.id) || '';

const PANELS = {
  notif: { title: 'Notificações', items: [] },
  pins: { title: 'Mensagens fixadas', items: [] },
  mentions: { title: 'Menções', items: [] },
  search: { title: 'Buscar mensagens', items: [] },
  help: { title: 'Central de ajuda', items: [{ t: 'Como criar um servidor', s: 'Clique no “+” da barra de cima e escolha “Criar servidor”.' }, { t: 'Como convidar amigos', s: 'Dentro do servidor, clique em “Convidar” e envie o link.' }, { t: 'Atalhos do teclado', s: 'Enter envia a mensagem que você escreveu.' }] }
};
const EMOJIS = [['😀', 'Sorriso'], ['😂', 'Rindo'], ['👍', 'Joia'], ['🔥', 'Fogo'], ['🎮', 'Controle'], ['🎉', 'Festa'], ['❤️', 'Coração'], ['😮', 'Surpresa']];

/* ----------------------------------------------------- acesso ao banco */
async function sb(path, o = {}) {
  const t = await freshToken();
  if (!t) throw { message: 'not_authenticated', status: 401 };
  const headers = { apikey: C.SUPABASE_KEY, authorization: 'Bearer ' + t, accept: 'application/json' };
  if (o.body !== undefined) headers['content-type'] = 'application/json';
  if (o.prefer) headers.prefer = o.prefer;
  let res;
  try {
    res = await fetch(C.SUPABASE_URL + path, { method: o.method || 'GET', headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
  } catch (e) { throw { message: 'network', status: 0 }; }
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw { message: (j && (j.message || j.error)) || '', status: res.status }; }
  if (res.status === 204) return null;
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}
const rpc = (name, args) => sb('/rest/v1/rpc/' + name, { method: 'POST', body: args || {} });
const ERRS = {
  not_authenticated: 'Sua sessão expirou. Entre de novo.', network: 'Sem conexão. Verifique sua internet e tente de novo.',
  invalid_name: 'O nome está fora do tamanho permitido.', too_many_servers: 'Você atingiu o limite de servidores.',
  too_many_channels: 'Esse servidor já tem o máximo de canais.', not_owner: 'Só o dono do servidor pode fazer isso.',
  not_member: 'Você não faz parte deste servidor.', user_not_found: 'Não encontramos ninguém com esse @usuário.', rate_limited: 'Calma! Você está enviando mensagens rápido demais. Espere alguns segundos.', banned: 'Você foi banido deste servidor.', cannot_remove_self: 'Você não pode fazer isso com você mesmo.', voice_full: 'A sala de voz está cheia (máximo de 6 pessoas).', not_member: 'Você não faz parte deste servidor.', you_blocked: 'Você bloqueou essa pessoa. Desbloqueie para adicioná-la.', cannot_add_self: 'Você não pode adicionar a si mesmo.',
  too_many_requests: 'Você já tem pedidos demais esperando resposta.', no_request: 'Esse pedido não existe mais.', not_friends: 'Vocês ainda não são amigos.', invalid_invite: 'Convite inválido ou expirado.',
  'row-level security': 'Você não tem permissão para isso.', 'violates check constraint': 'Algum campo está fora do tamanho permitido.'
};
function errText(e) {
  const m = String((e && e.message) || '');
  for (const k of Object.keys(ERRS)) if (m.indexOf(k) !== -1) return ERRS[k];
  return 'Algo deu errado. Tente de novo em instantes.';
}

/* ---------------------------------------------------------------- estado */
let SERVERS = [];
let A = null;
const ONLINE_MS = 150000;
const FIELDS = 'id,author_id,content,created_at,edited_at,attachment_path';
const mapMsg = (r) => ({ id: r.id, from: r.author_id, text: r.content, at: r.created_at, edited: !!r.edited_at, img: r.attachment_path || '' });
const attUrl = (path) => C.SUPABASE_URL + '/storage/v1/object/public/attachments/' + path.split('/').map(encodeURIComponent).join('/');
const mentionsMe = (text) => { const u = A && A.me && A.me.user; return !!u && new RegExp('(^|[^a-z0-9_])@' + u.replace(/[^a-z0-9_.]/gi, '') + '(?![a-z0-9_])', 'i').test(text || ''); };
function msgBody(m) {
  const me = A && A.me && A.me.user ? A.me.user.toLowerCase() : '';
  let t = m.img && m.text === '📷 Imagem' ? '' : esc(m.text);
  t = t.replace(/(^|[\s(])@([a-zA-Z0-9_]{2,30})/g, (x, a, u) => a + '<span class="mention' + (u.toLowerCase() === me ? ' me' : '') + '">@' + u + '</span>');
  const img = m.img ? `<a class="att" href="${esc(attUrl(m.img))}" target="_blank" rel="noopener"><img src="${esc(attUrl(m.img))}" alt="Imagem enviada" loading="lazy"></a>` : '';
  return t + img;
}
const msgTime = (iso) => {
  const d = new Date(iso), t = new Date(), p2 = (n) => String(n).padStart(2, '0');
  const hm = p2(d.getHours()) + ':' + p2(d.getMinutes());
  return d.toDateString() === t.toDateString() ? hm : p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + hm;
};

function person(p, uid, role) {
  const me = uid === myId();
  const name = (p && (p.display_name || p.username)) || 'Membro';
  const on = me || !!(p && p.last_seen && Date.now() - Date.parse(p.last_seen) < ONLINE_MS);
  const status = (p && p.status_text) || '';
  const av = (p && p.avatar_path) || '';
  return {
    id: uid, name, user: (p && p.username) || '', bio: (p && p.bio) || '', status, accent: (p && p.accent) || '#9D8CCF',
    since: (p && p.created_at) || '', role: role || '', me, on, st: on ? (status || 'Online') : 'Offline',
    avatar: av, g: avBg(av, me ? G.lilac : gradFor(uid)), ini: av ? '' : name.charAt(0).toUpperCase()
  };
}

function initApp() {
  const uid = myId();
  if (A && A.owner === uid) { startLive(); openJoin(); return; }
  SERVERS = [];
  A = {
    owner: uid, world: 'loading', werr: '', me: null, server: null, channel: null, voice: null, muted: false, deafened: false,
    panel: null, showMembers: true, onlineOpen: true, offlineOpen: true, draft: '', search: '', emojiOpen: false, menu: false,
    view: 'hub', hubKey: '', hubKeys: [], hdraft: '', gq: '', searchOpen: false, barOpen: false, playing: true, track: 0, prog: 34, ntab: 'news', entered: false,
    threads: {}, loaded: {}, loading: {}, more: {}, terr: {}, modal: null, poll: null, beat: null, tt: null, typing: {}, pollN: 0, friends: [], incoming: [], outgoing: [], known: {}, dmByUser: {}, dmUser: {}, blocked: new Set(), unread: {}, vrost: {}
  };
  startLive(); loadWorld(); openJoin();
}
function openJoin() {
  if (S.joinCode && A) { A.modal = { type: 'srv', mode: 'join', name: '', code: S.joinCode, err: '', busy: false }; S.joinCode = null; }
}
function startLive() {
  stopAppTimers();
  A.poll = setInterval(pollTick, 3000);
  A.beat = setInterval(() => beat(false), 60000);
  A.tt = setInterval(updateTyping, 1500);
  rtStart();
  beat(true);
}
function stopAppTimers() { voiceLeave(true); if (A) { clearInterval(A.poll); clearInterval(A.beat); clearInterval(A.tt); A.poll = A.beat = A.tt = null; } rtStop(false); }

const curServer = () => SERVERS.find((s) => s.id === A.server) || SERVERS[0] || null;
const serverOfChan = (cid) => SERVERS.find((s) => s.text.some((c) => c.id === cid)) || null;
const curKey = () => (A.view === 'hub' ? A.hubKey : (A.channel || ''));
const findPerson = (id) => { if (A.me && id === A.me.id) return A.me; for (const s of SERVERS) if (s.byId[id]) return s.byId[id]; return (A.known && A.known[id]) || null; };
const relOf = (id) => (A.blocked.has(id) ? 'blocked' : A.friends.some((f) => f.id === id) ? 'friend' : A.incoming.some((f) => f.id === id) ? 'incoming' : A.outgoing.some((f) => f.id === id) ? 'outgoing' : 'none');
const rk = (ch) => 'sq.read.' + myId() + '.' + ch;
const anyUnread = () => Object.keys(A.unread).some((k) => A.unread[k]);
const udot = (ch) => (A.unread[ch] ? '<i class="udot" title="Mensagens não lidas"></i>' : '');
function markCur() {
  const k = curKey();
  if (!A || !A.dmUser[k] || !A.threads[k] || !A.threads[k].length || document.hidden) return;
  const last = A.threads[k][A.threads[k].length - 1];
  if (typeof last.id === 'number' || /^\d+$/.test(String(last.id))) store.set(rk(k), Number(last.id));
  if (A.unread[k]) delete A.unread[k];
}
const dmPeer = (key) => A.friends.find((f) => f.dm === key) || (A.dmUser[key] && A.known[A.dmUser[key]]) || null;

async function loadWorld(paint) {
  const w = A;
  try {
    const [srv, chs, mem, fr, dmc, dmm, blk] = await Promise.all([
      sb('/rest/v1/servers?select=id,name,owner_id,created_at&order=created_at.asc'),
      sb('/rest/v1/channels?select=id,server_id,name,kind,position&server_id=not.is.null&order=position.asc'),
      sb('/rest/v1/server_members?select=server_id,user_id,role'),
      sb('/rest/v1/friendships?select=user_a,user_b,requester,status'),
      sb('/rest/v1/channels?select=id&kind=eq.dm'),
      sb('/rest/v1/dm_members?select=channel_id,user_id'),
      sb('/rest/v1/blocks?select=blocked')
    ]);
    const other = (f) => (f.user_a === myId() ? f.user_b : f.user_a);
    const ids = Array.from(new Set(mem.map((m) => m.user_id).concat(fr.map(other), blk.map((b) => b.blocked), [myId()])));
    const profs = await sb('/rest/v1/profiles?select=id,username,display_name,bio,status_text,avatar_path,accent,last_seen,created_at&id=in.(' + ids.join(',') + ')');
    if (A !== w) return;
    const P = {}; profs.forEach((p) => { P[p.id] = p; });
    w.me = person(P[myId()] || { display_name: displayName(), username: S.profile && S.profile.username }, myId(), '');
    const dmByUser = {}, dmUser = {};
    dmc.forEach((c) => { const o = dmm.find((x) => x.channel_id === c.id && x.user_id !== myId()); if (o) { dmByUser[o.user_id] = c.id; dmUser[c.id] = o.user_id; } });
    const known = {};
    ids.forEach((id) => { if (id !== myId() && P[id]) known[id] = person(P[id], id, ''); });
    const byName = (a, b) => (a.on === b.on ? a.name.localeCompare(b.name) : (a.on ? -1 : 1));
    w.known = known; w.dmByUser = dmByUser; w.dmUser = dmUser; w.blocked = new Set(blk.map((b) => b.blocked));
    const unread = {};
    await Promise.all(dmc.map(async (c) => {
      try {
        const last = (await sb('/rest/v1/messages?select=id,author_id&channel_id=eq.' + c.id + '&order=id.desc&limit=1'))[0];
        if (!last) return;
        const mark = Number(store.get(rk(c.id)) || 0);
        if (last.author_id !== myId() && last.id > mark && !(w.view === 'dm' && w.channel === c.id) && !(w.view === 'hub' && w.hubKey === c.id)) unread[c.id] = 1;
      } catch (e) { /* sem aviso de não lida */ }
    }));
    w.unread = unread;
    loadVoice();
    w.friends = fr.filter((f) => f.status === 'accepted').map((f) => known[other(f)]).filter(Boolean).map((p) => Object.assign({}, p, { dm: dmByUser[p.id] || '' })).sort(byName);
    w.incoming = fr.filter((f) => f.status === 'pending' && f.requester !== myId()).map((f) => known[other(f)]).filter(Boolean);
    w.outgoing = fr.filter((f) => f.status === 'pending' && f.requester === myId()).map((f) => known[other(f)]).filter(Boolean);
    SERVERS = srv.map((s) => {
      const people = mem.filter((m) => m.server_id === s.id).map((m) => person(P[m.user_id], m.user_id, m.role));
      const byId = {}; people.forEach((p) => { byId[p.id] = p; });
      const by = (a, b) => a.name.localeCompare(b.name);
      const chan = (k) => chs.filter((c) => c.server_id === s.id && c.kind === k).map((c) => ({ id: c.id, name: c.name }));
      return {
        id: s.id, name: s.name, owner: s.owner_id, mine: s.owner_id === myId(), users: people.length, ini: s.name.charAt(0).toUpperCase(), tile: tileFor(s.id),
        text: chan('text'), voice: chan('voice'), byId, online: people.filter((p) => p.on).sort(by), offline: people.filter((p) => !p.on).sort(by)
      };
    });
    w.world = 'ready'; w.werr = '';
    S.profile = Object.assign({}, S.profile, { display_name: w.me.name, username: w.me.user || (S.profile && S.profile.username) });
    store.set('sq.profile', S.profile);
    fixSelection();
  } catch (e) {
    if (A !== w) return;
    if (w.world === 'ready') return;
    w.world = 'error'; w.werr = errText(e);
  }
  (paint || render)();
}
function fixSelection() {
  const dms = A.friends.filter((f) => f.dm).map((f) => f.dm);
  const dmKeys = dms.slice(0, 4);
  if (A.hubKey && dms.includes(A.hubKey) && !dmKeys.includes(A.hubKey)) dmKeys[3] = A.hubKey;
  if (A.view === 'dm' && !A.friends.some((f) => f.dm && f.dm === A.channel)) { A.view = 'hub'; A.channel = null; }
  if (!SERVERS.length) {
    A.server = null; if (A.view !== 'dm') { A.channel = null; A.view = 'hub'; }
  } else if (A.view === 'dm') {
    if (!SERVERS.some((x) => x.id === A.server)) A.server = SERVERS[0].id;
  } else {
    let s = SERVERS.find((x) => x.id === A.server);
    if (!s) { s = SERVERS[0]; A.server = s.id; A.channel = null; }
    if (!s.text.some((c) => c.id === A.channel)) A.channel = s.text[0] ? s.text[0].id : null;
  }
  A.hubKeys = SERVERS.slice(0, 3).map((x) => (x.text[0] ? x.text[0].id : '')).filter(Boolean).concat(dmKeys);
  if (!A.hubKeys.includes(A.hubKey)) A.hubKey = A.hubKeys[0] || '';
}
function selectServer(id) {
  const s = SERVERS.find((x) => x.id === id); if (!s) return;
  A.server = s.id; A.channel = s.text[0] ? s.text[0].id : null; A.view = 'server'; A.panel = null; A.search = '';
}
async function beat(first) {
  if (S.view !== 'app' || !A || document.hidden) return;
  const w = A;
  try {
    await sb('/rest/v1/profiles?id=eq.' + myId(), { method: 'PATCH', body: { last_seen: new Date().toISOString() } });
    if (!first && A === w && w.world === 'ready') await loadWorld(refilter);
  } catch (e) { /* tenta de novo no próximo ciclo */ }
}

/* ------------------------------------------------------------ mensagens */
async function ensureThread(key) {
  if (!key || A.loaded[key] || A.loading[key] || A.terr[key]) return;
  const w = A; A.loading[key] = 1;
  try {
    const rows = await sb(`/rest/v1/messages?select=${FIELDS}&channel_id=eq.${key}&order=id.desc&limit=50`);
    if (A !== w) return;
    w.more[key] = rows.length === 50;
    w.threads[key] = rows.reverse().map(mapMsg);
    w.loaded[key] = 1;
  } catch (e) { if (A === w) w.terr[key] = 1; }
  finally { if (A === w) w.loading[key] = 0; }
  if (A === w && S.view === 'app' && curKey() === key) { const had = A.unread[key]; paintMsgs(true); markCur(); if (had && !A.unread[key]) render(); }
}
function paintMsgs(stick) {
  const hub = A.view === 'hub';
  const el = document.getElementById(hub ? 'hmsgs' : 'msgs'); if (!el) return;
  const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  el.innerHTML = hub ? hubMsgsHTML() : serverMsgsHTML();
  if (stick === true || (stick !== 'keep' && near)) el.scrollTop = el.scrollHeight;
}
async function pollTick(force) {
  if (S.view !== 'app' || !A || document.hidden || A.world !== 'ready' || A.polling) return;
  if (RT.ok && force !== true && ++A.pollN % 10 !== 0) return;
  const key = curKey(); if (!key || !A.loaded[key]) return;
  const th = A.threads[key], last = th.length ? th[th.length - 1].id : 0;
  const w = A; A.polling = true;
  try {
    const rows = await sb(`/rest/v1/messages?select=${FIELDS}&channel_id=eq.${key}&id=gt.${last}&order=id.asc&limit=100`);
    if (A !== w) return;
    const cur = w.threads[key];
    const add = rows.map(mapMsg).filter((m) => !cur.some((x) => x.id === m.id));
    if (add.length) { w.threads[key] = cur.concat(add); if (curKey() === key) paintMsgs(false); }
  } catch (e) { /* tenta de novo */ }
  finally { if (A === w) w.polling = false; }
}
async function loadOlder() {
  const key = curKey(), th = A.threads[key];
  if (!th || !th.length || A.older) return;
  A.older = true;
  try {
    const rows = await sb(`/rest/v1/messages?select=${FIELDS}&channel_id=eq.${key}&id=lt.${th[0].id}&order=id.desc&limit=50`);
    A.more[key] = rows.length === 50;
    A.threads[key] = rows.reverse().map(mapMsg).concat(A.threads[key]);
    const el = document.getElementById('msgs'), h = el ? el.scrollHeight : 0;
    paintMsgs('keep');
    if (el) el.scrollTop += el.scrollHeight - h;
  } catch (e) { toast(errText(e)); }
  finally { A.older = false; }
}

/* ------------------------------------------------ tempo real (WebSocket do Supabase, sem biblioteca) */
const RT = { ws: null, ok: false, ref: 0, hb: null, tok: null, retry: 0, wait: null, last: 0 };
const rtSend = (topic, event, payload) => { if (RT.ws && RT.ws.readyState === 1) RT.ws.send(JSON.stringify({ topic, event, payload, ref: String(++RT.ref) })); };
async function rtStart() {
  if (RT.ws || !A || S.view !== 'app') return;
  const w = A;
  let ws;
  try { ws = new WebSocket(C.SUPABASE_URL.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(C.SUPABASE_KEY) + '&vsn=1.0.0'); }
  catch (e) { return rtRetry(); }
  RT.ws = ws;
  ws.onopen = async () => {
    const t = await freshToken().catch(() => null);
    if (RT.ws !== ws || !t) { try { ws.close(); } catch (e) { /* já fechado */ } return; }
    rtSend('realtime:sq', 'phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [{ event: '*', schema: 'public', table: 'messages' }, { event: '*', schema: 'public', table: 'friendships' }, { event: '*', schema: 'public', table: 'voice_members' }], private: false }, access_token: t });
    RT.hb = setInterval(async () => {
      rtSend('phoenix', 'heartbeat', {});
      const n = await freshToken().catch(() => null);
      if (n && n !== RT.tok) { RT.tok = n; rtSend('realtime:sq', 'access_token', { access_token: n }); if (VC) rtSend(VTOP(VC.ch), 'access_token', { access_token: n }); }
    }, 25000);
    RT.tok = t;
    if (VC) voiceRtJoin(t);
  };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (A !== w) return;
    if (VC && m.topic === VTOP(VC.ch)) {
      if (m.event === 'phx_reply') { if (m.payload && m.payload.status === 'ok') voiceHello(); else { toast('Não foi possível entrar na sala de voz.'); voiceLeave(); } }
      else if (m.event === 'broadcast' && m.payload) voiceSignal(m.payload.event, m.payload.payload || {});
      return;
    }
    if (m.event === 'phx_reply' && m.topic === 'realtime:sq') {
      if (m.payload && m.payload.status === 'ok') { RT.ok = true; RT.retry = 0; if (S.view === 'app') pollTick(true); }
      else { RT.ok = false; try { ws.close(); } catch (e) { /* já fechado */ } }
    } else if (m.event === 'postgres_changes') rtChange(m.payload && m.payload.data);
    else if (m.event === 'broadcast' && m.payload && m.payload.event === 'typing') rtTyping(m.payload.payload);
  };
  ws.onclose = () => { if (RT.ws === ws) { rtStop(true); } };
  ws.onerror = () => { try { ws.close(); } catch (e) { /* já fechado */ } };
}
function rtStop(retry) {
  clearInterval(RT.hb); RT.hb = null; RT.ok = false;
  const ws = RT.ws; RT.ws = null;
  if (ws) { ws.onclose = ws.onerror = ws.onmessage = null; try { ws.close(); } catch (e) { /* já fechado */ } }
  if (retry) rtRetry(); else { clearTimeout(RT.wait); RT.wait = null; RT.retry = 0; }
}
function rtRetry() {
  clearTimeout(RT.wait);
  if (!A || S.view !== 'app') return;
  RT.retry = Math.min(RT.retry + 1, 6);
  RT.wait = setTimeout(rtStart, Math.min(30000, 1000 * 2 ** RT.retry));
}
/* ----------------------------------------------------------- voz (WebRTC) */
const VTOP = (ch) => 'realtime:voice:' + ch;
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
let VC = null; // { ch, stream, peers: { uid: { pc, audio, queue } }, ping }
const vsend = (event, payload) => { if (VC) rtSend(VTOP(VC.ch), 'broadcast', { type: 'broadcast', event, payload: Object.assign({ from: myId() }, payload) }); };
const voiceRoster = (ch) => ((A && A.vrost[ch]) || []);
async function loadVoice() {
  const w = A; if (!w) return;
  try {
    const rows = await sb('/rest/v1/voice_members?select=channel_id,user_id,seen_at');
    if (A !== w) return;
    const lim = Date.now() - 45000, r = {};
    rows.forEach((x) => { if (new Date(x.seen_at).getTime() >= lim) (r[x.channel_id] = r[x.channel_id] || []).push(x.user_id); });
    A.vrost = r;
    if (S.view === 'app' && A.world === 'ready') render();
  } catch (e) { /* sem lista de voz */ }
}
function voiceApply() {
  if (!VC) return;
  const off = A.muted || A.deafened;
  VC.stream.getAudioTracks().forEach((t) => { t.enabled = !off; });
  Object.keys(VC.peers).forEach((u) => { if (VC.peers[u].audio) VC.peers[u].audio.muted = !!A.deafened; });
}
async function voiceJoin(ch) {
  if (VC && VC.ch === ch) return;
  if (VC) voiceLeave(true);
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof RTCPeerConnection === 'undefined') return toast('Este navegador não permite chamadas de voz.');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { return toast('Não consegui usar o microfone. Libere o microfone para este site no navegador e tente de novo.'); }
  try { await rpc('voice_join', { p_channel: ch }); }
  catch (e) { stream.getTracks().forEach((t) => t.stop()); return toast(errText(e)); }
  VC = { ch, stream, peers: {}, ping: setInterval(() => { rpc('voice_ping', { p_channel: ch }).catch(() => {}); }, 15000) };
  voiceApply();
  A.voice = ch;
  const t = await freshToken().catch(() => null);
  if (t) voiceRtJoin(t);
  loadVoice(); render();
}
function voiceRtJoin(t) {
  if (!VC) return;
  rtSend(VTOP(VC.ch), 'phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: true }, access_token: t });
}
function voiceHello() { vsend('hello', {}); }
function voicePeer(uid) {
  if (VC.peers[uid]) return VC.peers[uid];
  const pc = new RTCPeerConnection(ICE), peer = { pc, audio: null, queue: [] };
  VC.peers[uid] = peer;
  VC.stream.getTracks().forEach((tr) => pc.addTrack(tr, VC.stream));
  pc.onicecandidate = (e) => { if (e.candidate) vsend('ice', { to: uid, cand: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
  pc.ontrack = (e) => {
    if (!peer.audio) { const a = document.createElement('audio'); a.autoplay = true; a.setAttribute('playsinline', ''); a.style.display = 'none'; document.body.appendChild(a); peer.audio = a; }
    peer.audio.srcObject = e.streams[0]; peer.audio.muted = !!(A && A.deafened);
    const pr = peer.audio.play(); if (pr && pr.catch) pr.catch(() => {});
  };
  pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) voiceDrop(uid); };
  return peer;
}
function voiceDrop(uid) {
  if (!VC || !VC.peers[uid]) return;
  const p = VC.peers[uid]; delete VC.peers[uid];
  try { p.pc.close(); } catch (e) { /* já fechado */ }
  if (p.audio) { p.audio.srcObject = null; p.audio.remove(); }
}
async function voiceOffer(uid) {
  if (!VC || VC.peers[uid]) return;
  const peer = voicePeer(uid);
  try { const o = await peer.pc.createOffer(); await peer.pc.setLocalDescription(o); vsend('offer', { to: uid, sdp: peer.pc.localDescription.sdp }); }
  catch (e) { voiceDrop(uid); }
}
async function voiceSignal(ev, d) {
  if (!VC || !d.from || d.from === myId() || (d.to && d.to !== myId())) return;
  const uid = d.from;
  try {
    if (ev === 'hello') { vsend('hi', { to: uid }); if (myId() < uid) voiceOffer(uid); }
    else if (ev === 'hi') { if (myId() < uid) voiceOffer(uid); }
    else if (ev === 'offer') {
      voiceDrop(uid);
      const peer = voicePeer(uid);
      await peer.pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
      const an = await peer.pc.createAnswer(); await peer.pc.setLocalDescription(an);
      vsend('answer', { to: uid, sdp: peer.pc.localDescription.sdp });
      peer.queue.splice(0).forEach((c) => peer.pc.addIceCandidate(c).catch(() => {}));
    } else if (ev === 'answer') {
      const peer = VC.peers[uid]; if (!peer) return;
      await peer.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
      peer.queue.splice(0).forEach((c) => peer.pc.addIceCandidate(c).catch(() => {}));
    } else if (ev === 'ice') {
      const peer = VC.peers[uid]; if (!peer || !d.cand) return;
      if (peer.pc.remoteDescription) peer.pc.addIceCandidate(d.cand).catch(() => {}); else peer.queue.push(d.cand);
    } else if (ev === 'bye') voiceDrop(uid);
  } catch (e) { voiceDrop(uid); }
}
function voiceLeave(quiet) {
  if (!VC) return;
  const v = VC; vsend('bye', {});
  VC = null;
  clearInterval(v.ping);
  Object.keys(v.peers).forEach((u) => { const p = v.peers[u]; try { p.pc.close(); } catch (e) { /* já fechado */ } if (p.audio) { p.audio.srcObject = null; p.audio.remove(); } });
  v.stream.getTracks().forEach((t) => t.stop());
  rtSend(VTOP(v.ch), 'phx_leave', {});
  if (A) A.voice = null;
  rpc('voice_leave', {}).catch(() => {});
  if (A && A.vrost) { A.vrost[v.ch] = (A.vrost[v.ch] || []).filter((u) => u !== myId()); }
  if (!quiet && S.view === 'app') render();
}
let wrTimer = null;
function reloadSoon() { clearTimeout(wrTimer); const w = A; wrTimer = setTimeout(() => { if (A === w && S.view === 'app') loadWorld(); }, 400); }
function rtChange(d) {
  if (!d || !A) return;
  if (d.table === 'voice_members') { loadVoice(); return; }
  const r = d.record || {}, old = d.old_record || {};
  if (d.table === 'friendships') {
    if (d.type === 'INSERT' && r.requester && r.requester !== myId()) toast('Novo pedido de amizade');
    else if (d.type === 'UPDATE' && r.status === 'accepted' && r.requester === myId()) toast('Seu pedido de amizade foi aceito');
    reloadSoon(); return;
  }
  if (d.type === 'INSERT') {
    const ch = r.channel_id, th = A.threads[ch];
    if (r.author_id !== myId() && !serverOfChan(ch) && !A.dmUser[ch]) { reloadSoon(); return; }
    if (r.author_id !== myId() && A.dmUser[ch] && !A.blocked.has(r.author_id) && (curKey() !== ch || document.hidden)) { const f = dmPeer(ch); toast('Nova mensagem de ' + (f ? f.name : 'um amigo')); A.unread[ch] = 1; if (!th) reloadSoon(); else render(); }
    if (r.author_id !== myId() && serverOfChan(ch) && mentionsMe(r.content) && !A.blocked.has(r.author_id)) { const f = findPerson(r.author_id); toast((f ? f.name : 'Alguém') + ' mencionou você'); }
    if (!th || th.some((x) => x.id === r.id)) return;
    th.push(mapMsg(r));
    if (A.typing) delete A.typing[ch + '|' + r.author_id];
    if (curKey() === ch) { paintMsgs(false); updateTyping(); markCur(); }
  } else if (d.type === 'UPDATE') {
    const th = A.threads[r.channel_id], x = th && th.find((y) => y.id === r.id);
    if (x) { x.text = r.content; x.edited = !!r.edited_at; if (curKey() === r.channel_id) paintMsgs('keep'); }
  } else if (d.type === 'DELETE') {
    const id = old.id; let hit = null;
    Object.keys(A.threads).forEach((k) => { const th = A.threads[k]; if (th.some((y) => y.id === id)) { A.threads[k] = th.filter((y) => y.id !== id); hit = k; } });
    if (hit && curKey() === hit) paintMsgs('keep');
  }
}
function rtTyping(p) {
  if (!p || !A || p.uid === myId() || !p.ch) return;
  if (A.blocked.has(p.uid)) return;
  A.typing[p.ch + '|' + p.uid] = { name: String(p.name || 'Alguém').slice(0, 40), t: Date.now() };
  updateTyping();
}
function sendTyping() {
  const key = curKey(); if (!key || !RT.ok || Date.now() - RT.last < 3000) return;
  RT.last = Date.now();
  rtSend('realtime:sq', 'broadcast', { type: 'broadcast', event: 'typing', payload: { ch: key, uid: myId(), name: (A.me && A.me.name) || displayName() } });
}
function updateTyping() {
  const el = document.getElementById('typing'); if (!el || !A) return;
  const key = curKey(), now = Date.now();
  const names = Object.keys(A.typing).filter((k) => k.startsWith(key + '|') && now - A.typing[k].t < 5000).map((k) => A.typing[k].name);
  el.textContent = !names.length ? '' : names.length === 1 ? names[0] + ' está digitando…' : names.length === 2 ? names[0] + ' e ' + names[1] + ' estão digitando…' : 'Várias pessoas estão digitando…';
}
async function sendTo(key, text, img) {
  const body = { channel_id: key, content: text };
  if (img) body.attachment_path = img;
  const rows = await sb('/rest/v1/messages?select=' + FIELDS, { method: 'POST', body, prefer: 'return=representation' });
  const m = mapMsg(rows[0]), th = A.threads[key];
  if (th && !th.some((x) => x.id === m.id)) th.push(m);
}
function syncSend() {
  const b = document.getElementById('send-btn'); if (b) b.hidden = !A.draft.trim();
  const h = document.getElementById('hsend'); if (h) h.hidden = !A.hdraft.trim();
}
async function shrinkMax(file, max) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('img'))), 'image/jpeg', 0.82));
}
function pickImage(hub) {
  const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/jpeg,image/png,image/webp';
  f.addEventListener('change', () => { if (f.files && f.files[0]) sendImage(f.files[0], hub); });
  f.click();
}
async function sendImage(file, hub) {
  const key = hub ? A.hubKey : A.channel;
  if (!key || A.sending) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Use uma imagem JPG, PNG ou WebP.');
  if (file.size > 15 * 1024 * 1024) return toast('A imagem é muito grande (máximo 15 MB).');
  A.sending = true; toast('Enviando imagem…');
  const caption = (hub ? A.hdraft : A.draft).trim();
  try {
    const blob = await shrinkMax(file, 1280);
    const path = myId() + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '' + Math.random().toString(16).slice(2)) + '.jpg';
    await storageCall('POST', path, blob, 'image/jpeg', 'attachments');
    await sendTo(key, caption || '📷 Imagem', path);
    if (caption) { if (hub) A.hdraft = ''; else A.draft = ''; const i = document.getElementById(hub ? 'hmsg' : 'msg'); if (i) i.value = ''; syncSend(); }
  } catch (e) { toast(e && e.message === 'upload_failed' ? 'Não foi possível enviar a imagem. Tente outra.' : errText(e)); }
  A.sending = false;
  if (curKey() === key) paintMsgs(true);
}
async function doSend(hub) {
  const key = hub ? A.hubKey : A.channel;
  const text = (hub ? A.hdraft : A.draft).trim();
  if (!text || !key || A.sending) return;
  A.sending = true;
  if (hub) A.hdraft = ''; else { A.draft = ''; A.emojiOpen = false; }
  const input = document.getElementById(hub ? 'hmsg' : 'msg'); if (input) { input.value = ''; input.focus(); }
  syncSend();
  try { await sendTo(key, text); }
  catch (e) {
    if (hub ? !A.hdraft : !A.draft) { if (hub) A.hdraft = text; else A.draft = text; const i2 = document.getElementById(hub ? 'hmsg' : 'msg'); if (i2) i2.value = text; syncSend(); }
    toast(errText(e));
  }
  A.sending = false;
  if (curKey() === key) paintMsgs(true);
}

/* ----------------------------------------------------- painel inicial */
const GAMES = [
  { n: 'Arena Estelar', h: '312 h', i: 'A', g: 'linear-gradient(160deg,#F4C7D3,#B79BDB)' },
  { n: 'Reinos de Vale', h: '188 h', i: 'R', g: 'linear-gradient(160deg,#CBE9D9,#78BE9D)' },
  { n: 'Dunas', h: '141 h', i: 'D', g: 'linear-gradient(160deg,#F7DDB5,#E39B6B)' },
  { n: 'Cidade Neon', h: '97 h', i: 'N', g: 'linear-gradient(160deg,#BFE3EE,#6C9AD0)' }
];
const TRACKS = [
  { t: 'Magnolia', a: 'Playboi Carti', d: 181, g: ph('capa', G.rose), img: true },
  { t: 'Fim de Tarde', a: 'Banda Lume', d: 261, g: G.rose },
  { t: 'Noite em Neon', a: 'Os Faróis', d: 215, g: G.sky },
  { t: 'Rota das Dunas', a: 'Vale Sonoro', d: 243, g: G.sand }
];
/* Notícias reais (pesquisa feita em 17/11/2026). Cada item abre a matéria na fonte. As artes são degradês de exemplo. */
const NEWS = [
  { src: 'Game Over Drive', t: 'Sony confirma fim da PS Store no PS3 e PS Vita; veja o que muda no Brasil', s: 'Compras digitais acabam até 2027, mas jogos já comprados poderão ser baixados.', u: 'https://gameoverdrive.com.br/sony-fim-ps-store-ps3-ps-vita-datas-brasil/', g: 'linear-gradient(160deg,#BFE3EE,#6C9AD0)' },
  { src: 'Game Over Drive', t: 'PlayStation 5 ultrapassa 100 milhões de unidades vendidas', s: 'Marco atingido até 10 de novembro de 2026, segundo a Sony.', u: 'https://gameoverdrive.com.br/ps5-100-milhoes-unidades-vendidas-sony/', g: 'linear-gradient(160deg,#D9CDF2,#9D8CCF)' },
  { src: 'Canaltech', t: 'GTA 6, Zelda Ocarina of Time e mais lançamentos de jogos em novembro', s: 'Lista com os principais jogos do mês e as datas de cada plataforma.', u: 'https://canaltech.com.br/games/lancamentos-jogos-novos-novembro-2026/', g: 'linear-gradient(160deg,#F7DDB5,#E39B6B)' },
  { src: 'Game Over Drive', t: "Assassin's Creed Hexe foi adiado? Jogo pode ficar para 2028", s: 'Relato aponta problemas de desenvolvimento; a Ubisoft ainda não confirmou.', u: 'https://gameoverdrive.com.br/assassins-creed-hexe-adiado-lancamento-2028/', g: 'linear-gradient(160deg,#F4C7D3,#B79BDB)' }
];
const FREE = [
  { src: 'Game Over Drive', t: 'Alien: Isolation grátis na Epic Games: data e como resgatar', s: 'Alien: Isolation e Mark of the Deep ficam grátis de 19 a 26 de novembro.', u: 'https://gameoverdrive.com.br/alien-isolation-gratis-epic-games-novembro-2026/', g: 'linear-gradient(160deg,#CBE9D9,#78BE9D)' },
  { src: 'Olhar Digital', t: 'Jogos grátis na Epic Games: Knightica', s: 'Roguelike auto-battler de estratégia, grátis de 12 a 19 de novembro.', u: 'https://olhardigital.com.br/2026/11/12/games-e-consoles/jogos-gratis-na-epic-games-knightica/', g: 'linear-gradient(160deg,#FAD3DC,#E897AB)' }
];
const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

function friendsList() { return A.friends; }
function friendsHTML() {
  const q = (A.gq || '').trim().toLowerCase();
  const all = friendsList();
  if (!all.length) return `<div class="hempty">Você ainda não tem amigos.<div class="hcta"><button type="button" class="mbtn sm" data-act="toast-friend">Adicionar amigo</button></div></div>`;
  const list = all.filter((p) => !q || p.name.toLowerCase().indexOf(q) !== -1);
  if (!list.length) return '<div class="hempty">Nenhum amigo encontrado.</div>';
  return list.map((p) => `<button type="button" class="frow hov${p.on ? '' : ' off'}" data-act="profile" data-id="${p.id}" aria-label="Ver perfil de ${esc(p.name)}"><span class="pf" style="background:${p.g}" aria-hidden="true">${esc(p.ini)}${p.on ? '<i></i>' : ''}</span><span class="tx"><b>${esc(p.name)}</b><small>${esc(p.st)}</small></span>${p.dm ? udot(p.dm) : ''}</button>`).join('');
}
function refilter() {
  const f = document.getElementById('flist'); if (f) f.innerHTML = friendsHTML();
  const l = document.getElementById('mlist'); if (l) l.innerHTML = membersListHTML();
}

function topbarHTML() {
  const hub = A.view === 'hub';
  return `<header class="tbar">
  <button type="button" class="tbh ${hub ? 'sel' : 'hov'}" data-act="hub" aria-label="Início" aria-pressed="${hub}">${ic(D.bubble, 22, '#33333A', 1.6)}${anyUnread() ? '<i class="udot"></i>' : ''}</button>
  <i class="tsep" aria-hidden="true"></i>
  <nav class="tsrv" aria-label="Seus servidores">${SERVERS.map((s) => { const on = !hub && A.server === s.id; return `<button type="button" class="stile${on ? ' on' : ''}" data-act="srv-open" data-id="${s.id}" aria-label="${esc(s.name)}" aria-pressed="${on}" title="${esc(s.name)}" style="background:${s.tile}">${esc(s.ini)}</button>`; }).join('')}<button type="button" class="stile add" data-act="modal-open" data-k="srv" data-mode="create" aria-label="Criar ou entrar em um servidor" title="Criar ou entrar em um servidor">${ic(D.plus, 20, '#33333A', 1.8)}</button></nav>
  <span class="tsp"></span><i class="tsep" aria-hidden="true"></i>
  <div class="tsearch${A.searchOpen ? ' open' : ''}" id="tsearch"><input id="gsearch" type="text" placeholder="Buscar amigos" value="${esc(A.gq)}" data-app-bind="gq" autocomplete="off" aria-label="Buscar amigos"><button type="button" class="tbs hov" data-act="gsearch" aria-label="Buscar">${ic(D.search, 22, '#33333A', 1.7)}</button></div>
</header>`;
}

function hubMsgsHTML() {
  const key = A.hubKey, srv = serverOfChan(key), me = myId(), peer = srv ? null : dmPeer(key);
  if (!A.loaded[key]) return `<div class="hempty">${A.terr[key] ? 'Não foi possível carregar. <button type="button" class="lnk" data-act="retry-thread">Tentar de novo</button>' : 'Carregando…'}</div>`;
  const th = (A.threads[key] || []).filter((m) => !A.blocked.has(m.from)).slice(srv ? -3 : -30);
  if (!th.length) return '<div class="hempty">Nenhuma mensagem ainda. Escreva a primeira!</div>';
  return th.map((m) => {
    if (m.from === me) return `<div class="mout"><div class="bub"><span class="sr">Você: </span>${msgBody(m)}</div></div>`;
    const p = srv ? srv.byId[m.from] : peer;
    return `<div class="min"><button type="button" class="av40" data-act="profile" data-id="${m.from}" aria-label="Ver perfil de ${esc(p ? p.name : 'ex-membro')}" style="background:${p ? p.g : G.slate}">${esc(p ? p.ini : '')}</button><div class="bub"><span class="sr">${esc(p ? p.name : '')}: </span>${msgBody(m)}</div></div>`;
  }).join('');
}
function hubChatHTML() {
  if (A.world === 'loading') return '<div class="hchat"><div class="hmsgs"><div class="hempty">Carregando…</div></div></div>';
  if (A.world === 'error') return `<div class="hchat"><div class="hmsgs"><div class="hempty">${esc(A.werr)}</div><div class="hcta"><button type="button" class="mbtn" data-act="reload-world">Tentar de novo</button></div></div></div>`;
  if (!SERVERS.length && !A.hubKeys.length) return `<div class="hchat"><div class="hmsgs"><div class="hempty">Você ainda não está em nenhum servidor e não tem conversas.</div>
    <div class="hcta"><button type="button" class="mbtn" data-act="modal-open" data-k="srv" data-mode="create">Criar servidor</button><button type="button" class="mbtn ghost" data-act="modal-open" data-k="srv" data-mode="join">Entrar com convite</button><button type="button" class="mbtn ghost" data-act="toast-friend">Adicionar amigo</button></div></div></div>`;
  if (!A.hubKey) return '<div class="hchat"><div class="hmsgs"><div class="hempty">Seus servidores ainda não têm canais de texto.</div></div></div>';
  const tabs = A.hubKeys.map((k) => {
    const s = serverOfChan(k), on = k === A.hubKey;
    if (s) return `<button type="button" class="ctab${on ? ' on' : ''}" data-act="hubchat" data-key="${k}" aria-pressed="${on}" aria-label="${esc(s.name)}" title="${esc(s.name)}" style="background:${s.tile}">${esc(s.ini)}</button>`;
    const f = dmPeer(k); if (!f) return '';
    return `<button type="button" class="ctab dmtab${on ? ' on' : ''}" data-act="hubchat" data-key="${k}" aria-pressed="${on}" aria-label="Conversa com ${esc(f.name)}" title="${esc(f.name)}" style="background:${f.g}">${esc(f.ini)}${udot(k)}</button>`;
  }).join('');
  return `<div class="hchat">
  <div class="hch">${tabs}<span class="tsp"></span>${serverOfChan(A.hubKey) ? `<button type="button" class="hov wext" data-act="chat-open" aria-label="Abrir a conversa completa">${ic(D.ext, 17)}</button>` : `<b class="dmname">${esc((dmPeer(A.hubKey) || {}).name || '')}</b><button type="button" class="hov wext" data-act="chat-open" aria-label="Abrir a conversa em tela cheia">${ic(D.ext, 17)}</button>`}</div>
  <div class="hmsgs" id="hmsgs" role="log" aria-label="Mensagens recentes" aria-live="polite">${hubMsgsHTML()}</div>
  <div class="typing" id="typing" aria-live="polite"></div>
  <div class="cbar hbar">
    <button type="button" class="hov ib" data-act="attach" data-hub="1" aria-label="Anexar imagem">${ic(D.clip, 18)}</button>
    <input id="hmsg" type="text" placeholder="Escreva algo..." maxlength="2000" value="${esc(A.hdraft)}" data-app-bind="hdraft" autocomplete="off" aria-label="Escreva uma mensagem">
    <button type="button" class="go" id="hsend" data-act="hsend" aria-label="Enviar mensagem"${A.hdraft.trim() ? '' : ' hidden'}>${ic(D.send, 17, '#FFFFFF', 1.8)}</button>
  </div>
</div>`;
}

function pinnedHTML() {
  const s = SERVERS[0];
  const slot = () => `<button type="button" class="pslot" data-act="toast-pin" aria-label="Fixar uma festa">${ic(D.plus, 20, '#62626D', 1.6)}</button>`;
  if (!s) return `<div class="pp"><h2>Festas fixadas</h2><div class="pgrid">${[0, 1, 2, 3].map(slot).join('')}</div></div>`;
  const ppl = Object.keys(s.byId).map((k) => s.byId[k]).slice(0, 3);
  const av = ppl.map((p, i) => `<span class="pav" style="background:${p.g};margin-left:${i ? -10 : 0}px"></span>`).join('');
  return `<div class="pp"><h2>Festas fixadas</h2><div class="pgrid">
    <button type="button" class="pslot has" data-act="srv-open" data-id="${s.id}" aria-label="Abrir ${esc(s.name)}"><span class="pavs">${av}</span><small>${esc(s.name)}</small></button>
    ${[0, 1, 2].map(slot).join('')}
  </div></div>`;
}

function mostHTML() {
  return `<div class="ggrid">${GAMES.map((g) => `<button type="button" class="gtile" data-act="toast-soon" aria-label="${esc(g.n)}, ${esc(g.h)} jogadas"><span class="gart" style="background:${g.g}">${g.i}</span><b>${esc(g.n)}</b><small>${esc(g.h)}</small></button>`).join('')}</div>`;
}

function musicHTML() {
  const t = TRACKS[A.track], pct = Math.min(100, (A.prog / t.d) * 100);
  return `<div class="mtop">
  <div class="disc${A.playing ? ' spin' : ''}" id="disc" aria-hidden="true"><span class="core"${USE_TEST_PHOTOS && t.img ? ` style="background:${t.g}"` : ''}>${USE_TEST_PHOTOS && t.img ? '' : ic(D.music, 30, '#44444C', 1.5)}</span></div>
  <div class="minfo">
    <h3 id="mt">${esc(t.t)}</h3><small id="ma">${esc(t.a)}</small>
    <div class="mctl"><button type="button" class="hov mc" data-act="mprev" aria-label="Faixa anterior">${ic(D.prev, 20, '#33333A', 1.7)}</button><button type="button" class="mc play" id="mplay" data-act="mplay" aria-label="${A.playing ? 'Pausar' : 'Tocar'}">${ic(A.playing ? D.pause : D.play, 20, '#FFFFFF', 1.8)}</button><button type="button" class="hov mc" data-act="mnext" aria-label="Próxima faixa">${ic(D.next, 20, '#33333A', 1.7)}</button></div>
    <div class="mtime"><span id="mcur">${fmt(A.prog)}</span><span>${fmt(t.d)}</span></div>
    <div class="pbar" data-act="seek" role="progressbar" aria-label="Progresso da música" aria-valuemin="0" aria-valuemax="${t.d}" aria-valuenow="${A.prog}"><i id="mfill" style="width:${pct}%"></i><b id="mknob" style="left:${pct}%"></b></div>
  </div></div>
  <div class="tracks">${TRACKS.map((x, i) => `<button type="button" class="trk ${i === A.track ? 'on' : 'hov'}" data-act="mtrack" data-i="${i}" aria-label="Tocar ${esc(x.t)}"><span class="tc" style="background:${x.g}"></span><span class="tx"><b>${esc(x.t)}</b><small>${esc(x.a)}</small></span><em>${fmt(x.d)}</em></button>`).join('')}</div>`;
}

function newsHTML() {
  const card = (x) => `<article class="ncard"><div class="nart" style="background:${x.g}"><a class="hov next" href="${esc(x.u)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir a notícia em ${esc(x.src)}">${ic(D.ext, 16, '#1D1D22', 1.8)}</a></div><div class="nb"><div class="src"><span style="background:${x.g}"></span>${esc(x.src)}</div><h4><a href="${esc(x.u)}" target="_blank" rel="noopener noreferrer">${esc(x.t)}</a></h4><p>${esc(x.s)}</p></div></article>`;
  const tab = (k, label) => `<button type="button" role="tab" class="ntab${A.ntab === k ? ' on' : ''}" id="tab-${k}" data-act="ntab" data-k="${k}" aria-selected="${A.ntab === k}">${label}</button>`;
  return `<div class="ntabs" role="tablist">${tab('news', 'Notícias')}${tab('free', 'Jogos grátis')}<span class="tsp"></span><button type="button" class="hov wext" data-act="toast-soon" aria-label="Abrir">${ic(D.ext, 17)}</button></div>
  <div class="npane${A.ntab === 'news' ? ' on' : ''}" id="pane-news" role="tabpanel">${NEWS.map(card).join('')}</div>
  <div class="npane${A.ntab === 'free' ? ' on' : ''}" id="pane-free" role="tabpanel">${FREE.map(card).join('')}</div>`;
}

function menuHTML() {
  if (!A.menu) return '';
  return `<div class="menu" role="menu" aria-label="Menu da conta"><button type="button" role="menuitem" class="hov" data-act="profile" data-id="${myId()}">Meu perfil</button><button type="button" role="menuitem" class="hov" data-act="edit-profile">Editar perfil</button><button type="button" role="menuitem" class="hov" data-act="settings">Configurações</button><button type="button" role="menuitem" class="hov out" data-act="logout">Sair da conta</button></div>`;
}
function userbarHTML() {
  const me = displayName(), mutedEff = A.muted || A.deafened;
  const x = (act, icon, label, i, extra = '') => `<button type="button" class="hov tb" data-act="${act}" ${extra} aria-label="${label}" style="transition-delay:${i * 55}ms">${ic(icon, 20, '#33333A', 1.7)}</button>`;
  return `<div class="barwrap"><div class="ubar${A.barOpen ? ' open' : ''}" id="ubar">
  ${menuHTML()}
  <button type="button" class="pic" data-act="profile" data-id="${myId()}" title="${esc(me)}" aria-label="Meu perfil: ${esc(me)}" style="background:${meBg()}">${esc(meIni(me))}</button>
  <button type="button" class="hov tb" data-act="deaf" aria-label="${A.deafened ? 'Ativar áudio' : 'Desativar áudio'}" aria-pressed="${A.deafened}">${A.deafened ? ic(D.head + '<path d="M4 4l16 16"/>', 20, '#D92D45', 1.8) : ic(D.head, 20, '#33333A', 1.7)}</button>
  <button type="button" class="hov tb" data-act="mute" aria-label="${mutedEff ? 'Ativar microfone' : 'Silenciar microfone'}" aria-pressed="${mutedEff}">${mutedEff ? ic(D.micOff, 20, '#D92D45', 1.8) : ic(D.mic, 20, '#33333A', 1.7)}</button>
  <button type="button" class="hov tb" data-act="menu" aria-label="Menu da conta" aria-haspopup="true" aria-expanded="${A.menu}">${ic(D.gear, 20, '#33333A', 1.6)}</button>
  <button type="button" class="hov tb dots" id="b-dots" data-act="bar" aria-label="Mais opções" aria-expanded="${A.barOpen}">${ic(D.dots, 20, '#33333A', 1.7)}</button>
  <span class="xtra">${x('panel', D.bell, 'Notificações', 1, 'data-k="notif"')}${x('toast-friend', D.userPlus, 'Adicionar amigo', 2)}${x('edit-profile', D.edit, 'Editar perfil', 3)}${x('panel', D.help, 'Central de ajuda', 4, 'data-k="help"')}${x('bar', D.chevL, 'Recolher', 5)}</span>
</div></div>`;
}

function hubHTML(enter) {
  const w = (cls, i, inner) => `<section class="w ${cls}" style="--i:${i}">${inner}</section>`;
  return `<main class="hub${enter ? ' enter' : ''}" aria-label="Painel inicial">
  ${w('w-fr', 0, `<div class="wh"><h2>Amigos</h2><button type="button" class="hov wext" data-act="friends-open" aria-label="Abrir lista de membros">${ic(D.ext, 17)}</button></div><div class="flist" id="flist">${friendsHTML()}</div>`)}
  ${w('w-chat', 1, `${hubChatHTML()}${pinnedHTML()}`)}
  ${w('w-most', 2, `<div class="wh"><h2>Mais jogados</h2></div>${mostHTML()}`)}
  ${w('w-mus', 3, musicHTML())}
  ${w('w-news', 4, newsHTML())}
  ${userbarHTML()}
</main>`;
}

let musicT = null;
function startMusic() {
  if (musicT) return;
  musicT = setInterval(() => {
    if (S.view !== 'app' || !A || document.hidden || !A.playing) return;
    const t = TRACKS[A.track];
    A.prog++;
    if (A.prog >= t.d) { A.track = (A.track + 1) % TRACKS.length; A.prog = 0; if (A.view === 'hub' && !A.modal) render(); return; }
    paintProg();
  }, 1000);
}
function paintProg() {
  if (S.view !== 'app' || !A || A.view !== 'hub') return;
  const t = TRACKS[A.track], p = Math.min(100, (A.prog / t.d) * 100);
  const f = document.getElementById('mfill'), k = document.getElementById('mknob'), c = document.getElementById('mcur');
  if (f) f.style.width = p + '%'; if (k) k.style.left = p + '%'; if (c) c.textContent = fmt(A.prog);
}

/* ------------------------------------------------------- tela do servidor */
function membersListHTML() {
  const srv = curServer(); if (!srv) return '';
  const q = (A.search || '').trim().toLowerCase();
  const match = (p) => !q || p.name.toLowerCase().indexOf(q) !== -1;
  const on = srv.online.filter(match), off = srv.offline.filter(match);
  const plural = (n) => (n === 1 ? ' membro' : ' membros');
  const row = (p, offline) => `<div class="mrow${offline ? ' off' : ''}"><button type="button" class="pf" data-act="profile" data-id="${p.id}" aria-label="Ver perfil de ${esc(p.name)}" style="background:${p.g}">${esc(p.ini)}</button>
    <div class="tx" data-act="profile" data-id="${p.id}"><b>${esc(p.name)}${p.role === 'owner' ? ' 👑' : ''}</b><span>${esc(p.st)}</span></div>
    ${p.me ? '' : `<button type="button" class="hov dm" data-act="dm" data-id="${p.id}" aria-label="Enviar mensagem para ${esc(p.name)}">${ic(D.dm, 19, '#55555F', 1.6)}</button>`}</div>`;
  const grp = (open, key, label) => `<button type="button" class="hov mg" data-act="${key}" aria-expanded="${open}"><span>${label}</span>${ic(open ? D.up : D.down, 18)}</button>`;
  return `${grp(A.onlineOpen, 'otoggle', 'Online (' + on.length + plural(on.length) + ')')}
  ${A.onlineOpen ? `<div style="display:flex;flex-direction:column;gap:4px">${on.map((p) => row(p, false)).join('')}</div>` : ''}
  <div style="height:1px;margin:8px 0;background:rgba(29,29,34,.08)"></div>
  ${grp(A.offlineOpen, 'ftoggle', 'Offline (' + off.length + plural(off.length) + ')')}
  ${A.offlineOpen ? `<div style="display:flex;flex-direction:column;gap:4px">${off.map((p) => row(p, true)).join('')}</div>` : ''}
  ${on.length + off.length === 0 ? '<div style="padding:12px 4px;font-size:13px;color:#55555F">Nenhum membro encontrado para essa busca.</div>' : ''}`;
}

function serverMsgsHTML() {
  const dm = A.view === 'dm', srv = dm ? null : curServer(), key = A.channel, me = myId();
  if ((!srv && !dm) || !key) return '<div class="fill"></div><div class="empty">Este servidor ainda não tem canais de texto.</div>';
  if (!A.loaded[key]) return `<div class="fill"></div><div class="empty">${A.terr[key] ? 'Não foi possível carregar as mensagens. <button type="button" class="lnk" data-act="retry-thread">Tentar de novo</button>' : 'Carregando mensagens…'}</div>`;
  const th = (A.threads[key] || []).filter((m) => !A.blocked.has(m.from));
  const acts = (m) => {
    const mine = m.from === me;
    if (!mine && !(srv && srv.owner === me)) return '';
    return `<span class="mact">${mine ? `<button type="button" class="hov" data-act="msg-edit" data-id="${m.id}" aria-label="Editar mensagem">${ic(D.edit, 14, '#55555F', 1.8)}</button>` : ''}<button type="button" class="hov" data-act="msg-del" data-id="${m.id}" aria-label="Apagar mensagem">${ic(D.close, 14, '#55555F', 1.8)}</button></span>`;
  };
  return '<div class="fill"></div>'
    + (A.more[key] ? '<button type="button" class="lnk older" data-act="older">Ver mensagens mais antigas</button>' : '')
    + (th.length ? '' : '<div class="empty">Nenhuma mensagem ainda. Seja o primeiro a escrever.</div>')
    + th.map((m) => {
      const ed = m.edited ? ' <small class="ed">(editada)</small>' : '';
      if (m.from === me) return `<div class="mout">${acts(m)}<div class="bub"><span class="sr">Você: </span>${msgBody(m)}${ed}</div></div>`;
      const p = srv ? srv.byId[m.from] : dmPeer(key), nm = p ? p.name : 'Ex-membro';
      return `<div class="min"><div class="col"><button type="button" class="av40" data-act="profile" data-id="${m.from}" aria-label="Ver perfil de ${esc(nm)}" style="background:${p ? p.g : G.slate}">${esc(p ? p.ini : '')}</button><small>${esc(msgTime(m.at))}</small></div>
        <div class="bub"><button type="button" class="an" data-act="profile" data-id="${m.from}">${esc(nm)}</button>${msgBody(m)}${ed}</div>${acts(m)}</div>`;
    }).join('');
}

function composerHTML(ok, ph) {
  return `      <div class="comp">
        ${A.emojiOpen ? `<div class="emoji" role="group" aria-label="Escolher emoji">${EMOJIS.map((e) => `<button type="button" class="hov" data-act="emoji" data-ch="${e[0]}" aria-label="Inserir emoji ${e[1]}">${e[0]}</button>`).join('')}</div>` : ''}
        <div class="typing" id="typing" aria-live="polite"></div>
        <div class="cbar">
          <button type="button" class="hov plus" data-act="attach" aria-label="Anexar imagem">${ic(D.plus, 19)}</button>
          <input id="msg" type="text" placeholder="${ph}" maxlength="2000" value="${esc(A.draft)}" data-app-bind="draft" autocomplete="off" aria-label="Escreva uma mensagem"${ok ? '' : ' disabled'}>
          <button type="button" class="hov ib" data-act="toast-gift" aria-label="Enviar presente">${ic(D.gift, 19, '#55555F', 1.6)}</button>
          <button type="button" class="hov ib" data-act="toast-gif" aria-label="Escolher GIF"><span class="gif">GIF</span></button>
          <button type="button" class="hov ib" data-act="emoji-toggle" aria-label="Escolher emoji" aria-expanded="${A.emojiOpen}">${ic(D.smile, 19, '#55555F', 1.6)}</button>
          <button type="button" class="go" id="send-btn" data-act="send" aria-label="Enviar mensagem"${A.draft.trim() ? '' : ' hidden'}>${ic(D.send, 18, '#FFFFFF', 1.8)}</button>
        </div>
      </div>`;
}
function voiceBarHTML() {
  if (!A.voice) return '';
  const s = SERVERS.find((x) => x.voice.some((g) => g.id === A.voice)), g = s && s.voice.find((x) => x.id === A.voice);
  return `<div class="vbar" role="status"><span class="vdot"></span><span class="vt"><b>Voz conectada</b><small>${esc(g ? g.name : 'Sala')}${s ? ' · ' + esc(s.name) : ''}</small></span><button type="button" class="mbtn sm danger" data-act="vleave">Sair</button></div>`;
}
function sideMeHTML() {
  const mutedEff = A.muted || A.deafened;
  const me = displayName();
  return `${voiceBarHTML()}  <div class="me">
    ${menuHTML()}
    <div class="who"><button type="button" class="pic" data-act="profile" data-id="${myId()}" aria-label="Meu perfil" style="background:${meBg()}">${esc(meIni(me))}</button><strong title="${esc(S.session && S.session.user ? S.session.user.email : '')}">${esc(me)}</strong></div>
    <div class="tools">
      <button type="button" class="hov tb" data-act="mute" aria-label="${mutedEff ? 'Ativar microfone' : 'Silenciar microfone'}" aria-pressed="${mutedEff}">${mutedEff ? ic(D.micOff, 18, '#D92D45', 1.8) : ic(D.mic)}</button>
      <button type="button" class="hov tb" data-act="deaf" aria-label="${A.deafened ? 'Ativar áudio' : 'Desativar áudio'}" aria-pressed="${A.deafened}">${A.deafened ? ic(D.head + '<path d="M4 4l16 16"/>', 18, '#D92D45', 1.8) : ic(D.head)}</button>
      <button type="button" class="hov tb" data-act="menu" aria-label="Menu da conta" aria-haspopup="true" aria-expanded="${A.menu}">${ic(D.sliders)}</button>
    </div>
  </div>`;
}
function dmViewHTML() {
  const peer = dmPeer(A.channel) || { name: 'Conversa', ini: '?', g: G.lilac };
  const fr = friendsList().slice().sort((x, y) => (y.on ? 1 : 0) - (x.on ? 1 : 0) || x.name.localeCompare(y.name));
  const row = (f) => `<button type="button" class="dmrow ${f.dm && f.dm === A.channel ? 'sel' : 'hov'}" data-act="dm-open" data-id="${f.id}" aria-current="${!!(f.dm && f.dm === A.channel)}"><span class="pf sm" style="background:${f.g}">${esc(f.ini)}</span><span class="tx"><b>${esc(f.name)}</b><small>${f.on ? 'Online' : 'Offline'}</small></span>${f.dm ? udot(f.dm) : ''}</button>`;
  return `<div class="ap">
<div class="cloud" aria-hidden="true" style="left:-120px;bottom:-160px;width:560px;height:460px;background:radial-gradient(closest-side,rgba(140,140,158,.42),rgba(140,140,158,0))"></div>
<aside class="side" aria-label="Mensagens diretas">
  <div class="sbrand">${logo(14)}${BRAND}</div>
  <div class="sscroll" id="sscroll">
    <div class="blk">
      <div class="bh"><span>${ic(D.bubble, 19, '#55555F', 1.6)}Mensagens diretas</span><button type="button" class="hov sq" data-act="toast-friend" aria-label="Adicionar amigo">${ic(D.userPlus, 18)}</button></div>
      ${fr.length ? fr.map(row).join('') : '<p class="mnote">Você ainda não tem amigos. Use o botão acima para adicionar.</p>'}
    </div>
  </div>
  ${sideMeHTML()}
</aside>
<div class="main">
  <header class="top">
    <div class="t">${ic(D.bubble, 24, '#55555F', 1.6)}<div style="min-width:0"><h1>${esc(peer.name)}</h1><small>${peer.user ? '@' + esc(peer.user) : ''}${peer.status ? ' · ' + esc(peer.status) : ''}</small></div></div>
    <nav class="nav" aria-label="Ferramentas da conversa">
      <button type="button" class="nbtn ${A.panel === 'search' ? 'sel' : 'hov'}" data-act="nav" data-k="search">${ic(D.search, 18, '#55555F', 1.6)}Buscar</button>
      <button type="button" class="nbtn hov" data-act="profile" data-id="${peer.id}">${ic(D.users, 18, '#55555F', 1.6)}Perfil</button>
      <button type="button" class="nbtn hov" data-act="hub">${ic(D.bubble, 18, '#55555F', 1.6)}Voltar ao painel</button>
    </nav>
  </header>
  <div class="body">
    <section class="chat" aria-label="Conversa privada">
      <div class="ch">${ic(D.at, 19, '#55555F', 1.6)}<h2>${esc(peer.name)}</h2></div>
      <div class="msgs" id="msgs" role="log" aria-label="Mensagens" aria-live="polite">${serverMsgsHTML()}</div>
      ${composerHTML(true, 'Escreva para ' + peer.name + '...')}
    </section>
  </div>
</div>
</div>`;
}
function serverHTML() {
  const srv = curServer();
  const mutedEff = A.muted || A.deafened;
  const me = displayName();
  const chObj = srv.text.find((c) => c.id === A.channel);
  const nav = (k, icon, label, on) => `<button type="button" class="nbtn ${on ? 'sel' : 'hov'}" data-act="nav" data-k="${k}" aria-pressed="${!!on}">${ic(icon, 18, '#55555F', 1.6)}${label}</button>`;
  const plus = (label, kind) => (srv.mine ? `<button type="button" class="hov sq" data-act="modal-open" data-k="chan" data-kind="${kind}" aria-label="${label}">${ic(D.plus, 18)}</button>` : '');
  const nMem = srv.users + (srv.users === 1 ? ' membro' : ' membros');

  return `<div class="ap">
<div class="cloud" aria-hidden="true" style="left:-120px;bottom:-160px;width:560px;height:460px;background:radial-gradient(closest-side,rgba(140,140,158,.42),rgba(140,140,158,0))"></div>
<div class="cloud" aria-hidden="true" style="left:190px;top:38%;width:420px;height:300px;background:radial-gradient(closest-side,rgba(176,176,192,.32),rgba(176,176,192,0))"></div>

<aside class="side" aria-label="Servidores e canais">
  <div class="sbrand">${logo(14)}${BRAND}</div>
  <label class="search"><input id="search" type="text" placeholder="Buscar membros" value="${esc(A.search)}" data-app-bind="search" autocomplete="off" aria-label="Buscar membros">${ic(D.search, 17)}</label>
  <div class="sscroll" id="sscroll">
    <div class="blk" style="gap:8px">
      <div class="bh"><span>${ic(D.gamepad, 19, '#55555F', 1.6)}Seus servidores</span><button type="button" class="hov sq" data-act="modal-open" data-k="srv" data-mode="create" aria-label="Criar ou entrar em um servidor">${ic(D.plus, 18)}</button></div>
      <div class="tiles">${SERVERS.map((s) => { const on = s.id === srv.id; return `<button type="button" class="tile" data-act="srv" data-id="${s.id}" aria-pressed="${on}" aria-label="${esc(s.name)}, ${s.users} membros">
        <span class="art" style="background:${s.tile};box-shadow:${on ? '0 0 0 2px #FFFFFF,0 0 0 4px #1D1D22,0 10px 18px rgba(29,29,34,.2)' : '0 8px 16px rgba(29,29,34,.16)'}">${esc(s.ini)}</span>
        <span class="n">${esc(s.name)}</span><span class="u">${s.users} ${s.users === 1 ? 'membro' : 'membros'}</span></button>`; }).join('')}</div>
    </div>
    <div class="div"></div>
    <div class="blk">
      <div class="bh"><span>${ic(D.hash, 19, '#55555F', 1.6)}Canais de texto</span>${plus('Adicionar canal de texto', 'text')}</div>
      ${srv.text.map((c) => { const on = A.channel === c.id; return `<button type="button" class="chan ${on ? 'sel' : 'hov'}" data-act="chan" data-id="${c.id}" aria-current="${on}" style="font-weight:${on ? 700 : 400}">${esc(c.name)}</button>`; }).join('')}
    </div>
    <div class="div"></div>
    <div class="blk">
      <div class="bh"><span>${ic(D.volume, 19, '#55555F', 1.6)}Canais de voz</span>${plus('Adicionar canal de voz', 'voice')}</div>
      ${srv.voice.map((g) => { const on = A.voice === g.id; return `<div class="vg"><div class="vgh"><button type="button" class="hov vjoin" data-act="vjoin" data-id="${g.id}" aria-label="${on ? 'Você está em ' : 'Entrar em '}${esc(g.name)}" style="color:#33333A"><i style="background:${on ? '#3BB273' : 'rgba(29,29,34,.22)'}"></i><span>${esc(g.name)}</span></button></div>${voiceRoster(g.id).map((u) => { const p = srv.byId[u]; return p ? `<div class="vu"><span class="pf xs" style="background:${p.g}">${esc(p.ini)}</span><span class="vn">${esc(p.name)}</span></div>` : ''; }).join('')}</div>`; }).join('')}
    </div>
  </div>
  ${sideMeHTML()}
</aside>

<div class="main">
  <header class="top">
    <div class="t">${ic(D.gamepad, 24, '#55555F', 1.6)}<div style="min-width:0"><h1>${esc(srv.name)}</h1><small>${nMem}</small></div></div>
    <nav class="nav" aria-label="Ferramentas do servidor">
      ${nav('invite', D.userPlus, 'Convidar', false)}${nav('notif', D.bell, 'Notificações', A.panel === 'notif')}${nav('pins', D.pin, 'Mensagens fixadas', A.panel === 'pins')}${nav('members', D.users, 'Lista de membros', A.showMembers)}${nav('search', D.search, 'Buscar mensagens', A.panel === 'search')}${nav('mentions', D.at, 'Menções', A.panel === 'mentions')}${nav('help', D.help, 'Central de ajuda', A.panel === 'help')}
    </nav>
  </header>
  <div class="body">
    ${A.showMembers ? `<aside class="mem" aria-label="Lista de membros"><h3>${ic(D.users, 20, '#55555F', 1.6)}Lista de membros</h3>${srv.mine ? '<button type="button" class="lnk banlnk" data-act="bans">Ver banidos</button>' : ''}<div class="mlist" id="mlist">${membersListHTML()}</div></aside>` : ''}
    <section class="chat" aria-label="Conversa">
      <div class="ch">${ic(D.hash, 19, '#55555F', 1.6)}<h2>${esc(chObj ? chObj.name : 'Sem canal')}</h2></div>
      <div class="msgs" id="msgs" role="log" aria-label="Mensagens" aria-live="polite">${serverMsgsHTML()}</div>
      ${composerHTML(!!chObj, chObj ? 'Escreva algo...' : 'Crie um canal de texto para conversar')}
    </section>
  </div>
</div>
</div>`;
}

/* ------------------------------------------------------------- janelas */
const inviteCode = (v) => { const s = String(v || '').trim(); const mm = s.match(/[?&]c=([0-9a-z]+)/i); return (mm ? mm[1] : s).toLowerCase().replace(/[^0-9a-z]/g, ''); };
const inviteLink = (code) => location.origin + location.pathname + '#join?c=' + code;
const mField = (id, label, field, value, o = {}) => `<div class="mf"><label for="${id}">${label}</label>${o.area
  ? `<textarea id="${id}" data-mf data-app-bind="m:${field}" maxlength="${o.max || 190}" rows="3" placeholder="${esc(o.ph || '')}">${esc(value)}</textarea>`
  : `<input id="${id}" data-mf type="text" data-app-bind="m:${field}" maxlength="${o.max || 60}" value="${esc(value)}" placeholder="${esc(o.ph || '')}" autocomplete="off" spellcheck="false">`}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</div>`;

function modalHTML() {
  const m = A.modal; if (!m) return '';
  let title = '', body = '', foot = '', label = 'Salvar';
  const tabs = (items) => `<div class="mtabs" role="tablist">${items.map((t) => `<button type="button" role="tab" class="mtab${t.on ? ' on' : ''}" data-act="${t.act}" data-mode="${t.mode}" aria-selected="${t.on}">${t.l}</button>`).join('')}</div>`;
  if (m.type === 'srv') {
    title = m.mode === 'join' ? 'Entrar em um servidor' : 'Criar um servidor';
    label = m.mode === 'join' ? 'Entrar' : 'Criar servidor';
    body = tabs([{ act: 'modal-mode', mode: 'create', l: 'Criar servidor', on: m.mode !== 'join' }, { act: 'modal-mode', mode: 'join', l: 'Entrar com convite', on: m.mode === 'join' }])
      + (m.mode === 'join' ? mField('mf-code', 'Código ou link do convite', 'code', m.code, { ph: 'Cole aqui o código', max: 200 })
        : mField('mf-name', 'Nome do servidor', 'name', m.name, { ph: 'Ex.: Meus amigos', max: 40, hint: 'Você será o dono. Já vem com os canais Geral e Sala principal.' }));
  } else if (m.type === 'chan') {
    title = 'Criar canal'; label = 'Criar canal';
    body = tabs([{ act: 'modal-mode', mode: 'text', l: 'Texto', on: m.kind !== 'voice' }, { act: 'modal-mode', mode: 'voice', l: 'Voz', on: m.kind === 'voice' }])
      + mField('mf-name', 'Nome do canal', 'name', m.name, { ph: m.kind === 'voice' ? 'Ex.: Sala de jogos' : 'Ex.: Avisos', max: 30 })
      + (m.kind === 'voice' ? '<p class="mnote">Até 6 pessoas por sala. O áudio vai direto entre os participantes.</p>' : '');
  } else if (m.type === 'invite') {
    title = 'Convidar para o servidor';
    body = m.busy ? '<p class="mnote">Gerando convite…</p>' : (m.code
      ? `<div class="mf"><label for="mf-link">Link do convite</label><input id="mf-link" type="text" readonly value="${esc(inviteLink(m.code))}"><small>Código: <b>${esc(m.code)}</b> · vale por 7 dias e até 50 usos.</small></div>`
      : '');
    foot = m.code ? '<button type="button" class="mbtn" data-act="modal-copy">Copiar link</button>' : '';
  } else if (m.type === 'edit') {
    title = 'Editar mensagem'; label = 'Salvar';
    body = mField('mf-text', 'Mensagem', 'text', m.text, { max: 2000 });
  } else if (m.type === 'del') {
    title = 'Apagar mensagem'; label = 'Apagar';
    body = '<p class="mnote">Tem certeza? Isso não pode ser desfeito.</p>';
  } else if (m.type === 'profile') {
    const p = findPerson(m.id);
    title = 'Perfil';
    if (!p) body = '<p class="mnote">Não foi possível encontrar este perfil.</p>';
    else {
      const since = p.since ? new Date(p.since).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—';
      body = `<div class="pcard"><div class="pban" style="background:${esc(p.accent)}"></div><div class="pcb">
        <span class="pavl" style="background:${p.g}" aria-hidden="true">${esc(p.ini)}</span>
        <h3>${esc(p.name)}${p.on ? '<i class="pon" title="Online"></i>' : ''}</h3>
        <div class="pu">${p.user ? '@' + esc(p.user) : ''}</div>
        ${p.status ? `<div class="pst">${esc(p.status)}</div>` : ''}
        <p class="pbio${p.bio ? '' : ' none'}">${p.bio ? esc(p.bio) : 'Esta pessoa ainda não escreveu uma bio.'}</p>
        <dl class="pmeta"><div><dt>Membro desde</dt><dd>${esc(since)}</dd></div></dl>
      </div></div>`;
      const rel = p.me ? 'me' : relOf(p.id), dis = m.busy ? ' disabled' : '';
      foot = rel === 'me' ? '<button type="button" class="mbtn" data-act="edit-profile">Editar perfil</button>'
        : rel === 'friend' ? `<button type="button" class="mbtn ghost" data-act="fr-remove" data-id="${p.id}"${dis}>Remover amigo</button><button type="button" class="mbtn" data-act="dm" data-id="${p.id}"${dis}>Enviar mensagem</button>`
        : rel === 'incoming' ? `<button type="button" class="mbtn ghost" data-act="fr-decline" data-id="${p.id}"${dis}>Recusar</button><button type="button" class="mbtn" data-act="fr-accept" data-id="${p.id}"${dis}>Aceitar pedido</button>`
        : rel === 'blocked' ? `<button type="button" class="mbtn" data-act="fr-unblock" data-id="${p.id}"${dis}>Desbloquear</button>`
        : rel === 'outgoing' ? `<button type="button" class="mbtn ghost" data-act="fr-remove" data-id="${p.id}"${dis}>Cancelar pedido</button>`
        : `<button type="button" class="mbtn" data-act="fr-add" data-user="${esc(p.user)}"${dis}>Adicionar amigo</button>`;
      const sv = A.view === 'server' ? curServer() : null;
      if (sv && sv.mine && !p.me && sv.byId[p.id]) foot = `<button type="button" class="blink" data-act="mod" data-k="kick" data-id="${p.id}"${dis}>Expulsar</button><button type="button" class="blink" data-act="mod" data-k="ban" data-id="${p.id}"${dis}>Banir</button>` + foot;
      if (rel !== 'me' && rel !== 'blocked') foot = `<button type="button" class="blink" data-act="fr-block" data-id="${p.id}"${dis}>Bloquear</button>` + foot;
    }
  } else if (m.type === 'mod') {
    title = m.k === 'ban' ? 'Banir do servidor' : 'Expulsar do servidor'; label = m.k === 'ban' ? 'Banir' : 'Expulsar';
    body = `<p class="mnote">${m.k === 'ban' ? 'Banir' : 'Expulsar'} ${esc(m.name)}? ${m.k === 'ban' ? 'A pessoa sai do servidor e não consegue voltar por convite, até você desbanir.' : 'A pessoa sai do servidor, mas pode voltar com um novo convite.'}</p>`;
  } else if (m.type === 'bans') {
    title = 'Pessoas banidas';
    body = m.items == null ? '<p class="mnote">Carregando…</p>' : m.items.length ? `<div class="banlist">${m.items.map((b) => `<div class="banrow"><span><b>${esc(b.display_name || 'Pessoa')}</b>${b.username ? ' <small>@' + esc(b.username) + '</small>' : ''}</span><button type="button" class="mbtn sm ghost" data-act="unban" data-id="${b.user_id}"${m.busy ? ' disabled' : ''}>Desbanir</button></div>`).join('')}</div>` : '<p class="mnote">Ninguém foi banido deste servidor.</p>';
    foot = '<button type="button" class="mbtn ghost" data-act="modal-close">Fechar</button>';
  } else if (m.type === 'block') {
    title = 'Bloquear pessoa'; label = 'Bloquear';
    body = `<p class="mnote">Bloquear ${esc(m.name)}? Vocês deixam de ser amigos e você não verá as mensagens dela nos servidores. Você pode desbloquear depois, no perfil dela.</p>`;
  } else if (m.type === 'addfriend') {
    title = 'Adicionar amigo'; label = 'Enviar pedido';
    body = mField('mf-user', '@usuário do seu amigo', 'user', m.user, { ph: 'Ex.: marina', max: 30, hint: 'A pessoa recebe o pedido na central de notificações.' });
  } else if (m.type === 'editprofile') {
    title = 'Editar perfil'; label = 'Salvar';
    const meP = A.me || {};
    body = `<div class="avrow"><span class="pavl" style="background:${meP.g || G.lilac}" aria-hidden="true">${esc(meIni(m.display || ''))}</span><div class="avbtns"><button type="button" class="mbtn ghost sm" data-act="avatar-pick"${m.busy ? ' disabled' : ''}>${meP.avatar ? 'Trocar foto' : 'Escolher foto'}</button>${meP.avatar ? '<button type="button" class="lnk" data-act="avatar-remove">Remover foto</button>' : ''}<input type="file" id="mf-avatar" accept="image/jpeg,image/png,image/webp" hidden></div></div>`
      + mField('mf-display', 'Nome exibido', 'display', m.display, { max: 40 })
      + mField('mf-status', 'Status', 'status', m.status, { max: 60, ph: 'O que você está fazendo?' })
      + mField('mf-bio', 'Sobre mim', 'bio', m.bio, { max: 190, area: true, ph: 'Conte um pouco sobre você', hint: 'Até 190 caracteres.' })
      + `<div class="mf"><span class="lblx">Cor do perfil</span><div class="swatches">${ACCENTS.map((c) => `<button type="button" class="swatch${m.accent === c ? ' on' : ''}" data-act="m-accent" data-c="${c}" aria-pressed="${m.accent === c}" aria-label="Cor ${c}" style="background:${c}"></button>`).join('')}</div></div>`;
  }
  const showSubmit = !(m.type === 'invite' || m.type === 'profile' || m.type === 'bans');
  return `<div class="mback" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="mhead"><h2>${esc(title)}</h2><button type="button" class="hov sq" data-act="modal-close" aria-label="Fechar">${ic(D.close, 16, '#55555F', 1.8)}</button></header>
    <div class="mbody">${body}${m.err ? `<div class="merr" role="alert">${esc(m.err)}</div>` : ''}</div>
    <footer class="mfoot">${showSubmit ? `<button type="button" class="mbtn ghost" data-act="modal-close">Cancelar</button><button type="button" class="mbtn${m.type === 'del' || m.type === 'block' || m.type === 'mod' ? ' danger' : ''}" data-act="modal-submit"${m.busy ? ' disabled' : ''}>${m.busy ? 'Aguarde…' : label}</button>` : foot}</footer>
  </div></div>`;
}
function focusModal() { setTimeout(() => { const f = document.querySelector('.modal [data-mf]'); if (f) f.focus(); }, 0); }
/* ---- foto de perfil: reduz para 256x256 no navegador e envia ao Supabase Storage ---- */
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file);
  const n = 256, side = Math.min(bmp.width, bmp.height), c = document.createElement('canvas');
  c.width = c.height = n;
  c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, n, n);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('img'))), 'image/jpeg', 0.85));
}
async function storageCall(method, path, body, type, bucket) {
  const t = await freshToken(); if (!t) throw { message: 'not_authenticated', status: 401 };
  const h = { apikey: C.SUPABASE_KEY, authorization: 'Bearer ' + t };
  if (type) h['content-type'] = type;
  let r; try { r = await fetch(C.SUPABASE_URL + '/storage/v1/object/' + (bucket || 'avatars') + '/' + path, { method, headers: h, body }); } catch (e) { throw { message: 'network', status: 0 }; }
  if (!r.ok) throw { message: 'upload_failed', status: r.status };
}
async function setAvatar(file) {
  const m = A.modal; if (!m || m.type !== 'editprofile' || m.busy) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { m.err = 'Use uma imagem JPG, PNG ou WebP.'; return render(); }
  if (file.size > 10 * 1024 * 1024) { m.err = 'A imagem é muito grande (máximo 10 MB).'; return render(); }
  m.busy = true; m.err = ''; render();
  try {
    const blob = await shrinkImage(file);
    const old = (A.me && A.me.avatar) || '', path = myId() + '/' + Date.now() + '.jpg';
    await storageCall('POST', path, blob, 'image/jpeg');
    await sb('/rest/v1/profiles?id=eq.' + myId(), { method: 'PATCH', body: { avatar_path: path } });
    if (old) storageCall('DELETE', old).catch(() => {});
    await loadWorld(() => {});
    toast('Foto atualizada');
  } catch (e) { m.err = e && e.message === 'upload_failed' ? 'Não foi possível enviar a foto. Tente outra imagem.' : errText(e); }
  m.busy = false; if (A.modal === m) render();
}
async function removeAvatar() {
  const m = A.modal; if (!m || m.busy || !(A.me && A.me.avatar)) return;
  m.busy = true; m.err = ''; render();
  const old = A.me.avatar;
  try {
    await sb('/rest/v1/profiles?id=eq.' + myId(), { method: 'PATCH', body: { avatar_path: null } });
    storageCall('DELETE', old).catch(() => {});
    await loadWorld(() => {});
    toast('Foto removida');
  } catch (e) { m.err = errText(e); }
  m.busy = false; if (A.modal === m) render();
}
function closeModal() { A.modal = null; render(); }

async function openInvite() {
  const s = curServer(); if (!s) return;
  const m = A.modal = { type: 'invite', code: '', err: '', busy: true };
  render();
  try { const code = await rpc('create_invite', { p_server: s.id }); if (A.modal === m) { m.code = code; m.busy = false; render(); } }
  catch (e) { if (A.modal === m) { m.busy = false; m.err = errText(e); render(); } }
}
function modalErr(msg) { A.modal.err = msg; render(); focusModal(); }
async function modalSubmit() {
  const m = A.modal; if (!m || m.busy) return;
  m.err = '';
  const run = async (fn) => {
    m.busy = true; render();
    try { await fn(); }
    catch (e) { if (A.modal === m) { m.busy = false; m.err = errText(e); render(); } }
  };
  if (m.type === 'srv' && m.mode !== 'join') {
    const name = m.name.trim();
    if (name.length < 2) return modalErr('O nome precisa ter de 2 a 40 caracteres.');
    return run(async () => { const id = await rpc('create_server', { p_name: name }); await loadWorld(() => {}); selectServer(id); A.modal = null; render({ scroll: true }); toast('Servidor criado'); });
  }
  if (m.type === 'srv') {
    const code = inviteCode(m.code);
    if (code.length < 4) return modalErr('Cole o código ou o link do convite.');
    return run(async () => { const id = await rpc('join_server', { p_code: code }); await loadWorld(() => {}); selectServer(id); A.modal = null; render({ scroll: true }); toast('Você entrou no servidor'); });
  }
  if (m.type === 'chan') {
    const name = m.name.trim(), s = curServer();
    if (!name) return modalErr('Dê um nome ao canal.');
    return run(async () => { const id = await rpc('create_channel', { p_server: s.id, p_name: name, p_kind: m.kind === 'voice' ? 'voice' : 'text' }); await loadWorld(() => {}); if (m.kind !== 'voice') A.channel = id; A.modal = null; render({ scroll: true }); toast('Canal criado'); });
  }
  if (m.type === 'edit') {
    const text = m.text.trim();
    if (!text) return modalErr('A mensagem não pode ficar vazia.');
    return run(async () => {
      await sb('/rest/v1/messages?id=eq.' + m.id, { method: 'PATCH', body: { content: text } });
      const x = (A.threads[m.key] || []).find((y) => String(y.id) === String(m.id)); if (x) { x.text = text; x.edited = true; }
      A.modal = null; render();
    });
  }
  if (m.type === 'del') {
    return run(async () => {
      await sb('/rest/v1/messages?id=eq.' + m.id, { method: 'DELETE' });
      A.threads[m.key] = (A.threads[m.key] || []).filter((y) => String(y.id) !== String(m.id));
      A.modal = null; render();
    });
  }
  if (m.type === 'mod') {
    const s = curServer();
    return run(async () => { await rpc(m.k === 'ban' ? 'ban_member' : 'kick_member', { p_server: s.id, p_user: m.id }); await loadWorld(() => {}); A.modal = null; render(); toast(m.k === 'ban' ? 'Pessoa banida' : 'Pessoa expulsa'); });
  }
  if (m.type === 'block') {
    return run(async () => { await rpc('block_user', { p_other: m.id }); await loadWorld(() => {}); A.modal = null; render(); toast('Pessoa bloqueada'); });
  }
  if (m.type === 'addfriend') {
    const u = m.user.trim().replace(/^@/, '');
    if (!u) return modalErr('Digite o @usuário da pessoa.');
    return run(async () => { const r = await rpc('send_friend_request', { p_username: u }); await loadWorld(() => {}); A.modal = null; render(); toast(FR_MSG[r] || 'Pronto'); });
  }
  if (m.type === 'editprofile') {
    const display = m.display.trim();
    if (!display) return modalErr('Informe um nome exibido.');
    return run(async () => {
      await sb('/rest/v1/profiles?id=eq.' + myId(), { method: 'PATCH', body: { display_name: display, status_text: m.status.trim(), bio: m.bio.trim(), accent: m.accent } });
      await loadWorld(() => {}); A.modal = null; render(); toast('Perfil atualizado');
    });
  }
}
/* ---- amigos e conversas privadas ---- */
const FR_MSG = { pending: 'Pedido de amizade enviado', accepted: 'Agora vocês são amigos!', friends: 'Vocês já são amigos' };
async function friendAct(kind, id, user, full) {
  const m = A.modal; if (m && m.busy) return;
  if (m) { m.busy = true; m.err = ''; render(); }
  const w = A;
  try {
    let msg = '';
    if (kind === 'add') msg = FR_MSG[await rpc('send_friend_request', { p_username: user })] || 'Pronto';
    else if (kind === 'accept') { await rpc('respond_friend_request', { p_other: id, p_accept: true }); msg = 'Agora vocês são amigos!'; }
    else if (kind === 'decline') { await rpc('respond_friend_request', { p_other: id, p_accept: false }); msg = 'Pedido recusado'; }
    else if (kind === 'unblock') { await rpc('unblock_user', { p_other: id }); msg = 'Pessoa desbloqueada'; }
    else if (kind === 'remove') { await rpc('remove_friend', { p_other: id }); msg = 'Pronto'; }
    else if (kind === 'dm') {
      const ch = await rpc('open_dm', { p_other: id });
      await loadWorld(() => {});
      if (A !== w) return;
      if (full) { A.channel = ch; A.view = 'dm'; } else { A.hubKey = ch; A.view = 'hub'; }
      A.panel = null; A.modal = null; A.menu = false;
      render({ scroll: true }); return;
    }
    await loadWorld(() => {});
    if (A !== w) return;
    A.modal = null; render(); toast(msg);
  } catch (e) {
    if (A === w) { if (A.modal) { A.modal.busy = false; A.modal.err = errText(e); render(); } else toast(errText(e)); }
  }
}
function openMsgModal(type, el) {
  const key = curKey(), m = (A.threads[key] || []).find((y) => String(y.id) === String(el.dataset.id));
  if (!m) return;
  A.modal = { type, id: m.id, key, text: m.text, err: '', busy: false };
  render(); focusModal();
}
/* ações das janelas; devolve true quando tratou */
function modalAct(act, el, ev) {
  switch (act) {
    case 'modal-bg': if (ev && ev.target === el) closeModal(); return true;
    case 'modal-close': closeModal(); return true;
    case 'modal-submit': modalSubmit(); return true;
    case 'modal-mode': if (A.modal) { if (A.modal.type === 'chan') A.modal.kind = el.dataset.mode; else A.modal.mode = el.dataset.mode; A.modal.err = ''; render(); focusModal(); } return true;
    case 'modal-open': {
      A.menu = false;
      const k = el.dataset.k;
      if (k === 'chan') {
        const s = curServer(); if (!s) return true;
        if (!s.mine) { toast('Só o dono do servidor cria canais.'); return true; }
        A.modal = { type: 'chan', kind: el.dataset.kind === 'voice' ? 'voice' : 'text', name: '', err: '', busy: false };
      } else A.modal = { type: 'srv', mode: el.dataset.mode === 'join' ? 'join' : 'create', name: '', code: '', err: '', busy: false };
      render(); focusModal(); return true;
    }
    case 'modal-copy': {
      const link = inviteLink(A.modal ? A.modal.code : '');
      const fallback = () => { const i = document.getElementById('mf-link'); if (i) { i.focus(); i.select(); } toast('Selecione o link e copie'); };
      try { navigator.clipboard.writeText(link).then(() => toast('Link copiado'), fallback); } catch (e) { fallback(); }
      return true;
    }
    case 'm-accent': if (A.modal) { A.modal.accent = el.dataset.c; render(); } return true;
    case 'profile': A.menu = false; A.modal = { type: 'profile', id: el.dataset.id }; render(); return true;
    case 'avatar-pick': { const f = document.getElementById('mf-avatar'); if (f) f.click(); return true; }
    case 'avatar-remove': removeAvatar(); return true;
    case 'edit-profile': {
      A.menu = false; const me = A.me || {};
      A.modal = { type: 'editprofile', display: me.name || displayName(), status: me.status || '', bio: me.bio || '', accent: me.accent || ACCENTS[0], err: '', busy: false };
      render(); focusModal(); return true;
    }
    case 'toast-friend': A.menu = false; A.modal = { type: 'addfriend', user: '', err: '', busy: false }; render(); focusModal(); return true;
    case 'fr-add': friendAct('add', '', el.dataset.user); return true;
    case 'fr-accept': friendAct('accept', el.dataset.id); return true;
    case 'fr-decline': friendAct('decline', el.dataset.id); return true;
    case 'fr-remove': friendAct('remove', el.dataset.id); return true;
    case 'dm': A.menu = false; friendAct('dm', el.dataset.id); return true;
    case 'dm-open': friendAct('dm', el.dataset.id, '', true); return true;
    case 'dm-sel': A.channel = el.dataset.ch; A.panel = null; render({ scroll: true }); return true;
    case 'mod': { const p = findPerson(el.dataset.id); if (p) { A.modal = { type: 'mod', k: el.dataset.k, id: p.id, name: p.name, err: '', busy: false }; render(); } return true; }
    case 'bans': { const s = curServer(); if (!s) return true; const m = A.modal = { type: 'bans', items: null, err: '', busy: false }; render(); rpc('list_bans', { p_server: s.id }).then((r) => { if (A.modal === m) { m.items = r || []; render(); } }).catch((e) => { if (A.modal === m) { m.items = []; m.err = errText(e); render(); } }); return true; }
    case 'unban': { const m = A.modal, s = curServer(); if (!m || !s) return true; m.busy = true; render(); rpc('unban_member', { p_server: s.id, p_user: el.dataset.id }).then(() => { m.items = (m.items || []).filter((b) => b.user_id !== el.dataset.id); m.busy = false; render(); toast('Pessoa desbanida'); }).catch((e) => { m.busy = false; m.err = errText(e); render(); }); return true; }
    case 'fr-unblock': friendAct('unblock', el.dataset.id); return true;
    case 'fr-block': { const p = findPerson(el.dataset.id); if (p) { A.modal = { type: 'block', id: p.id, name: p.name, err: '', busy: false }; render(); focusModal(); } return true; }
    case 'msg-edit': openMsgModal('edit', el); return true;
    case 'msg-del': openMsgModal('del', el); return true;
    default: return false;
  }
}

const esq = (t) => encodeURIComponent('*' + t.replace(/[*%,()\\]/g, ' ').trim() + '*');
function resRow(r) {
  const f = findPerson(r.author_id), srv = serverOfChan(r.channel_id);
  const ch = srv ? (srv.text.find((c) => c.id === r.channel_id) || {}).name : '';
  return `<button type="button" class="it res" data-act="goto-msg" data-ch="${r.channel_id}"><b>${esc(f ? f.name : 'Alguém')}${ch ? ' · #' + esc(ch) : ''} <small>${esc(msgTime(r.created_at))}</small></b><span>${esc(r.attachment_path && r.content === '📷 Imagem' ? '📷 Imagem' : r.content)}</span></button>`;
}
function searchPanelHTML() {
  const q = (A.sq || '').trim(), rs = A.sres;
  return `<div class="it"><input id="sq" class="sqin" type="text" placeholder="Buscar neste canal" maxlength="80" value="${esc(A.sq || '')}" data-app-bind="sq" autocomplete="off" aria-label="Buscar mensagens neste canal"></div>`
    + (q.length < 2 ? '<div class="it"><span>Digite pelo menos 2 letras.</span></div>' : rs == null ? '<div class="it"><span>Buscando…</span></div>' : rs.length ? rs.map(resRow).join('') : '<div class="it"><span>Nenhuma mensagem encontrada.</span></div>');
}
function mentionsPanelHTML() {
  const rs = A.mres;
  return rs == null ? '<div class="it"><span>Carregando…</span></div>' : rs.length ? rs.map(resRow).join('') : '<div class="it"><span>Ninguém mencionou você ainda.</span></div>';
}
let sqTimer = null;
function runSearch() {
  const q = (A.sq || '').trim(), key = curKey(), w = A;
  if (q.length < 2 || !key) { A.sres = null; return; }
  A.sres = null;
  sb('/rest/v1/messages?select=id,channel_id,author_id,content,created_at,attachment_path&channel_id=eq.' + key + '&content=ilike.' + esq(q) + '&order=id.desc&limit=30')
    .then((rows) => { if (A === w && A.sq.trim() === q) { A.sres = rows; if (A.panel === 'search') render(); } })
    .catch((e) => { if (A === w) { A.sres = []; toast(errText(e)); if (A.panel === 'search') render(); } });
}
function loadMentions() {
  const u = A.me && A.me.user, w = A; A.mres = null;
  if (!u) { A.mres = []; return; }
  sb('/rest/v1/messages?select=id,channel_id,author_id,content,created_at,attachment_path&content=ilike.' + esq('@' + u) + '&author_id=neq.' + myId() + '&order=id.desc&limit=20')
    .then((rows) => { if (A === w) { A.mres = rows.filter((r) => serverOfChan(r.channel_id) && mentionsMe(r.content) && !A.blocked.has(r.author_id)); if (A.panel === 'mentions') render(); } })
    .catch(() => { if (A === w) { A.mres = []; if (A.panel === 'mentions') render(); } });
}
function appView() {
  const enter = !A.entered; A.entered = true;
  const panel = A.panel ? PANELS[A.panel] : null;
  const reqRow = (p) => `<div class="it req"><button type="button" class="pf" data-act="profile" data-id="${p.id}" aria-label="Ver perfil de ${esc(p.name)}" style="background:${p.g}">${esc(p.ini)}</button><span class="tx"><b>${esc(p.name)}</b><span>Quer ser seu amigo${p.user ? ' · @' + esc(p.user) : ''}</span></span><button type="button" class="mbtn sm ghost" data-act="fr-decline" data-id="${p.id}">Recusar</button><button type="button" class="mbtn sm" data-act="fr-accept" data-id="${p.id}">Aceitar</button></div>`;
  const panelHTML = panel ? `<div class="panel" role="dialog" aria-label="${panel.title}"><div class="ph"><span>${panel.title}</span><button type="button" class="hov sq" data-act="close-panel" aria-label="Fechar painel">${ic(D.close, 16, '#55555F', 1.8)}</button></div>
    ${A.panel === 'search' ? searchPanelHTML() : A.panel === 'mentions' ? mentionsPanelHTML() : A.panel === 'notif' ? (A.incoming.length ? A.incoming.map(reqRow).join('') : '<div class="it"><span>Nada por aqui ainda.</span></div>') : panel.items.length ? panel.items.map((it) => `<div class="it"><b>${esc(it.t)}</b><span>${esc(it.s)}</span></div>`).join('') : '<div class="it"><span>Nada por aqui ainda.</span></div>'}</div>` : '';
  markCur();
  const showServer = A.view === 'server' && SERVERS.length && A.world === 'ready';
  const showDm = A.view === 'dm' && A.world === 'ready';
  return `<div class="shell">
<div class="cloud" aria-hidden="true" style="left:-140px;bottom:-180px;width:600px;height:480px;background:radial-gradient(closest-side,rgba(140,140,158,.34),rgba(140,140,158,0))"></div>
<div class="cloud c2" aria-hidden="true" style="right:-160px;top:20%;width:520px;height:420px;background:radial-gradient(closest-side,rgba(214,200,240,.4),rgba(214,200,240,0))"></div>
${topbarHTML()}${panelHTML}${showServer ? serverHTML() : showDm ? dmViewHTML() : hubHTML(enter)}${!showServer && !showDm && A.voice ? voiceBarHTML().replace('class="vbar"', 'class="vbar fix"') : ''}${modalHTML()}</div>`;
}

function appAction(act, el, ev) {
  if (modalAct(act, el, ev)) return;
  const wasMenu = A.menu;
  const quiet = () => { if (wasMenu) { A.menu = false; const m = document.querySelector('.menu'); if (m) m.remove(); } };
  // ações que só mexem no que já está na tela (assim as animações rodam sem recarregar tudo)
  switch (act) {
    case 'bar': {
      quiet(); A.barOpen = !A.barOpen;
      const b = document.getElementById('ubar'); if (b) b.classList.toggle('open', A.barOpen);
      const d = document.getElementById('b-dots'); if (d) d.setAttribute('aria-expanded', String(A.barOpen));
      return;
    }
    case 'mplay': {
      quiet(); A.playing = !A.playing;
      const d = document.getElementById('disc'); if (d) d.classList.toggle('spin', A.playing);
      const b = document.getElementById('mplay'); if (b) { b.innerHTML = ic(A.playing ? D.pause : D.play, 20, '#FFFFFF', 1.8); b.setAttribute('aria-label', A.playing ? 'Pausar' : 'Tocar'); }
      return;
    }
    case 'seek': { quiet(); const r = el.getBoundingClientRect(); const f = Math.min(1, Math.max(0, ((ev ? ev.clientX : r.left) - r.left) / (r.width || 1))); A.prog = Math.round(f * TRACKS[A.track].d); paintProg(); return; }
    case 'ntab': {
      quiet(); A.ntab = el.dataset.k;
      ['news', 'free'].forEach((k) => {
        const t = document.getElementById('tab-' + k), p = document.getElementById('pane-' + k), on = k === A.ntab;
        if (t) { t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); }
        if (p) p.classList.toggle('on', on);
      });
      return;
    }
    case 'gsearch': {
      quiet(); A.searchOpen = !A.searchOpen;
      const s = document.getElementById('tsearch'); if (s) s.classList.toggle('open', A.searchOpen);
      const i = document.getElementById('gsearch');
      if (i) { if (A.searchOpen) i.focus(); else { i.value = ''; A.gq = ''; A.search = ''; refilter(); } }
      return;
    }
    case 'older': loadOlder(); return;
    case 'retry-thread': { const k = curKey(); A.terr[k] = 0; ensureThread(k); paintMsgs(true); return; }
    case 'reload-world': A.world = 'loading'; render(); loadWorld(); return;
    default: break;
  }
  if (act !== 'menu') A.menu = false;
  if (act !== 'emoji-toggle' && act !== 'emoji') A.emojiOpen = false;
  switch (act) {
    case 'srv': { const s = SERVERS.find((x) => x.id === el.dataset.id); if (s) { A.server = s.id; A.channel = s.text[0] ? s.text[0].id : null; A.search = ''; A.draft = ''; } break; }
    case 'chan': A.channel = el.dataset.id; A.draft = ''; break;
    case 'vjoin': voiceJoin(el.dataset.id); return;
    case 'vleave': voiceLeave(); return;
    case 'mute': A.muted = !A.muted; voiceApply(); break;
    case 'deaf': A.deafened = !A.deafened; voiceApply(); break;
    case 'menu': A.menu = !A.menu; break;
    case 'settings': toast('Configurações chegam em breve'); break;
    case 'logout': logout(); return;
    case 'nav': { const k = el.dataset.k; if (k === 'invite') { openInvite(); return; } if (k === 'members') A.showMembers = !A.showMembers; else { A.panel = A.panel === k ? null : k; if (A.panel === 'mentions') loadMentions(); if (A.panel === 'search') { A.sres = null; runSearch(); } } break; }
    case 'close-panel': A.panel = null; break;
    case 'otoggle': A.onlineOpen = !A.onlineOpen; break;
    case 'ftoggle': A.offlineOpen = !A.offlineOpen; break;
    case 'emoji-toggle': A.emojiOpen = !A.emojiOpen; break;
    case 'emoji': A.draft += el.dataset.ch; A.emojiOpen = false; render(); { const m = document.getElementById('msg'); if (m) m.focus(); } return;
    case 'send': doSend(false); return;
    case 'hsend': doSend(true); return;
    case 'hub': A.view = 'hub'; A.panel = null; break;
    case 'srv-open': { selectServer(el.dataset.id); render({ scroll: true }); return; }
    case 'friends-open': if (SERVERS.length) { A.view = 'server'; A.showMembers = true; A.panel = null; } break;
    case 'chat-open': { const s = serverOfChan(A.hubKey); if (!s && dmPeer(A.hubKey)) { A.channel = A.hubKey; A.view = 'dm'; A.panel = null; render({ scroll: true }); return; } if (s) { A.server = s.id; A.channel = A.hubKey; A.search = ''; A.view = 'server'; A.panel = null; render({ scroll: true }); } return; }
    case 'hubchat': A.hubKey = el.dataset.key; render({ scroll: true }); return;
    case 'mprev': A.track = (A.track + TRACKS.length - 1) % TRACKS.length; A.prog = 0; break;
    case 'mnext': A.track = (A.track + 1) % TRACKS.length; A.prog = 0; break;
    case 'mtrack': A.track = Number(el.dataset.i) || 0; A.prog = 0; A.playing = true; break;
    case 'panel': A.panel = A.panel === el.dataset.k ? null : el.dataset.k; break;
    case 'goto-msg': { const ch = el.dataset.ch, srv = serverOfChan(ch); A.panel = null; if (srv) { A.server = srv.id; A.channel = ch; A.view = 'server'; } else if (A.dmUser[ch]) { A.channel = ch; A.view = 'dm'; } render({ scroll: true }); return true; }
    case 'toast-soon': toast('Isso chega em breve'); return;
    case 'toast-pin': toast('Fixar festas chega em breve'); return;
    case 'attach': pickImage(el.dataset.hub === '1'); return;
    case 'toast-gift': toast('Presentes chegam em breve'); return;
    case 'toast-gif': toast('GIFs chegam em breve'); return;
    default: return;
  }
  render({ scroll: act === 'srv' || act === 'chan' });
}

/* ------------------------------------------------------------- eventos */
function setPath(path, v) {
  const parts = path.split('.');
  let o = S;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = v;
}
function onBound(path, el) {
  if (path === 'v.code') {
    const c = normCode(el.value).slice(0, 6);
    el.value = c; S.v.code = c; S.v.err = ''; S.v.notice = '';
    paintOtp();
    if (c.length === 6) doVerify();
  } else if (path === 'n.code') {
    const c = normCode(el.value).slice(0, 6); el.value = c; S.n.code = c;
  } else if (path === 'r.pass') {
    const h = document.getElementById('r-hint'); if (h) h.className = 'hint';
  } else if (path === 'n.pass' || path === 'n.conf') paintRules();
  else if (path === 'r.email') delete S.r.srv.email;
  else if (path === 'r.user') delete S.r.srv.user;
}

$root.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.appBind) {
    if (t.dataset.appBind === 'sq') { A.sq = t.value; clearTimeout(sqTimer); sqTimer = setTimeout(() => { runSearch(); if (A.panel === 'search') render(); }, 350); return; }
    if (t.dataset.appBind === 'search') { A.search = t.value; const l = document.getElementById('mlist'); if (l) l.innerHTML = membersListHTML(); }
    else if (t.dataset.appBind === 'gq') { A.gq = t.value; A.search = t.value; refilter(); }
    else if (t.dataset.appBind.startsWith('m:')) { if (A.modal) A.modal[t.dataset.appBind.slice(2)] = t.value; }
    else if (t.dataset.appBind === 'hdraft') { A.hdraft = t.value; const b = document.getElementById('hsend'); if (b) b.hidden = !A.hdraft.trim(); if (t.value) sendTyping(); }
    else { A.draft = t.value; const b = document.getElementById('send-btn'); if (b) b.hidden = !A.draft.trim(); if (t.value) sendTyping(); }
    return;
  }
  const b = t.dataset.bind;
  if (!b || t.type === 'checkbox' || t.tagName === 'SELECT') return;
  setPath(b, t.value); onBound(b, t);
});
$root.addEventListener('change', (e) => {
  if (e.target.id === 'mf-avatar') { const f = e.target.files && e.target.files[0]; if (f && A) setAvatar(f); return; }
  const t = e.target, b = t.dataset.bind;
  if (!b) return;
  if (t.type === 'checkbox') setPath(b, t.checked);
  else if (t.tagName === 'SELECT') { setPath(b, t.value); if (S.r.touched) render(); }
});
$root.addEventListener('keydown', (e) => {
  if (e.target.id === 'msg' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(false); }
  if (e.target.id === 'hmsg' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(true); }
  if (e.target.matches && e.target.matches('.modal input[data-mf]') && e.key === 'Enter') { e.preventDefault(); modalSubmit(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.view === 'app' && A.modal) { closeModal(); return; }
  if (e.key === 'Escape' && S.view === 'app' && (A.menu || A.panel || A.emojiOpen)) { A.menu = false; A.panel = null; A.emojiOpen = false; render(); }
});
$root.addEventListener('submit', (e) => {
  e.preventDefault();
  const fn = { login: doLogin, register: doRegister, verify: doVerify, forgot: doForgot, newpass: doReset }[e.target.dataset.form];
  if (fn) fn();
});
$root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (S.view === 'app') {
    if (el) { appAction(el.dataset.act, el, e); return; }
    if (A.menu || A.emojiOpen) { A.menu = false; A.emojiOpen = false; render(); }
    return;
  }
  if (!el) return;
  switch (el.dataset.act) {
    case 'toggle-pw': {
      const input = document.getElementById(el.dataset.target); if (!input) break;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      el.textContent = show ? 'Ocultar' : 'Mostrar'; el.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      const bind = el.dataset.bindShow;
      if (bind === 'lPw') S.lShow = show; else if (bind === 'r.pass') S.r.show = show; else if (bind === 'n.pass') { S.n.show = show; const c = document.getElementById('n-conf'); if (c) c.type = show ? 'text' : 'password'; }
      break;
    }
    case 'to-login': go('login'); break;
    case 'to-register': go('register'); break;
    case 'to-forgot': S.f.err = ''; go('forgot'); break;
    case 'to-app': go('app'); break;
    case 'resend': doResend(); break;
    case 'resend-reset': doResendReset(); break;
    case 'manual-code': S.n = Object.assign(freshN(), { email: S.f.email, manual: true }); S.view = 'newPass'; history.replaceState(null, '', location.pathname + '#new-password'); render({ top: true }); setTimeout(() => { const f = document.querySelector('[data-autofocus]'); if (f) f.focus(); }, 0); break;
    case 'qr-new': qrStart(); break;
    case 'soon': e.preventDefault(); toast(el.dataset.msg || 'Em breve'); break;
    case 'qr-approve': decideApprove('approve'); break;
    case 'qr-deny': decideApprove('deny'); break;
    default: break;
  }
});
addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.view === 'login' && S.qr && S.qr.state === 'ready') qrTick(); });

/* --------------------------------------------------------------- boot */
(async function boot() {
  S.session = store.get('sq.session'); S.profile = store.get('sq.profile');
  if (S.session) {
    const t = await freshToken();
    if (t && !S.profile) await loadProfile();
  }
  route();
})();
})();
