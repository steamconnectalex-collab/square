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
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
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
  if (window.SQ_SET) { window.SQ_SET.close(); window.SQ_SET.forget(); }
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
  if (view === 'app') { initApp(); }
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
  help: { title: 'Central de ajuda', items: [{ t: 'Como criar um servidor', s: 'Clique no “+” da barra lateral e escolha “Criar o meu”.' }, { t: 'Como convidar amigos', s: 'Dentro do servidor, clique em “Convidar” e envie o link.' }, { t: 'Atalhos do teclado', s: 'Enter envia a mensagem que você escreveu.' }] }
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
/* ponte para as Configurações (settings.js) */
window.SQ_API = {
  rpc, sb, toast, displayName, logout: () => logout(),
  me: () => (A && A.me) || null,
  email: () => (S.session && S.session.user && S.session.user.email) || '',
  plan: () => (A && A.plan) || 'free',
  servers: () => SERVERS,
  unread: () => (A && A.unread ? Object.keys(A.unread).filter((k) => A.unread[k]).length : 0),
  reload: () => { if (A && S.view === 'app') loadWorld(); },
  authFetch: async (path, o = {}) => {
    const t = await freshToken();
    return fetch(C.SUPABASE_URL + path, { method: o.method || 'GET', headers: { apikey: C.SUPABASE_KEY, authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
  },
  editProfile: () => { if (!A) return; const me = A.me || {}; A.menu = false; A.modal = { type: 'editprofile', display: me.name || displayName(), status: me.status || '', bio: me.bio || '', accent: me.accent || ACCENTS[0], err: '', busy: false }; render(); focusModal(); }
};
const ERRS = {
  plan_widget: 'Remover ou trocar o card Servidores destaque exige um plano pago (ainda vamos definir qual).',
  too_many_pins: 'Plano grátis: até 4 servidores fixados. Desafixe um para fixar outro.',
  music_limit: 'Limite atingido (500 favoritas, 30 playlists, 200 músicas por playlist).', music_unavailable: 'A busca de músicas está indisponível agora. Tente de novo.',
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
  t = t.replace(/\[trk:(\d{1,12})\]/g, '<button type="button" class="mtk" data-act="mus-shared-trk" data-tid="$1">▶ Ouvir prévia</button>').replace(/\[pl:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/g, '<button type="button" class="mtk" data-act="mus-open-pl" data-id="$1">Abrir playlist</button>');
  const img = m.img ? `<a class="att" href="${esc(attUrl(m.img))}" target="_blank" rel="noopener"><img src="${esc(attUrl(m.img))}" alt="Imagem enviada" loading="lazy"></a>` : '';
  return t + img;
}
const msgTime = (iso) => {
  const d = new Date(iso), t = new Date(), p2 = (n) => String(n).padStart(2, '0');
  const hm = window.SQ_SET ? window.SQ_SET.hm(d) : p2(d.getHours()) + ':' + p2(d.getMinutes());
  return d.toDateString() === t.toDateString() ? hm : p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + hm;
};

function person(p, uid, role) {
  const me = uid === myId();
  const name = (p && (p.display_name || p.username)) || 'Membro';
  const pres = (p && p.presence) || 'online';
  const on = me || (!!(p && p.last_seen && Date.now() - Date.parse(p.last_seen) < ONLINE_MS) && pres !== 'invisible');
  const status = (p && p.status_text) || '';
  const av = (p && p.avatar_path) || '';
  return {
    id: uid, name, user: (p && p.username) || '', bio: (p && p.bio) || '', status, accent: (p && p.accent) || '#9D8CCF',
    since: (p && p.created_at) || '', role: role || '', me, on, presence: me ? pres : (on ? pres : 'off'), st: on ? (pres === 'idle' ? 'Ausente' : pres === 'dnd' ? 'Não perturbe' : (status || 'Online')) : 'Offline',
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
    view: 'friends', ftab: 'all', af: { user: '', note: '', busy: false }, pop: null, drawer: false, csec: { text: false, voice: false }, devs: null, hubSrv: true, pins: [], feat: null, plan: 'free', pubAll: null, hubKey: '', hubKeys: [], hdraft: '', gq: '', searchOpen: false, barOpen: false, playing: false, prog: 0, queue: [], qi: -1, tcache: {}, favs: [], loadedId: '', ntab: 'news', entered: false,
    threads: {}, loaded: {}, loading: {}, more: {}, terr: {}, modal: null, poll: null, beat: null, tt: null, typing: {}, pollN: 0, friends: [], incoming: [], outgoing: [], known: {}, dmByUser: {}, dmUser: {}, blocked: new Set(), unread: {}, vrost: {}
  };
  startLive(); loadWorld(); openJoin();
  if (window.SQ_SET) window.SQ_SET.boot(uid);
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
function stopAppTimers() { try { AUD.pause(); } catch (e) { /* ok */ } voiceLeave(true); if (A) { clearInterval(A.poll); clearInterval(A.beat); clearInterval(A.tt); A.poll = A.beat = A.tt = null; } rtStop(false); }

const srvIni = (n) => { const w = String(n || '').trim().split(/\s+/).filter(Boolean); return (w.length ? w.map((x) => Array.from(x)[0]).slice(0, 3).join('') : '?'); };
const curServer = () => SERVERS.find((s) => s.id === A.server) || SERVERS[0] || null;
const serverOfChan = (cid) => SERVERS.find((s) => s.text.some((c) => c.id === cid)) || null;
const curKey = () => ((A.view === 'dm' || A.view === 'server') ? (A.channel || '') : '');
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
    const [srv, chs, mem, fr, dmc, dmm, blk, pins] = await Promise.all([
      sb('/rest/v1/servers?select=id,name,owner_id,created_at,is_public&order=created_at.asc'),
      sb('/rest/v1/channels?select=id,server_id,name,kind,position&server_id=not.is.null&order=position.asc'),
      sb('/rest/v1/server_members?select=server_id,user_id,role'),
      sb('/rest/v1/friendships?select=user_a,user_b,requester,status,note'),
      sb('/rest/v1/channels?select=id&kind=eq.dm'),
      sb('/rest/v1/dm_members?select=channel_id,user_id'),
      sb('/rest/v1/blocks?select=blocked'),
      sb('/rest/v1/server_pins?select=server_id&order=created_at.asc').catch(() => [])
    ]);
    const other = (f) => (f.user_a === myId() ? f.user_b : f.user_a);
    const ids = Array.from(new Set(mem.map((m) => m.user_id).concat(fr.map(other), blk.map((b) => b.blocked), [myId()])));
    const profs = await sb('/rest/v1/profiles?select=id,username,display_name,bio,status_text,avatar_path,accent,last_seen,presence,created_at&id=in.(' + ids.join(',') + ')');
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
        if (last.author_id !== myId() && last.id > mark && !(w.view === 'dm' && w.channel === c.id)) unread[c.id] = 1;
      } catch (e) { /* sem aviso de não lida */ }
    }));
    w.unread = unread;
    loadVoice();
    w.friends = fr.filter((f) => f.status === 'accepted').map((f) => known[other(f)]).filter(Boolean).map((p) => Object.assign({}, p, { dm: dmByUser[p.id] || '' })).sort(byName);
    w.incoming = fr.filter((f) => f.status === 'pending' && f.requester !== myId() && known[other(f)]).map((f) => Object.assign({}, known[other(f)], { note: f.note || '' }));
    w.outgoing = fr.filter((f) => f.status === 'pending' && f.requester === myId()).map((f) => known[other(f)]).filter(Boolean);
    SERVERS = srv.map((s) => {
      const people = mem.filter((m) => m.server_id === s.id).map((m) => person(P[m.user_id], m.user_id, m.role));
      const byId = {}; people.forEach((p) => { byId[p.id] = p; });
      const by = (a, b) => a.name.localeCompare(b.name);
      const chan = (k) => chs.filter((c) => c.server_id === s.id && c.kind === k).map((c) => ({ id: c.id, name: c.name }));
      return {
        id: s.id, name: s.name, owner: s.owner_id, pub: !!s.is_public, mine: s.owner_id === myId(), users: people.length, ini: srvIni(s.name), tile: tileFor(s.id),
        text: chan('text'), voice: chan('voice'), byId, online: people.filter((p) => p.on).sort(by), offline: people.filter((p) => !p.on).sort(by)
      };
    });
    w.pins = (pins || []).map((x) => x.server_id).filter((id) => srv.some((x) => x.id === id));
    w.world = 'ready'; w.werr = '';
    S.profile = Object.assign({}, S.profile, { display_name: w.me.name, username: w.me.user || (S.profile && S.profile.username) });
    store.set('sq.profile', S.profile);
    fixSelection();
    presenceExpire();
  } catch (e) {
    if (A !== w) return;
    if (w.world === 'ready') return;
    w.world = 'error'; w.werr = errText(e);
  }
  (paint || render)();
}
function fixSelection() {
  if (A.view === 'dm' && !A.friends.some((f) => f.dm && f.dm === A.channel)) { A.view = 'friends'; A.channel = null; }
  if (A.view === 'server') {
    const s = SERVERS.find((x) => x.id === A.server);
    if (!s) { A.view = 'friends'; A.server = null; A.channel = null; }
    else if (!s.text.some((c) => c.id === A.channel)) A.channel = s.text[0] ? s.text[0].id : null;
  }
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
    presenceExpire();
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
  const el = document.getElementById('msgs'); if (!el) return;
  const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  el.innerHTML = serverMsgsHTML();
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
  const wantAudio = window.SQ_SET ? window.SQ_SET.audioConstraints() : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: wantAudio }); }
  catch (e0) { try { delete wantAudio.deviceId; stream = await navigator.mediaDevices.getUserMedia({ audio: wantAudio }); } catch (e) { stream = null; } }
  if (!stream) return toast('Não consegui usar o microfone. Libere o microfone para este site no navegador e tente de novo.');
  try { await rpc('voice_join', { p_channel: ch }); }
  catch (e) { stream.getTracks().forEach((t) => t.stop()); return toast(errText(e)); }
  let raw = stream, gain = null, ctx = null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; ctx = new AC(); if (ctx.resume) ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(raw); gain = ctx.createGain(); gain.gain.value = SPV('in_vol', 100) / 100;
    const dest = ctx.createMediaStreamDestination(); src.connect(gain); gain.connect(dest); stream = dest.stream;
  } catch (e) { try { if (ctx) ctx.close(); } catch (e2) { /* ok */ } ctx = null; gain = null; stream = raw; }
  VC = { ch, stream, raw, ctx, gain, peers: {}, ping: setInterval(() => { rpc('voice_ping', { p_channel: ch }).catch(() => {}); }, 15000) };
  voiceApply();
  if (window.SQ_SET) { window.SQ_SET.fx('join'); window.SQ_SET.entrySound(); }
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
    if (window.SQ_SET) { peer.audio.volume = window.SQ_SET.outputVolume(); const od = window.SQ_SET.outputDevice(); if (od !== 'default' && peer.audio.setSinkId) peer.audio.setSinkId(od).catch(() => {}); }
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
  if (window.SQ_SET && !quiet) window.SQ_SET.fx('leave');
  const v = VC; vsend('bye', {});
  VC = null;
  clearInterval(v.ping);
  Object.keys(v.peers).forEach((u) => { const p = v.peers[u]; try { p.pc.close(); } catch (e) { /* já fechado */ } if (p.audio) { p.audio.srcObject = null; p.audio.remove(); } });
  v.stream.getTracks().forEach((t) => t.stop());
  if (v.raw && v.raw !== v.stream) v.raw.getTracks().forEach((t) => t.stop());
  if (v.ctx) { try { v.ctx.close(); } catch (e) { /* ok */ } }
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
    if (r.author_id !== myId() && A.dmUser[ch] && !A.blocked.has(r.author_id) && (curKey() !== ch || document.hidden) && !(A.me && A.me.presence === 'dnd')) { const f = dmPeer(ch); toast('Nova mensagem de ' + (f ? f.name : 'um amigo')); if (window.SQ_SET) window.SQ_SET.notify('message', 'Nova mensagem de ' + (f ? f.name : 'um amigo'), String(r.content || '').slice(0, 120)); A.unread[ch] = 1; if (!th) reloadSoon(); else render(); }
    if (r.author_id !== myId() && serverOfChan(ch) && mentionsMe(r.content) && !A.blocked.has(r.author_id) && !(A.me && A.me.presence === 'dnd')) { const f = findPerson(r.author_id); toast((f ? f.name : 'Alguém') + ' mencionou você'); if (window.SQ_SET) window.SQ_SET.notify('message', (f ? f.name : 'Alguém') + ' mencionou você', String(r.content || '').slice(0, 120)); }
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
const fmt = (s) => { s = Math.max(0, Math.floor(s) || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

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
  const f = document.getElementById('flist'); if (f) f.innerHTML = flistHTML();
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
/* ---- cartão de servidores: carrossel, fixados e explorar ---- */
function srvCardHTML(s) {
  const pinned = A.pins.includes(s.id);
  return `<div class="scard" role="listitem"><button type="button" class="sopen" data-act="srv-open" data-id="${s.id}" aria-label="Abrir ${esc(s.name)}"><span class="stl" style="background:${s.tile}">${esc(s.ini)}</span><b>${esc(s.name)}</b><small>${s.users} ${s.users === 1 ? 'membro' : 'membros'}${s.mine ? ' · seu' : ''}</small></button><button type="button" class="hov spin2" data-act="${pinned ? 'unpin' : 'pin'}" data-id="${s.id}" aria-pressed="${pinned}" aria-label="${pinned ? 'Desafixar' : 'Fixar'} ${esc(s.name)}" title="${pinned ? 'Desafixar' : 'Fixar'}">${ic(D.pin, 15, pinned ? '#D92D45' : '#55555F', pinned ? 2 : 1.7)}</button></div>`;
}
function carouselHTML() {
  if (!SERVERS.length) return '';
  return `<div class="scar-w"><div class="scar" id="scar" role="list" aria-label="Seus servidores">${SERVERS.slice(0, 10).map(srvCardHTML).join('')}</div>${SERVERS.length > 10 ? `<small class="scmore">Mostrando 10 de ${SERVERS.length}. Os demais estão na barra de cima.</small>` : ''}</div>`;
}
const pinCount = () => A.pins.filter((id) => SERVERS.some((x) => x.id === id)).length;
function keepCarousel(fn) {
  const c = document.getElementById('scar'), sl = c ? c.scrollLeft : 0;
  fn();
  const n = document.getElementById('scar'); if (n) n.scrollLeft = sl;
}
async function pinAct(id, on) {
  if (on && pinCount() >= 4) return toast(ERRS.too_many_pins);
  const before = A.pins.slice();
  A.pins = on ? before.concat(id) : before.filter((x) => x !== id);
  keepCarousel(() => render());
  try { await rpc('pin_server', { p_server: id, p_pin: on }); }
  catch (e) { A.pins = before; keepCarousel(() => render()); toast(errText(e)); }
}
function loadExplore() {
  const m = A.modal; if (!m || m.type !== 'srv') return;
  m.list = null;
  rpc('list_public_servers').then((rows) => { if (A.modal === m) { m.list = rows || []; render(); } })
    .catch((e) => { if (A.modal === m) { m.list = []; m.err = errText(e); render(); } });
}
function afterJoin(id, msg) {
  A.modal = null; selectServer(id);
  render({ scroll: true }); toast(msg);
}

function hubChatHTML() {
  if (A.world === 'loading') return '<div class="hchat"><div class="hmsgs"><div class="hempty">Carregando…</div></div></div>';
  if (A.world === 'error') return `<div class="hchat"><div class="hmsgs"><div class="hempty">${esc(A.werr)}</div><div class="hcta"><button type="button" class="mbtn" data-act="reload-world">Tentar de novo</button></div></div></div>`;
  const showSrv = A.hubSrv || !A.hubKey;
  const srvTab = `<button type="button" class="ctab srvtab${showSrv ? ' on' : ''}" data-act="hubsrv" aria-pressed="${showSrv}" aria-label="Servidores" title="Servidores">${ic(D.grid, 17, '#33333A', 1.8)}</button>`;
  const tabs = A.hubKeys.map((k) => {
    const s = serverOfChan(k), on = !showSrv && k === A.hubKey;
    if (s) return `<button type="button" class="ctab${on ? ' on' : ''}" data-act="hubchat" data-key="${k}" aria-pressed="${on}" aria-label="${esc(s.name)}" title="${esc(s.name)}" style="background:${s.tile}">${esc(s.ini)}</button>`;
    const f = dmPeer(k); if (!f) return '';
    return `<button type="button" class="ctab dmtab${on ? ' on' : ''}" data-act="hubchat" data-key="${k}" aria-pressed="${on}" aria-label="Conversa com ${esc(f.name)}" title="${esc(f.name)}" style="background:${f.g}">${esc(f.ini)}${udot(k)}</button>`;
  }).join('');
  if (showSrv) return `<div class="hchat"><div class="hch">${srvTab}${tabs}<span class="tsp"></span></div>
  <div class="hsrv">${carouselHTML()}${SERVERS.length ? '' : '<div class="hempty">Você ainda não está em nenhum servidor.</div>'}
    <div class="hcta"><button type="button" class="mbtn" data-act="modal-open" data-k="srv" data-mode="create">Criar servidor</button><button type="button" class="mbtn ghost" data-act="modal-open" data-k="srv" data-mode="explore">Explorar</button><button type="button" class="mbtn ghost" data-act="toast-friend">Adicionar amigo</button></div></div></div>`;
  return `<div class="hchat">
  <div class="hch">${srvTab}${tabs}<span class="tsp"></span>${serverOfChan(A.hubKey) ? `<button type="button" class="hov wext" data-act="chat-open" aria-label="Abrir a conversa completa">${ic(D.ext, 17)}</button>` : `<b class="dmname">${esc((dmPeer(A.hubKey) || {}).name || '')}</b><button type="button" class="hov wext" data-act="chat-open" aria-label="Abrir a conversa em tela cheia">${ic(D.ext, 17)}</button>`}</div>
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
  const pins = A.pins.map((id) => SERVERS.find((x) => x.id === id)).filter(Boolean).slice(0, 4);
  const slot = () => `<button type="button" class="pslot" data-act="pin-add" aria-label="Fixar um servidor">${ic(D.plus, 20, '#62626D', 1.6)}</button>`;
  const has = (x) => `<div class="pslot has"><button type="button" class="pgo" data-act="srv-open" data-id="${x.id}" aria-label="Abrir ${esc(x.name)}"><span class="stl sm" style="background:${x.tile}">${esc(x.ini)}</span><small>${esc(x.name)}</small></button><button type="button" class="hov pun" data-act="unpin" data-id="${x.id}" aria-label="Desafixar ${esc(x.name)}">${ic(D.close, 13, '#55555F', 1.8)}</button></div>`;
  return `<div class="pp"><h2>Servidores fixados</h2><div class="pgrid">${pins.map(has).join('')}${Array(4 - pins.length).fill(0).map(slot).join('')}</div><small class="pnote">Plano grátis: até 4 servidores fixados.</small></div>`;
}

/* ---- card "Servidores destaque" (no lugar de "Mais jogados") ---- */
const STREAMS = { youtube: { n: 'YouTube', re: /you\s?tube|\byt\b/i }, prime: { n: 'Prime Video', re: /prime|amazon/i }, netflix: { n: 'Netflix', re: /netflix/i }, disney: { n: 'Disney+', re: /disney/i } };
const planPaid = () => !!A && A.plan && A.plan !== 'free';
const wMode = () => { const m = planPaid() ? store.get('sq.wd.' + myId()) : 'featured'; return m === 'featured' || STREAMS[m] ? m : 'featured'; };
function loadFeatured() {
  const w = A;
  rpc('my_plan').then((p) => { if (A === w) { w.plan = String(p || 'free'); render(); } }).catch(() => {});
  rpc('featured_servers').then((rows) => { if (A === w) { w.feat = rows || []; render(); } }).catch(() => { if (A === w) { w.feat = []; render(); } });
}
function loadPubAll() {
  const w = A; if (w.pubAll) return;
  rpc('list_public_servers').then((rows) => { if (A === w) { w.pubAll = rows || []; render(); } }).catch(() => { if (A === w) { w.pubAll = []; render(); } });
}
function featRow(x) {
  const mine = x.joined || SERVERS.some((v) => v.id === x.id);
  const sub = (x.level ? 'Nível ' + x.level + ' · ' : '') + x.members + ' ' + (x.members === 1 ? 'membro' : 'membros');
  return `<div class="frow"><span class="stl sm" style="background:${tileFor(x.id)}">${esc(String(x.name).charAt(0).toUpperCase())}</span><span class="tx"><b>${esc(x.name)}</b><small>${esc(sub)}</small></span>${mine ? `<button type="button" class="mbtn sm ghost" data-act="srv-open" data-id="${esc(x.id)}">Abrir</button>` : `<button type="button" class="mbtn sm" data-act="feat-join" data-id="${esc(x.id)}">Entrar</button>`}</div>`;
}
function mostHTML() {
  const mode = wMode(), st = STREAMS[mode];
  const title = st ? 'Servidores de ' + st.n : 'Servidores destaque';
  let body;
  if (st) {
    if (A.pubAll == null) { loadPubAll(); body = '<p class="mnote">Carregando…</p>'; }
    else { const l = A.pubAll.filter((x) => st.re.test(x.name)).slice(0, 4); body = l.length ? `<div class="flist2">${l.map(featRow).join('')}</div>` : `<p class="mnote">Ainda não há servidores públicos de ${esc(st.n)}.</p>`; }
  } else if (A.feat == null) body = '<p class="mnote">Carregando…</p>';
  else body = A.feat.length ? `<div class="flist2">${A.feat.map(featRow).join('')}</div><small class="pnote">4 servidores em destaque, trocados automaticamente a cada 48 horas.</small>` : '<p class="mnote">Nenhum servidor em destaque agora. Servidores públicos de nível 3 ou mais aparecem aqui.</p>';
  return `<div class="wh"><h2>${esc(title)}</h2><button type="button" class="hov wext" data-act="wd-opts" aria-label="Personalizar este card">${ic(D.dots, 17)}</button></div>${body}`;
}

/* ---- música: busca no iTunes (prévia de 30 s), fila, favoritas e playlists ---- */
const safeUrl = (u) => (/^https:\/\/[a-z0-9.-]+\.(mzstatic|apple)\.com\//i.test(u || '') ? u : '');
const cleanTrack = (x) => ({ id: String((x && x.id) || '').slice(0, 20), t: String((x && x.t) || '').slice(0, 120), a: String((x && x.a) || '').slice(0, 120), art: safeUrl(x && x.art), url: safeUrl(x && x.url) });
const fromItunes = (r) => cleanTrack({ id: r.trackId, t: r.trackName, a: r.artistName, art: String(r.artworkUrl100 || '').replace('100x100bb', '200x200bb'), url: r.previewUrl });
async function itunes(path) {
  let res; try { res = await fetch('https://itunes.apple.com/' + path); } catch (e) { throw { message: 'network' }; }
  if (!res.ok) throw { message: 'music_unavailable' };
  const j = await res.json().catch(() => ({}));
  return (j.results || []).filter((r) => r.previewUrl && r.trackId).map(fromItunes).filter((t) => t.id && t.url);
}
const AUD = new Audio();
AUD.preload = 'none';
let musT = null;
const curTrack = () => (A && A.queue[A.qi]) || null;
const isFav = (id) => !!A && A.favs.some((f) => f.id === id);
const cacheT = (t) => { A.tcache[t.id] = t; return t; };
const artStyle = (t) => (t && t.art ? `background-image:url('${esc(t.art)}')` : '');
const saveQueue = () => store.set('sq.q.' + myId(), { q: A.queue, i: A.qi });
function restoreQueue() {
  const sv = store.get('sq.q.' + myId());
  A.queue = sv && Array.isArray(sv.q) ? sv.q.map(cleanTrack).filter((t) => t.id && t.url).slice(0, 100) : [];
  A.qi = A.queue.length ? Math.min(Math.max(Number(sv.i) || 0, 0), A.queue.length - 1) : -1;
  A.queue.forEach(cacheT);
}
async function loadFavs() {
  const w = A;
  try {
    const rows = await sb('/rest/v1/music_favorites?select=track_id,track&order=created_at.desc&limit=500');
    if (A !== w) return;
    A.favs = (rows || []).map((r) => cleanTrack(Object.assign({}, r.track, { id: r.track_id }))).filter((t) => t.id);
    A.favs.forEach(cacheT); paintMusic(); if (A.modal && A.modal.type === 'music') musRefresh();
  } catch (e) { /* sem favoritas por enquanto */ }
}
function paintMusic() {
  if (!A || S.view !== 'app') return;
  const w = document.querySelector('.w-mus'); if (w) w.innerHTML = musicHTML();
}
function paintProg() {
  if (S.view !== 'app' || !A) return;
  const d = AUD.duration || 30, p = Math.min(100, (A.prog / d) * 100);
  const f = document.getElementById('mfill'), k = document.getElementById('mknob'), c = document.getElementById('mcur'), e = document.getElementById('mend');
  if (f) f.style.width = p + '%'; if (k) k.style.left = p + '%'; if (c) c.textContent = fmt(A.prog); if (e) e.textContent = fmt(d);
}
function playIdx(i) {
  const t = A.queue[i]; if (!t) return;
  A.qi = i; A.prog = 0; A.playing = true; A.loadedId = t.id; saveQueue();
  AUD.src = t.url;
  AUD.play().catch(() => { A.playing = false; paintMusic(); toast('Não foi possível tocar essa música.'); });
  paintMusic();
}
function nextTrack(dir) {
  if (!A || !A.queue.length) return;
  playIdx((A.qi + dir + A.queue.length) % A.queue.length);
}
AUD.addEventListener('timeupdate', () => { if (A) { A.prog = AUD.currentTime; paintProg(); } });
AUD.addEventListener('ended', () => { if (A) nextTrack(1); });
AUD.addEventListener('pause', () => { if (A && A.playing && !AUD.ended) { A.playing = false; paintMusic(); } });
AUD.addEventListener('play', () => { if (A && !A.playing) { A.playing = true; paintMusic(); } });
function addQueue(t) {
  if (A.queue.some((x) => x.id === t.id)) return toast('Essa música já está na fila');
  if (A.queue.length >= 100) return toast('A fila está cheia (máximo 100).');
  A.queue.push(cacheT(t)); if (A.qi < 0) A.qi = 0; saveQueue(); paintMusic(); toast('Adicionada à fila');
}
function playNow(t) {
  cacheT(t);
  let i = A.queue.findIndex((x) => x.id === t.id);
  if (i < 0) { i = A.qi < 0 ? A.queue.length : A.qi + 1; A.queue.splice(i, 0, t); }
  playIdx(i);
  if (S.view === 'app' && A.view !== 'hub') toast('Tocando: ' + t.t + ' (controles no painel inicial)');
}
function queueMove(i, d) {
  const j = i + d; if (j < 0 || j >= A.queue.length) return;
  [A.queue[i], A.queue[j]] = [A.queue[j], A.queue[i]];
  if (A.qi === i) A.qi = j; else if (A.qi === j) A.qi = i;
  saveQueue(); paintMusic();
}
function queueDel(i) {
  A.queue.splice(i, 1);
  if (i < A.qi) A.qi--;
  else if (i === A.qi) { AUD.pause(); A.playing = false; A.loadedId = ''; A.prog = 0; if (A.qi >= A.queue.length) A.qi = A.queue.length - 1; }
  saveQueue(); paintMusic();
}
async function toggleFav(t) {
  const had = isFav(t.id), c = cleanTrack(t);
  A.favs = had ? A.favs.filter((f) => f.id !== t.id) : [c].concat(A.favs);
  paintMusic(); musRefresh();
  try {
    if (had) await sb('/rest/v1/music_favorites?track_id=eq.' + encodeURIComponent(t.id), { method: 'DELETE' });
    else await sb('/rest/v1/music_favorites', { method: 'POST', body: { track_id: c.id, track: c }, prefer: 'resolution=ignore-duplicates' });
  } catch (e) {
    A.favs = had ? [c].concat(A.favs) : A.favs.filter((f) => f.id !== t.id);
    paintMusic(); musRefresh(); toast(errText(e));
  }
}
async function shareTo(text) {
  const key = curKey();
  if (!key) { toast('Abra uma conversa primeiro para compartilhar.'); return false; }
  try { await sendTo(key, text); if (curKey() === key) paintMsgs(true); toast('Enviado na conversa aberta'); return true; }
  catch (e) { toast(errText(e)); return false; }
}
async function sharedTrack(id) {
  if (A.tcache[id]) return playNow(A.tcache[id]);
  try { const r = await itunes('lookup?country=BR&id=' + encodeURIComponent(id)); if (r[0]) playNow(cacheT(r[0])); else toast('Essa música não está mais disponível.'); }
  catch (e) { toast(errText(e)); }
}
/* playlists */
async function loadPls() {
  const m = A.modal; if (!m || m.type !== 'music') return;
  try {
    const rows = await sb('/rest/v1/playlists?owner_id=eq.' + myId() + '&select=id,name,shared,playlist_tracks(count)&order=created_at.desc');
    if (A.modal === m) { m.pls = (rows || []).map((r) => ({ id: r.id, name: r.name, shared: !!r.shared, n: r.playlist_tracks && r.playlist_tracks[0] ? r.playlist_tracks[0].count : 0 })); musRefresh(); }
  } catch (e) { if (A.modal === m) { m.pls = m.pls || []; m.err = errText(e); musRefresh(); } }
}
async function openPl(id) {
  const m = A.modal; if (!m || m.type !== 'music') return;
  m.tab = 'pl'; m.pick = null; m.err = ''; m.open = { id, name: '…', mine: false, shared: false, loading: true }; m.ptr = null; render();
  try {
    const q = encodeURIComponent(id);
    const [p, rows] = await Promise.all([sb('/rest/v1/playlists?id=eq.' + q + '&select=id,name,shared,owner_id'), sb('/rest/v1/playlist_tracks?playlist_id=eq.' + q + '&select=id,track&order=position.asc,id.asc')]);
    if (A.modal !== m) return;
    if (!p || !p[0]) { m.open = null; m.err = 'Essa playlist não existe ou deixou de ser compartilhada.'; loadPls(); render(); return; }
    m.open = { id, name: p[0].name, shared: !!p[0].shared, mine: p[0].owner_id === myId() };
    m.ptr = (rows || []).map((r) => ({ row: r.id, t: cacheT(cleanTrack(r.track)) })).filter((x) => x.t.id);
    musRefresh();
  } catch (e) { if (A.modal === m) { m.open = null; m.err = errText(e); render(); } }
}
async function createPl() {
  const m = A.modal; if (!m || m.busy) return;
  const name = m.newname.trim();
  if (!name) { m.err = 'Dê um nome à playlist.'; musRefresh(); return; }
  m.busy = true; m.err = '';
  try { await sb('/rest/v1/playlists', { method: 'POST', body: { name } }); m.newname = ''; m.busy = false; toast('Playlist criada'); render(); await loadPls(); }
  catch (e) { m.busy = false; m.err = errText(e); musRefresh(); }
}
async function delPl(id) {
  const m = A.modal; if (!m || m.busy) return;
  if (m.delq !== id) { m.delq = id; musRefresh(); return; }
  m.busy = true; m.delq = '';
  try { await sb('/rest/v1/playlists?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); m.busy = false; toast('Playlist excluída'); await loadPls(); }
  catch (e) { m.busy = false; m.err = errText(e); musRefresh(); }
}
async function addToPl(plId, t) {
  const m = A.modal; if (!m || m.busy || !t) return;
  m.busy = true; m.err = '';
  try {
    const last = await sb('/rest/v1/playlist_tracks?playlist_id=eq.' + encodeURIComponent(plId) + '&select=position&order=position.desc&limit=1');
    await sb('/rest/v1/playlist_tracks', { method: 'POST', body: { playlist_id: plId, track: cleanTrack(t), position: (last && last[0] ? last[0].position : 0) + 1 } });
    const p = (m.pls || []).find((x) => x.id === plId); if (p) p.n++;
    m.pick = null; toast('Adicionada à playlist' + (p ? ' ' + p.name : ''));
  } catch (e) { m.err = errText(e); }
  m.busy = false; if (A.modal === m) render();
}
function plMove(row, d) {
  const m = A.modal; if (!m || !m.ptr) return;
  const i = m.ptr.findIndex((x) => String(x.row) === String(row)), j = i + d;
  if (i < 0 || j < 0 || j >= m.ptr.length) return;
  [m.ptr[i], m.ptr[j]] = [m.ptr[j], m.ptr[i]]; musRefresh();
  rpc('playlist_move', { p_track: Number(row), p_dir: d }).catch((e) => { toast(errText(e)); if (A.modal === m && m.open) openPl(m.open.id); });
}
async function plRemove(row) {
  const m = A.modal; if (!m || !m.ptr) return;
  m.ptr = m.ptr.filter((x) => String(x.row) !== String(row)); musRefresh();
  try { await sb('/rest/v1/playlist_tracks?id=eq.' + encodeURIComponent(row), { method: 'DELETE' }); } catch (e) { toast(errText(e)); if (A.modal === m && m.open) openPl(m.open.id); }
}
async function plShare() {
  const m = A.modal; if (!m || !m.open || !m.open.mine) return;
  if (!curKey()) return toast('Abra uma conversa primeiro para compartilhar.');
  try { if (!m.open.shared) { await sb('/rest/v1/playlists?id=eq.' + encodeURIComponent(m.open.id), { method: 'PATCH', body: { shared: true } }); m.open.shared = true; } }
  catch (e) { return toast(errText(e)); }
  shareTo('🎶 Playlist "' + m.open.name + '" [pl:' + m.open.id + ']');
}
async function plCopy() {
  const m = A.modal; if (!m || !m.open || m.busy) return;
  m.busy = true;
  try { await rpc('playlist_copy', { p_id: m.open.id }); toast('Playlist salva na sua conta'); m.busy = false; m.tab = 'pl'; m.open = null; m.ptr = null; render(); loadPls(); }
  catch (e) { m.busy = false; m.err = errText(e); musRefresh(); }
}
function openMusic(tab, plId) {
  A.menu = false;
  const m = A.modal = { type: 'music', tab: tab || 'search', q: '', res: null, searching: false, serr: '', pls: null, open: null, ptr: null, pick: null, delq: '', newname: '', err: '', busy: false };
  render(); focusModal();
  if (m.tab === 'pl') { if (plId) openPl(plId); else loadPls(); }
}
function musSearch() {
  const m = A.modal; if (!m || m.type !== 'music' || m.tab !== 'search') return;
  clearTimeout(musT);
  const q = m.q.trim();
  if (q.length < 2) { m.res = null; m.searching = false; m.serr = ''; return musRefresh(); }
  m.searching = true; m.serr = ''; musRefresh();
  itunes('search?media=music&entity=song&country=BR&limit=25&term=' + encodeURIComponent(q)).then((rs) => {
    if (A.modal === m && m.q.trim() === q) { m.res = rs.map(cacheT); m.searching = false; musRefresh(); }
  }).catch((e) => { if (A.modal === m) { m.searching = false; m.res = null; m.serr = errText(e); musRefresh(); } });
}
const mIcon = (act, icon, label, attrs, on) => `<button type="button" class="hov sq sm" data-act="${act}" ${attrs || ''} aria-label="${label}" title="${label}">${ic(icon, 16, on ? '#D92D45' : '#33333A', on ? 2 : 1.7)}</button>`;
function mRow(t, btns) {
  return `<div class="mrow2"><span class="tc" style="${artStyle(t)}"></span><span class="tx"><b>${esc(t.t)}</b><small>${esc(t.a)}</small></span><span class="macts">${btns}</span></div>`;
}
const tActs = (t, extra) => {
  const a = `data-tid="${esc(t.id)}"`;
  return mIcon('mus-play', D.play, 'Tocar agora', a) + mIcon('mus-q', D.list, 'Adicionar à fila', a) + mIcon('mus-fav', D.heart, isFav(t.id) ? 'Remover das favoritas' : 'Favoritar', a, isFav(t.id)) + mIcon('mus-pick', D.plus, 'Adicionar a uma playlist', a) + (extra || '') + mIcon('mus-share', D.share, 'Compartilhar na conversa aberta', a);
};
function musResHTML(m) {
  if (m.searching) return '<div class="mempty">Buscando…</div>';
  if (m.serr) return `<div class="merr" role="alert">${esc(m.serr)}</div>`;
  if (m.res === null) return '<div class="mempty">Digite o nome de uma música ou artista. Cada música toca uma prévia de 30 segundos.</div>';
  if (!m.res.length) return '<div class="mempty">Nada encontrado. Tente outro nome.</div>';
  return `<div class="mus-list">${m.res.map((t) => mRow(t, tActs(t))).join('')}</div>`;
}
function musPanelHTML(m) {
  const err = m.err ? `<div class="merr" role="alert">${esc(m.err)}</div>` : '';
  if (m.pick) {
    const t = A.tcache[m.pick];
    return `${err}<p class="mnote">Adicionar <b>${esc(t ? t.t : 'a música')}</b> a qual playlist?</p>${m.pls == null ? '<div class="mempty">Carregando…</div>' : m.pls.length ? `<div class="mus-list">${m.pls.map((p) => `<button type="button" class="hov plopen" data-act="mus-addpl" data-id="${esc(p.id)}"><b>${esc(p.name)}</b><small>${p.n} ${p.n === 1 ? 'música' : 'músicas'}</small></button>`).join('')}</div>` : '<div class="mempty">Você ainda não tem playlists. Crie uma na aba Playlists.</div>'}<button type="button" class="mbtn ghost sm" data-act="mus-pick-cancel">Cancelar</button>`;
  }
  if (m.tab === 'search') return `${err}<div class="mf"><label for="mf-q">Buscar música</label><input id="mf-q" data-mf type="search" data-app-bind="m:q" maxlength="80" value="${esc(m.q)}" placeholder="Música ou artista" autocomplete="off" spellcheck="false"></div><div id="mus-res">${musResHTML(m)}</div>`;
  if (m.tab === 'fav') return `${err}${A.favs.length ? `<div class="mus-list">${A.favs.map((t) => mRow(t, tActs(t))).join('')}</div>` : '<div class="mempty">Você ainda não favoritou nenhuma música. Toque no coração em qualquer música.</div>'}`;
  if (m.open) {
    const o = m.open;
    if (o.loading) return '<div class="mempty">Carregando playlist…</div>';
    const rows = (m.ptr || []).map((x) => mRow(x.t, mIcon('mus-play', D.play, 'Tocar agora', `data-tid="${esc(x.t.id)}"`) + mIcon('mus-q', D.list, 'Adicionar à fila', `data-tid="${esc(x.t.id)}"`) + mIcon('mus-fav', D.heart, isFav(x.t.id) ? 'Remover das favoritas' : 'Favoritar', `data-tid="${esc(x.t.id)}"`, isFav(x.t.id)) + (o.mine ? mIcon('mus-pl-mv', D.up, 'Mover para cima', `data-row="${x.row}" data-d="-1"`) + mIcon('mus-pl-mv', D.down, 'Mover para baixo', `data-row="${x.row}" data-d="1"`) + mIcon('mus-pl-rm', D.close, 'Tirar da playlist', `data-row="${x.row}"`) : ''))).join('');
    return `${err}<div class="plhead"><button type="button" class="mbtn ghost sm" data-act="mus-pl-back">‹ Voltar</button><h3>${esc(o.name)}</h3></div>
    <div class="plbtns"><button type="button" class="mbtn sm" data-act="mus-pl-playall"${m.ptr && m.ptr.length ? '' : ' disabled'}>▶ Tocar tudo</button><button type="button" class="mbtn ghost sm" data-act="mus-pl-queue"${m.ptr && m.ptr.length ? '' : ' disabled'}>Adicionar à fila</button>${o.mine ? '<button type="button" class="mbtn ghost sm" data-act="mus-pl-share">Compartilhar</button>' : '<button type="button" class="mbtn sm" data-act="mus-pl-copy">Salvar cópia</button>'}</div>
    ${rows ? `<div class="mus-list">${rows}</div>` : '<div class="mempty">Essa playlist está vazia. Busque músicas e use o botão + para adicionar.</div>'}`;
  }
  return `${err}<div class="mf"><label for="mf-new">Nova playlist</label><div class="mnew"><input id="mf-new" data-mf type="text" data-app-bind="m:newname" maxlength="40" value="${esc(m.newname)}" placeholder="Nome da playlist" autocomplete="off"><button type="button" class="mbtn sm" data-act="mus-pl-new"${m.busy ? ' disabled' : ''}>Criar</button></div></div>
  ${m.pls == null ? '<div class="mempty">Carregando…</div>' : m.pls.length ? `<div class="mus-list">${m.pls.map((p) => `<div class="plrow"><button type="button" class="hov plopen" data-act="mus-pl-open" data-id="${esc(p.id)}"><b>${esc(p.name)}</b><small>${p.n} ${p.n === 1 ? 'música' : 'músicas'}${p.shared ? ' · compartilhada' : ''}</small></button><button type="button" class="hov sq${m.delq === p.id ? ' warn' : ''}" data-act="mus-pl-del" data-id="${esc(p.id)}" aria-label="Excluir playlist ${esc(p.name)}">${m.delq === p.id ? '<small>Excluir?</small>' : ic(D.close, 16, '#55555F', 1.8)}</button></div>`).join('')}</div>` : '<div class="mempty">Você ainda não tem playlists.</div>'}`;
}
function musicModalHTML(m) {
  const tab = (k, l) => `<button type="button" role="tab" class="mtab${m.tab === k ? ' on' : ''}" data-act="mus-tab" data-tab="${k}" aria-selected="${m.tab === k}">${l}</button>`;
  return `<div class="mtabs" role="tablist">${tab('search', 'Buscar')}${tab('pl', 'Playlists')}${tab('fav', 'Favoritas')}</div><div id="mus-panel">${musPanelHTML(m)}</div>`;
}
function musRefresh() {
  const m = A && A.modal; if (!m || m.type !== 'music') return;
  if (m.tab === 'search' && !m.pick) { const r = document.getElementById('mus-res'); if (r) { r.innerHTML = musResHTML(m); return; } }
  const p = document.getElementById('mus-panel'); if (p) p.innerHTML = musPanelHTML(m);
}
function musAct(act, el) {
  const m = A.modal && A.modal.type === 'music' ? A.modal : null, id = el.dataset.tid, t = id ? A.tcache[id] : null;
  switch (act) {
    case 'mus-open': openMusic(el.dataset.tab || 'search'); break;
    case 'mus-tab': if (m) { m.tab = el.dataset.tab; m.err = ''; m.pick = null; m.open = null; m.ptr = null; render(); focusModal(); if (m.tab === 'pl') loadPls(); } break;
    case 'mus-play': if (t) playNow(t); break;
    case 'mus-q': if (t) addQueue(t); break;
    case 'mus-fav': if (t) toggleFav(t); break;
    case 'mus-pick': if (m && t) { m.pick = t.id; m.err = ''; musRefresh(); if (!m.pls) loadPls(); } break;
    case 'mus-pick-cancel': if (m) { m.pick = null; musRefresh(); } break;
    case 'mus-addpl': if (m && m.pick) addToPl(el.dataset.id, A.tcache[m.pick]); break;
    case 'mus-share': if (t) shareTo('🎵 ' + t.t + ' — ' + t.a + ' [trk:' + t.id + ']'); break;
    case 'mus-pl-new': createPl(); break;
    case 'mus-pl-open': openPl(el.dataset.id); break;
    case 'mus-pl-back': if (m) { m.open = null; m.ptr = null; m.err = ''; render(); focusModal(); loadPls(); } break;
    case 'mus-pl-del': delPl(el.dataset.id); break;
    case 'mus-pl-playall': if (m && m.ptr && m.ptr.length) { A.queue = m.ptr.map((x) => x.t).slice(0, 100); playIdx(0); toast('Tocando a playlist'); } break;
    case 'mus-pl-queue': if (m && m.ptr) { let n = 0; m.ptr.forEach((x) => { if (A.queue.length < 100 && !A.queue.some((q) => q.id === x.t.id)) { A.queue.push(x.t); n++; } }); if (A.qi < 0 && A.queue.length) A.qi = 0; saveQueue(); paintMusic(); toast(n + (n === 1 ? ' música adicionada' : ' músicas adicionadas') + ' à fila'); } break;
    case 'mus-pl-share': plShare(); break;
    case 'mus-pl-copy': plCopy(); break;
    case 'mus-pl-mv': plMove(el.dataset.row, Number(el.dataset.d)); break;
    case 'mus-pl-rm': plRemove(el.dataset.row); break;
    case 'mus-qmove': queueMove(Number(el.dataset.i), Number(el.dataset.d)); break;
    case 'mus-qdel': queueDel(Number(el.dataset.i)); break;
    case 'mus-shared-trk': sharedTrack(String(el.dataset.tid || '')); break;
    case 'mus-open-pl': openMusic('pl', el.dataset.id); break;
    default: break;
  }
  return true;
}

function musicHTML() {
  const t = curTrack(), d = AUD.duration || 30, pct = t ? Math.min(100, (A.prog / d) * 100) : 0;
  const fav = t && isFav(t.id), spin = A.playing && t;
  return `<div class="mtop">
  <div class="disc${spin ? ' spin' : ''}" id="disc" aria-hidden="true"><span class="core"${t && t.art ? ` style="${artStyle(t)};background-size:cover;background-position:center"` : ''}>${t && t.art ? '' : ic(D.music, 30, '#44444C', 1.5)}</span></div>
  <div class="minfo">
    <div class="mhd"><div class="mtt"><h3 id="mt">${t ? esc(t.t) : 'Nenhuma música'}</h3><small id="ma">${t ? esc(t.a) : 'Toque na lupa para buscar'}</small></div>
      <button type="button" class="hov mc sm" data-act="mus-open" data-tab="search" aria-label="Buscar música">${ic(D.search, 18, '#33333A', 1.8)}</button>
      <button type="button" class="hov mc sm" data-act="mus-open" data-tab="pl" aria-label="Minhas playlists">${ic(D.list, 18, '#33333A', 1.8)}</button></div>
    <div class="mctl"><button type="button" class="hov mc" data-act="mprev" aria-label="Faixa anterior">${ic(D.prev, 20, '#33333A', 1.7)}</button><button type="button" class="mc play" id="mplay" data-act="mplay" aria-label="${A.playing ? 'Pausar' : 'Tocar'}">${ic(A.playing ? D.pause : D.play, 20, '#FFFFFF', 1.8)}</button><button type="button" class="hov mc" data-act="mnext" aria-label="Próxima faixa">${ic(D.next, 20, '#33333A', 1.7)}</button>${t ? `<button type="button" class="hov mc" data-act="mus-fav" data-tid="${esc(t.id)}" aria-label="${fav ? 'Remover das favoritas' : 'Favoritar'}" aria-pressed="${!!fav}">${ic(D.heart, 19, fav ? '#D92D45' : '#33333A', fav ? 2 : 1.7)}</button><button type="button" class="hov mc" data-act="mus-share" data-tid="${esc(t.id)}" aria-label="Compartilhar na conversa aberta">${ic(D.share, 19, '#33333A', 1.7)}</button>` : ''}</div>
    <div class="mtime"><span id="mcur">${fmt(A.prog)}</span><span id="mend">${fmt(d)}</span></div>
    <div class="pbar" data-act="seek" role="progressbar" aria-label="Progresso da música" aria-valuemin="0" aria-valuemax="${Math.round(d)}" aria-valuenow="${Math.round(A.prog)}"><i id="mfill" style="width:${pct}%"></i><b id="mknob" style="left:${pct}%"></b></div>
  </div></div>
  <div class="tracks" aria-label="Lista de reprodução">${A.queue.length ? A.queue.map((x, i) => `<div class="trk ${i === A.qi ? 'on' : 'hov'}"><button type="button" class="tplay" data-act="mtrack" data-i="${i}" aria-label="Tocar ${esc(x.t)}"><span class="tc" style="${artStyle(x)}"></span><span class="tx"><b>${esc(x.t)}</b><small>${esc(x.a)}</small></span></button><span class="tmv"><button type="button" class="hov" data-act="mus-qmove" data-i="${i}" data-d="-1" aria-label="Mover ${esc(x.t)} para cima">${ic(D.up, 15, '#55555F', 1.8)}</button><button type="button" class="hov" data-act="mus-qmove" data-i="${i}" data-d="1" aria-label="Mover ${esc(x.t)} para baixo">${ic(D.down, 15, '#55555F', 1.8)}</button><button type="button" class="hov" data-act="mus-qdel" data-i="${i}" aria-label="Tirar ${esc(x.t)} da fila">${ic(D.close, 14, '#55555F', 1.8)}</button></span></div>`).join('') : '<div class="mempty">Sua lista de reprodução está vazia.<br>Use a lupa para buscar músicas (prévia de 30 s).</div>'}</div>`;
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
  ${w('w-most', 2, mostHTML())}
  ${w('w-mus', 3, musicHTML())}
  ${w('w-news', 4, newsHTML())}
  ${userbarHTML()}
</main>`;
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
  const intro = A.more[key] ? '' : (srv ? welcomeHTML(srv, srv.text.find((c) => c.id === key)) : dmIntroHTML(dmPeer(key)));
  const acts = (m) => {
    const mine = m.from === me;
    if (!mine && !(srv && srv.owner === me)) return '';
    return `<span class="mact">${mine ? `<button type="button" class="hov" data-act="msg-edit" data-id="${m.id}" aria-label="Editar mensagem">${ic(D.edit, 14, '#55555F', 1.8)}</button>` : ''}<button type="button" class="hov" data-act="msg-del" data-id="${m.id}" aria-label="Apagar mensagem">${ic(D.close, 14, '#55555F', 1.8)}</button></span>`;
  };
  return '<div class="fill"></div>'
    + (A.more[key] ? '<button type="button" class="lnk older" data-act="older">Ver mensagens mais antigas</button>' : '')
    + intro
    + (th.length || intro ? '' : '<div class="empty">Nenhuma mensagem ainda. Seja o primeiro a escrever.</div>')
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
          <button type="button" class="hov ib" data-act="toast-soon" data-msg="As figurinhas chegam em breve" aria-label="Escolher figurinha">${ic(D.sticker, 19, '#55555F', 1.6)}</button>
          <button type="button" class="hov ib" data-act="emoji-toggle" aria-label="Escolher emoji" aria-expanded="${A.emojiOpen}">${ic(D.smile, 19, '#55555F', 1.6)}</button>
          <button type="button" class="hov ib" data-act="toast-soon" data-msg="Os apps chegam em breve" aria-label="Apps">${ic(D.apps, 19, '#55555F', 1.6)}</button>
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
  if (m.type === 'qs') return qsHTML();
  if (m.type === 'srvnew') return srvNewHTML(m);
  let title = '', body = '', foot = '', label = 'Salvar';
  const tabs = (items) => `<div class="mtabs" role="tablist">${items.map((t) => `<button type="button" role="tab" class="mtab${t.on ? ' on' : ''}" data-act="${t.act}" data-mode="${t.mode}" aria-selected="${t.on}">${t.l}</button>`).join('')}</div>`;
  if (m.type === 'srv') {
    const md = m.mode === 'join' ? 'join' : m.mode === 'explore' ? 'explore' : 'create';
    title = md === 'join' ? 'Entrar com convite' : md === 'explore' ? 'Explorar servidores' : 'Criar um servidor';
    label = md === 'join' ? 'Entrar' : 'Criar servidor';
    const head = '';
    if (md === 'join') title = 'Entrar em um servidor';
    if (md === 'join') body = head + mField('mf-code', 'Código ou link do convite', 'code', m.code, { ph: 'Cole aqui o código', max: 200 });
    else if (md === 'explore') {
      body = head + (m.list == null ? '<p class="mnote">Carregando…</p>' : m.list.length ? `<div class="mus-list">${m.list.map((x) => `<div class="exrow"><span class="stl sm" style="background:${tileFor(x.id)}">${esc(String(x.name).charAt(0).toUpperCase())}</span><span class="tx"><b>${esc(x.name)}</b><small>${x.members} ${x.members === 1 ? 'membro' : 'membros'}</small></span>${x.joined ? '<small class="exin">Você já está</small>' : `<button type="button" class="mbtn sm" data-act="explore-join" data-id="${esc(x.id)}"${m.busy ? ' disabled' : ''}>Entrar</button>`}</div>`).join('')}</div>` : '<p class="mnote">Ainda não há servidores públicos. Crie o primeiro: marque "Servidor público" ao criar.</p>');
    } else {
      body = head + mField('mf-name', 'Nome do servidor', 'name', m.name, { ph: 'Ex.: Meus amigos', max: 40, hint: 'Você será o dono. Já vem com os canais Geral e Sala principal.' })
        + `<div class="mf"><button type="button" class="mtog${m.pub ? ' on' : ''}" data-act="m-pub" aria-pressed="${!!m.pub}"><i></i><span>Servidor público (aparece em Explorar)</span></button><small>Qualquer pessoa logada poderá entrar. Por enquanto só dá para escolher isso ao criar.</small></div>`;
    }
  } else if (m.type === 'pinpick') {
    title = 'Fixar servidor';
    const free = SERVERS.filter((x) => !A.pins.includes(x.id));
    body = free.length ? `<div class="mus-list">${free.map((x) => `<button type="button" class="hov plopen pk" data-act="pin" data-id="${x.id}" data-close="1"><span class="stl sm" style="background:${x.tile}">${esc(x.ini)}</span><b>${esc(x.name)}</b></button>`).join('')}</div>` : '<p class="mnote">Você ainda não está em nenhum servidor para fixar.</p>';
    foot = '<button type="button" class="mbtn ghost" data-act="modal-close">Fechar</button>';
  } else if (m.type === 'widget') {
    title = 'Personalizar card';
    const cur = wMode();
    const opt = (k, l) => `<button type="button" class="hov plopen pk${cur === k ? ' on' : ''}" data-act="wd-set" data-k="${k}" aria-pressed="${cur === k}"><b>${esc(l)}</b>${cur === k ? '<small>Em uso</small>' : ''}</button>`;
    body = '<div class="mus-list">' + opt('featured', 'Servidores destaque') + Object.keys(STREAMS).map((k) => opt(k, 'Servidores de ' + STREAMS[k].n)).join('') + '</div><p class="mnote">Plano pago: em vez de remover o card, você escolhe qual anúncio de servidores aparece nele.</p>';
    foot = '<button type="button" class="mbtn ghost" data-act="modal-close">Fechar</button>';
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
  } else if (m.type === 'music') {
    title = 'Música'; body = musicModalHTML(m); foot = '<button type="button" class="mbtn ghost" data-act="modal-close">Fechar</button>';
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
  const showSubmit = !(m.type === 'invite' || m.type === 'profile' || m.type === 'bans' || m.type === 'music' || m.type === 'pinpick' || m.type === 'widget' || (m.type === 'srv' && m.mode === 'explore'));
  return `<div class="mback" data-act="modal-bg"><div class="modal${m.type === 'music' ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="mhead"><h2>${esc(title)}</h2><button type="button" class="hov sq" data-act="modal-close" aria-label="Fechar">${ic(D.close, 16, '#55555F', 1.8)}</button></header>
    <div class="mbody">${body}${m.err && m.type !== 'music' ? `<div class="merr" role="alert">${esc(m.err)}</div>` : ''}</div>
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
  if (m.type === 'music') { if (m.tab === 'search') musSearch(); else if (m.tab === 'pl' && !m.open) createPl(); return; }
  m.err = '';
  const run = async (fn) => {
    m.busy = true; render();
    try { await fn(); }
    catch (e) { if (A.modal === m) { m.busy = false; m.err = errText(e); render(); } }
  };
  if (m.type === 'srv' && m.mode === 'explore') return;
  if (m.type === 'srvnew') {
    if (m.step !== 'name') return;
    const name = m.name.trim();
    if (name.length < 2) return modalErr('O nome precisa ter de 2 a 40 caracteres.');
    return run(async () => {
      const id = await rpc('create_server', { p_name: name }); let msg = 'Servidor criado';
      if (m.pub) { try { await rpc('set_server_public', { p_server: id, p_public: true }); } catch (e) { msg = 'Servidor criado, mas não foi possível torná-lo público.'; } }
      await loadWorld(() => {}); afterJoin(id, msg);
    });
  }
  if (m.type === 'srv' && m.mode !== 'join') {
    const name = m.name.trim();
    if (name.length < 2) return modalErr('O nome precisa ter de 2 a 40 caracteres.');
    return run(async () => {
      const id = await rpc('create_server', { p_name: name }); let msg = 'Servidor criado';
      if (m.pub) { try { await rpc('set_server_public', { p_server: id, p_public: true }); } catch (e) { msg = 'Servidor criado, mas não foi possível torná-lo público.'; } }
      await loadWorld(() => {}); afterJoin(id, msg);
    });
  }
  if (m.type === 'srv') {
    const code = inviteCode(m.code);
    if (code.length < 4) return modalErr('Cole o código ou o link do convite.');
    return run(async () => { const id = await rpc('join_server', { p_code: code }); await loadWorld(() => {}); afterJoin(id, 'Você entrou no servidor'); });
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
      A.channel = ch; A.view = 'dm'; A.pop = null;
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
  if (act.indexOf('mus-') === 0) return musAct(act, el);
  switch (act) {
    case 'modal-bg': if (ev && ev.target === el) closeModal(); return true;
    case 'modal-close': closeModal(); return true;
    case 'modal-submit': modalSubmit(); return true;
    case 'modal-mode': if (A.modal) { if (A.modal.type === 'chan') A.modal.kind = el.dataset.mode; else A.modal.mode = el.dataset.mode; A.modal.err = ''; render(); focusModal(); if (A.modal.type === 'srv' && A.modal.mode === 'explore') loadExplore(); } return true;
    case 'modal-open': {
      A.menu = false;
      const k = el.dataset.k;
      if (k === 'chan') {
        const s = curServer(); if (!s) return true;
        if (!s.mine) { toast('Só o dono do servidor cria canais.'); return true; }
        A.modal = { type: 'chan', kind: el.dataset.kind === 'voice' ? 'voice' : 'text', name: '', err: '', busy: false };
      } else if (el.dataset.mode !== 'join' && el.dataset.mode !== 'explore') A.modal = { type: 'srvnew', step: 'start', tpl: '', kind: '', name: '', pub: false, err: '', busy: false };
      else A.modal = { type: 'srv', mode: el.dataset.mode === 'join' ? 'join' : 'explore', name: '', code: '', pub: false, list: null, err: '', busy: false };
      render(); focusModal(); if (A.modal.type === 'srv' && A.modal.mode === 'explore') loadExplore(); return true;
    }
    case 'modal-copy': {
      const link = inviteLink(A.modal ? A.modal.code : '');
      const fallback = () => { const i = document.getElementById('mf-link'); if (i) { i.focus(); i.select(); } toast('Selecione o link e copie'); };
      try { navigator.clipboard.writeText(link).then(() => toast('Link copiado'), fallback); } catch (e) { fallback(); }
      return true;
    }
    case 'sn-tpl': if (A.modal) { A.modal.tpl = el.dataset.k; A.modal.step = 'about'; render(); } return true;
    case 'sn-kind': if (A.modal) { A.modal.kind = el.dataset.k || ''; A.modal.step = 'name'; if (!A.modal.name) A.modal.name = 'Servidor de ' + displayName(); render(); focusModal(); } return true;
    case 'sn-back': if (A.modal) { const m = A.modal; m.err = ''; m.step = m.step === 'name' ? 'about' : 'start'; render(); } return true;
    case 'qs-go': {
      const k = el.dataset.k, id = el.dataset.id; A.modal = null;
      if (k === 'dm') { friendAct('dm', id, '', true); return true; }
      if (k === 'srv') selectServer(id);
      else { A.server = el.dataset.sid; A.channel = id; A.view = 'server'; A.panel = null; }
      render({ scroll: true }); return true;
    }
    case 'm-pub': if (A.modal) { A.modal.pub = !A.modal.pub; render(); focusModal(); } return true;
    case 'explore-join': { const m = A.modal; if (!m || m.busy) return true; m.busy = true; m.err = ''; render(); const id = el.dataset.id; rpc('join_public_server', { p_server: id }).then(async () => { await loadWorld(() => {}); afterJoin(id, 'Você entrou no servidor'); }).catch((e) => { m.busy = false; m.err = errText(e); if (A.modal === m) render(); }); return true; }
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
/* ===================================================================
   NOVA CASCA (2026-11-21): barra de servidores + coluna + página central,
   como nas fotos da pessoa. Substitui o painel inicial e as telas antigas.
   =================================================================== */
Object.assign(D, {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  inbox: '<path d="M4 13l2.2-6.4A2 2 0 0 1 8.1 5.2h7.8a2 2 0 0 1 1.9 1.4L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 13h4.5a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2H20"/>',
  chevR: '<path d="m9 5 7 7-7 7"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  quest: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
  shield: '<path d="M12 3l7 3v5.5c0 4.3-2.9 7.6-7 9.5-4.1-1.9-7-5.2-7-9.5V6z"/>',
  badge: '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4 7 21l5-2.5 5 2.5-1.6-7.6"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3 4.5-3 4.5-3-4.5z"/>',
  sticker: '<path d="M20 12.5V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h5.5z"/><path d="M20 12.5h-4a3.5 3.5 0 0 0-3.5 3.5V20"/>',
  apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><path d="M16.75 13.5V20M13.5 16.75H20"/>',
  threads: '<path d="M5 9h10M5 15h6M9 4 7 20M15 4l-1.2 8"/><path d="M16 17h5M18.5 14.5v5"/>',
  camera: '<path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'
});
const PRES = { online: 'Disponível', idle: 'Ausente', dnd: 'Não perturbe', invisible: 'Invisível' };
const sdCls = (p) => { const s = p && p.presence; return s === 'idle' ? 'idle' : s === 'dnd' ? 'dnd' : (!p || s === 'invisible' || s === 'off' || !p.on) ? 'off' : 'on'; };
const xAv = (p, cls = '') => `<span class="xav ${cls}" style="background:${p.g}">${esc(p.ini)}<i class="sd ${sdCls(p)}"></i></span>`;
const SPV = (k, d) => { const v = window.SQ_SET ? window.SQ_SET.P(k) : undefined; return v === undefined || v === null ? d : v; };
const IMG_MASCOT = '<svg class="mascot" viewBox="0 0 120 100" aria-hidden="true"><defs><linearGradient id="mg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9CDF2"/><stop offset="1" stop-color="#9D8CCF"/></linearGradient></defs><ellipse cx="60" cy="92" rx="34" ry="6" fill="rgba(29,29,34,.08)"/><rect x="26" y="22" width="68" height="64" rx="20" fill="url(#mg1)"/><path d="M30 44a30 30 0 0 1 60 0" fill="none" stroke="#44444C" stroke-width="5" stroke-linecap="round"/><rect x="20" y="40" width="10" height="20" rx="5" fill="#44444C"/><rect x="90" y="40" width="10" height="20" rx="5" fill="#44444C"/><circle cx="47" cy="56" r="5" fill="#1D1D22"/><circle cx="73" cy="56" r="5" fill="#1D1D22"/><path d="M50 70q10 8 20 0" fill="none" stroke="#1D1D22" stroke-width="3.5" stroke-linecap="round"/><path d="M60 22V10" stroke="#44444C" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="8" r="5" fill="#E897AB"/></svg>';
const ILLUS = '<svg viewBox="0 0 180 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="il1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B9CCF4"/><stop offset=".55" stop-color="#DCD3F3"/><stop offset="1" stop-color="#F6D3DE"/></linearGradient><linearGradient id="il2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D79BB0"/><stop offset="1" stop-color="#A9809F"/></linearGradient></defs><rect width="180" height="360" fill="url(#il1)"/><g fill="#fff" opacity=".85"><ellipse cx="40" cy="60" rx="30" ry="9"/><ellipse cx="64" cy="54" rx="20" ry="8"/><ellipse cx="140" cy="100" rx="34" ry="9"/><ellipse cx="118" cy="94" rx="18" ry="7"/></g><path d="M0 230 L48 170 L84 210 L120 150 L180 220 V360 H0z" fill="url(#il2)" opacity=".75"/><path d="M0 270 C40 240 70 300 110 270 S160 250 180 262 V360 H0z" fill="#CBA3BE"/><path d="M0 310 C50 290 90 330 140 306 S170 300 180 304 V360 H0z" fill="#9FC8B0"/><rect x="38" y="196" width="3.5" height="74" rx="1.7" fill="#5A5A66"/><path d="M41 198l34 10-34 14z" fill="#9D8CCF"/><path d="M118 292l22-34 22 34z" fill="#F3D9B0"/><path d="M140 258v34" stroke="#C9A06A" stroke-width="2"/><circle cx="96" cy="300" r="9" fill="#E897AB" opacity=".9"/><circle cx="76" cy="308" r="6" fill="#B79BDB" opacity=".9"/></svg>';
const TPLS = [['games', 'Jogos', '🎮'], ['friends', 'Amigos', '💗'], ['study', 'Grupo de estudos', '📚'], ['school', 'Clube escolar', '🏫'], ['art', 'Artes e criação', '🎨'], ['local', 'Comunidade local', '🏘️']];

/* ---- presença (Disponível / Ausente / Não perturbe / Invisível) ---- */
async function setPresence(s, ms) {
  if (!A || !A.me || !PRES[s]) return;
  const before = A.me.presence || 'online';
  A.me.presence = s; A.pop = null;
  store.set('sq.pres.' + myId(), ms ? { until: Date.now() + ms } : null);
  render();
  try { await rpc('set_my_presence', { p_status: s }); toast('Status: ' + PRES[s]); }
  catch (e) { if (A && A.me) { A.me.presence = before; render(); } toast(errText(e)); }
}
function presenceExpire() {
  if (!A || !A.me || (A.me.presence || 'online') === 'online') return;
  const u = store.get('sq.pres.' + myId());
  if (u && u.until && Date.now() > u.until) setPresence('online', 0);
}
async function loadDevs() {
  const w = A; if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { A.devs = { in: [], out: [] }; return; }
  try {
    const l = await navigator.mediaDevices.enumerateDevices();
    if (A !== w) return;
    const mk = (k) => l.filter((d) => d.kind === k && d.deviceId !== 'default' && d.deviceId !== 'communications').map((d, i) => ({ id: d.deviceId, label: d.label || (k === 'audioinput' ? 'Microfone ' : 'Alto-falante ') + (i + 1) }));
    w.devs = { in: mk('audioinput'), out: mk('audiooutput') };
  } catch (e) { w.devs = { in: [], out: [] }; }
  if (A === w && A.pop && (A.pop.k === 'mic' || A.pop.k === 'head')) render();
}
const devLabel = (kind, id) => { const l = (A.devs && A.devs[kind]) || []; const d = l.find((x) => x.id === id); return !id || id === 'default' ? 'Padrão' : d ? d.label : 'Padrão'; };
const PROFS = { isolation: 'Isolamento de voz', studio: 'Estúdio', custom: 'Personalizado' };
const sliderHTML = (k, v) => `<input type="range" class="xr" min="0" max="100" step="1" value="${v}" data-pv="${k}" style="--v:${v}%" aria-label="${k === 'in_vol' ? 'Volume de entrada' : 'Volume de saída'}">`;

/* ---- peças da casca ---- */
function railHTML() {
  const home = ['friends', 'dm', 'official', 'shop', 'quests'].includes(A.view);
  return `<nav class="x-rail" aria-label="Servidores">
  <button type="button" class="rt home${home ? ' on' : ''}" data-act="go-home" aria-label="Mensagens diretas" title="Mensagens diretas">${logoMark(22)}${anyUnread() ? '<i class="udot"></i>' : ''}</button>
  <i class="rsep" aria-hidden="true"></i>
  ${SERVERS.map((s) => { const on = A.view === 'server' && A.server === s.id; return `<button type="button" class="rt${on ? ' on' : ''}" data-act="srv-open" data-id="${s.id}" aria-label="${esc(s.name)}" aria-pressed="${on}" title="${esc(s.name)}" style="background:${s.tile}">${esc(s.ini)}</button>`; }).join('')}
  <button type="button" class="rt act" data-act="srv-new" aria-label="Criar ou entrar em um servidor" title="Adicionar um servidor">${ic(D.plus, 22, '#1B6B47', 2)}</button>
  <button type="button" class="rt act" data-act="srv-explore" aria-label="Explorar servidores públicos" title="Explorar servidores públicos">${ic(D.compass, 22, '#1B6B47', 1.8)}</button>
  <button type="button" class="rt act" data-act="toast-soon" data-msg="Os apps para celular e computador chegam em breve" aria-label="Baixar apps" title="Baixar apps">${ic(D.download, 22, '#1B6B47', 1.8)}</button>
</nav>`;
}
function dmColHTML() {
  const v = A.view;
  const nav = (act, icon, label, on, extra = '') => `<button type="button" class="cn${on ? ' on' : ''}" data-act="${act}">${ic(icon, 22, '#33333A', 1.6)}<span>${label}</span>${extra}</button>`;
  const row = (f) => { const on = v === 'dm' && f.dm === A.channel; return `<button type="button" class="dmr${on ? ' on' : ''}" data-act="dm-open" data-id="${f.id}" aria-current="${on}">${xAv(f, 'sm')}<span class="tx"><b>${esc(f.name)}</b></span>${udot(f.dm)}</button>`; };
  return `<button type="button" class="qfind" data-act="qs-open">Encontre ou comece uma conversa</button>
  <div class="cnav">${nav('go-home', D.users, 'Amigos', v === 'friends')}${nav('open-plus', D.spark, 'Square Plus', false)}${nav('go-shop', D.grid, 'Loja', v === 'shop')}${nav('go-quests', D.quest, 'Missões', v === 'quests', '<em class="xnb">NOVO</em>')}</div>
  <hr class="chr0">
  <div class="dmh"><span>Mensagens diretas</span><button type="button" class="hov sq" data-act="add-tab" aria-label="Criar mensagem direta" title="Criar mensagem direta">${ic(D.plus, 16, '#55555F', 2)}</button></div>
  <button type="button" class="dmr${v === 'official' ? ' on' : ''}" data-act="go-official" aria-current="${v === 'official'}"><span class="xav sm sqo">${logoMark(16)}</span><span class="tx"><b>Square <u class="ofi">${ic(D.check, 10, '#fff', 3.2)}OFICIAL</u></b><small>Mensagem Oficial da Square</small></span></button>
  ${A.friends.filter((f) => f.dm).map(row).join('')}`;
}
function srvColHTML(s) {
  const cs = A.csec;
  const plus = (label, kind) => (s.mine ? `<button type="button" class="hov sq" data-act="modal-open" data-k="chan" data-kind="${kind}" aria-label="${label}" title="${label}">${ic(D.plus, 16, '#55555F', 2)}</button>` : '');
  const sec = (key, label, kind, add) => `<div class="sech"><button type="button" class="sect" data-act="csec" data-k="${key}" aria-expanded="${!cs[key]}">${label}${ic(cs[key] ? D.chevR : D.down, 12, '#55555F', 2.4)}</button>${plus(add, kind)}</div>`;
  const nav = (act, icon, label, extra = '') => `<button type="button" class="cn" data-act="${act}" ${extra}>${ic(icon, 20, '#33333A', 1.6)}<span>${label}</span></button>`;
  const menu = A.pop && A.pop.k === 'srv' ? `<div class="pop smenu" role="menu"><button type="button" class="pi" data-act="nav" data-k="invite">Convidar pessoas${ic(D.userPlus, 16)}</button>${s.mine ? `<button type="button" class="pi" data-act="modal-open" data-k="chan" data-kind="text">Criar canal${ic(D.plus, 16)}</button><button type="button" class="pi" data-act="bans">Ver banidos${ic(D.shield, 16)}</button>` : ''}</div>` : '';
  return `<div class="srvh"><button type="button" class="srvn" data-act="srvmenu" aria-haspopup="true" aria-expanded="${!!menu}"><span>${esc(s.name)}</span>${ic(D.down, 14, '#33333A', 2.2)}</button><button type="button" class="hov sq" data-act="nav" data-k="invite" aria-label="Convidar pessoas" title="Convidar pessoas">${ic(D.userPlus, 18, '#33333A', 1.7)}</button>${menu}</div>
  <div class="cnav">${nav('toast-soon', D.calendar, 'Eventos', 'data-msg="Eventos chegam em breve"')}${nav('open-boost', D.shield, 'Impulsos de servidor')}</div>
  <hr class="chr0">
  ${sec('text', 'Canais de Texto', 'text', 'Adicionar canal de texto')}
  ${cs.text ? '' : s.text.map((c) => { const on = A.channel === c.id; return `<div class="chr${on ? ' on' : ''}"><button type="button" class="chn" data-act="chan" data-id="${c.id}" aria-current="${on}">${ic(D.hash, 18, '#55555F', 1.9)}<span>${esc(c.name)}</span></button><span class="chx"><button type="button" class="hov" data-act="nav" data-k="invite" aria-label="Convidar pessoas" title="Convidar pessoas">${ic(D.userPlus, 15, '#33333A', 1.8)}</button><button type="button" class="hov" data-act="toast-soon" data-msg="As configurações do canal chegam em breve" aria-label="Editar canal" title="Editar canal">${ic(D.gear, 15, '#33333A', 1.7)}</button></span></div>`; }).join('')}
  ${sec('voice', 'Canais de Voz', 'voice', 'Adicionar canal de voz')}
  ${cs.voice ? '' : s.voice.map((g) => { const on = A.voice === g.id; return `<div class="xvg"><div class="chr${on ? ' on' : ''}"><button type="button" class="chn" data-act="vjoin" data-id="${g.id}" aria-label="${on ? 'Você está em ' : 'Entrar em '}${esc(g.name)}">${ic(D.volume, 18, '#55555F', 1.8)}<span>${esc(g.name)}</span></button></div>${voiceRoster(g.id).map((u) => { const p = s.byId[u]; return p ? `<div class="xvu"><span class="xav xs" style="background:${p.g}">${esc(p.ini)}</span><span>${esc(p.name)}</span></div>` : ''; }).join('')}</div>`; }).join('')}`;
}
function userPopHTML() {
  const me = A.me || {}, sub = A.pop.sub || '', pr = me.presence || 'online';
  const durs = (s) => `<div class="fly fly2">${[['Por 15 minutos', 900000], ['Por 1 hora', 3600000], ['Por 3 horas', 10800000], ['Por 8 horas', 28800000], ['Por 24 horas', 86400000], ['Até eu mudar', 0]].map((d) => `<button type="button" class="pi" data-act="status-set" data-s="${s}" data-ms="${d[1]}">${d[0]}</button>`).join('')}</div>`;
  const sti = (s, label, desc, dot) => `<div class="pi-w"><button type="button" class="pi st${pr === s ? ' cur' : ''}" data-act="status-set" data-s="${s}" data-ms="0"><i class="sd ${dot} stat"></i><span class="tx"><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span>${s === 'online' ? '' : ic(D.chevR, 14, '#55555F', 2.2)}</button>${s === 'online' ? '' : durs(s)}</div>`;
  const statusFly = `<div class="fly" role="menu">${sti('online', 'Disponível', '', 'on')}${sti('idle', 'Ausente', '', 'idle')}${sti('dnd', 'Não perturbe', 'Você não receberá notificação na área de trabalho', 'dnd')}${sti('invisible', 'Invisível', 'Você vai aparecer Off-line', 'off')}</div>`;
  const ptsFly = `<div class="fly pts"><div class="ptsh">${ic(D.coin, 30, '#7B6BB5', 1.6)}<b>0</b></div><div class="ptst"><small>Desafios ativos</small><button type="button" class="tagx" data-act="toast-soon" data-msg="O Square Plus chega em breve">Desbloquear 1.2x</button></div>
    <button type="button" class="ch2" data-act="go-shop"><span class="ci">${ic(D.grid, 18, '#fff', 1.8)}</span><span class="tx"><b>Compre um item da loja</b><small>Ganhe 2000 Pontos</small></span>${ic(D.chevR, 14, '#55555F', 2.2)}</button>
    <button type="button" class="ch2" data-act="go-shop"><span class="ci">${ic(D.heart, 18, '#fff', 1.8)}</span><span class="tx"><b>Adicione um item à lista de desejos</b><small>Ganhe 150 Pontos</small></span>${ic(D.chevR, 14, '#55555F', 2.2)}</button>
    <div class="ptsb"><button type="button" class="mbtn ghost sm" data-act="go-quests">${ic(D.quest, 16, '#1D1D22', 1.8)}Missões</button><button type="button" class="mbtn ghost sm" data-act="go-shop">${ic(D.grid, 16, '#1D1D22', 1.8)}Loja</button></div>
    <small class="ptsf">Pontos resgatados no total • <a href="#" data-act="soon" data-msg="A central de ajuda abre pelo ? no topo">Precisa de ajuda?</a></small></div>`;
  const acctFly = `<div class="fly" role="menu"><div class="pi cur2">${xAv(me, 'xs')}<span class="tx"><b>${esc(me.user || displayName())}</b></span>${ic(D.check, 16, '#4B4BC8', 2.6)}</div><button type="button" class="pi" data-act="open-settings" data-p="account"><span class="tx"><b>Gerenciar contas</b></span></button></div>`;
  const row = (key, icon, label, fly, lead) => `<div class="pi-w"><button type="button" class="pi" data-act="pop-sub" data-sub="${key}" aria-expanded="${sub === key}">${lead || ic(icon, 18, '#33333A', 1.7)}<span class="tx"><b>${label}</b></span>${ic(D.chevR, 14, '#55555F', 2.2)}</button>${sub === key ? fly : ''}</div>`;
  return `<div class="pop upop" role="menu" aria-label="Seu perfil">
  <div class="ubanner" style="background:${esc(me.accent || '#9D8CCF')}"></div>
  <div class="uav">${xAv(me, 'xl')}<button type="button" class="think" data-act="edit-profile">${ic(D.plus, 14, '#33333A', 2)}<span>${me.status ? esc(me.status) : 'O que você tem lido?'}</span></button></div>
  <div class="uname"><b>${esc(displayName())}</b><small>${esc(me.user || '')}</small></div>
  <div class="pgrp"><button type="button" class="pi" data-act="edit-profile">${ic(D.edit, 18, '#33333A', 1.7)}<span class="tx"><b>Editar perfil</b></span></button>
    ${row('status', 0, PRES[pr], statusFly, `<i class="sd ${sdCls(me)} stat"></i>`)}
    <button type="button" class="pi" data-act="toast-soon" data-msg="As insígnias chegam em breve">${ic(D.badge, 18, '#33333A', 1.7)}<span class="tx"><b>Insígnias</b></span></button>
    ${row('pts', D.coin, '0 Pontos', ptsFly)}</div>
  <div class="pgrp">${row('acct', D.user, 'Mudar de conta', acctFly)}</div></div>`;
}
function micPopHTML() {
  const sub = A.pop.sub || '', dev = SPV('in_device', 'default'), prof = SPV('input_profile', 'custom'), vol = SPV('in_vol', 100);
  const l = (A.devs && A.devs.in) || [];
  const fly = sub === 'indev' ? `<div class="fly fl-l"><button type="button" class="pi${dev === 'default' ? ' cur' : ''}" data-act="pop-dev" data-k="in_device" data-id="default"><span class="tx"><b>Padrão</b></span></button>${l.map((d) => `<button type="button" class="pi${dev === d.id ? ' cur' : ''}" data-act="pop-dev" data-k="in_device" data-id="${esc(d.id)}"><span class="tx"><b>${esc(d.label)}</b></span></button>`).join('')}</div>`
    : sub === 'inprof' ? `<div class="fly fl-l">${Object.keys(PROFS).map((k) => `<button type="button" class="pi${prof === k ? ' cur' : ''}" data-act="pop-dev" data-k="input_profile" data-id="${k}"><span class="tx"><b>${PROFS[k]}</b></span></button>`).join('')}</div>` : '';
  return `<div class="pop dpop mic" role="menu" aria-label="Opções do microfone">
  <div class="pi-w"><button type="button" class="pi two" data-act="pop-sub" data-sub="indev"><span class="tx"><b>Dispositivo de entrada</b><small>${esc(devLabel('in', dev))}</small></span>${ic(D.chevR, 14, '#55555F', 2.2)}</button>${sub === 'indev' ? fly : ''}</div>
  <div class="pi-w"><button type="button" class="pi two" data-act="pop-sub" data-sub="inprof"><span class="tx"><b>Perfil de entrada</b><small>${PROFS[prof] || 'Personalizado'}</small></span>${ic(D.chevR, 14, '#55555F', 2.2)}</button>${sub === 'inprof' ? fly : ''}</div>
  <hr class="chr0"><div class="vol"><b>Volume de entrada</b>${sliderHTML('in_vol', vol)}</div><hr class="chr0">
  <button type="button" class="pi" data-act="open-settings" data-p="voice">${ic(D.gear, 18, '#33333A', 1.7)}<span class="tx"><b>Configurações de voz</b></span></button></div>`;
}
function headPopHTML() {
  const sub = A.pop.sub || '', dev = SPV('out_device', 'default'), vol = SPV('out_vol', 100);
  const l = (A.devs && A.devs.out) || [];
  const fly = sub === 'outdev' ? `<div class="fly fl-l"><button type="button" class="pi${dev === 'default' ? ' cur' : ''}" data-act="pop-dev" data-k="out_device" data-id="default"><span class="tx"><b>Padrão</b></span></button>${l.map((d) => `<button type="button" class="pi${dev === d.id ? ' cur' : ''}" data-act="pop-dev" data-k="out_device" data-id="${esc(d.id)}"><span class="tx"><b>${esc(d.label)}</b></span></button>`).join('')}</div>` : '';
  return `<div class="pop dpop head" role="menu" aria-label="Opções do áudio">
  <div class="pi-w"><button type="button" class="pi two" data-act="pop-sub" data-sub="outdev"><span class="tx"><b>Dispositivo de saída</b><small>${esc(devLabel('out', dev))}</small></span>${ic(D.chevR, 14, '#55555F', 2.2)}</button>${sub === 'outdev' ? fly : ''}</div>
  <hr class="chr0"><div class="vol"><b>Volume de saída</b>${sliderHTML('out_vol', vol)}</div><hr class="chr0">
  <button type="button" class="pi" data-act="open-settings" data-p="voice">${ic(D.gear, 18, '#33333A', 1.7)}<span class="tx"><b>Configurações de voz</b></span></button></div>`;
}
function ubarHTML() {
  const me = A.me || {}, name = displayName(), pr = me.presence || 'online', pk = A.pop ? A.pop.k : '';
  const micOff = A.muted || A.deafened;
  return `${voiceBarHTML()}<div class="x-ub">
  ${pk === 'user' ? userPopHTML() : pk === 'mic' ? micPopHTML() : pk === 'head' ? headPopHTML() : ''}
  <button type="button" class="ub-me" data-act="pop" data-k="user" aria-haspopup="true" aria-expanded="${pk === 'user'}" aria-label="Seu perfil: ${esc(name)}">${xAv(Object.assign({ g: meBg(), ini: meIni(name), on: true }, me), 'sm')}<span class="tx"><b>${esc(name)}</b><small class="s1">${PRES[pr]}</small><small class="s2">${esc(me.user || '')}</small></span></button>
  <div class="ug${micOff ? ' off' : ''}"><button type="button" class="ugb" data-act="mute" aria-label="${micOff ? 'Ativar microfone' : 'Silenciar microfone'}" aria-pressed="${micOff}">${micOff ? ic(D.micOff, 20, '#B3261E', 1.9) : ic(D.mic, 20, '#33333A', 1.7)}</button><button type="button" class="ugc" data-act="pop" data-k="mic" aria-label="Opções do microfone" aria-expanded="${pk === 'mic'}">${ic(pk === 'mic' ? D.up : D.down, 12, '#33333A', 2.4)}</button></div>
  <div class="ug${A.deafened ? ' off' : ''}"><button type="button" class="ugb" data-act="deaf" aria-label="${A.deafened ? 'Ativar áudio' : 'Desativar áudio'}" aria-pressed="${A.deafened}">${A.deafened ? ic(D.head + '<path d="M4 4l16 16"/>', 20, '#B3261E', 1.9) : ic(D.head, 20, '#33333A', 1.7)}</button><button type="button" class="ugc" data-act="pop" data-k="head" aria-label="Opções do áudio" aria-expanded="${pk === 'head'}">${ic(pk === 'head' ? D.up : D.down, 12, '#33333A', 2.4)}</button></div>
  <button type="button" class="hov ugg" data-act="settings" aria-label="Configurações" title="Configurações">${ic(D.gear, 20, '#33333A', 1.6)}</button></div>`;
}
function leftHTML() {
  const srv = A.view === 'server' ? curServer() : null;
  return `<div class="x-left${A.drawer ? ' open' : ''}">
  <div class="x-lt">${railHTML()}<aside class="x-col" aria-label="${srv ? 'Canais do servidor' : 'Mensagens diretas'}"><div class="x-cs" id="sscroll">${srv ? srvColHTML(srv) : dmColHTML()}</div></aside></div>
  <div class="x-ubw">${ubarHTML()}</div></div>${A.drawer ? '<button type="button" class="x-bk" data-act="drawer" aria-label="Fechar menu"></button>' : ''}`;
}
function titlebarHTML() {
  const v = A.view, srv = v === 'server' ? curServer() : null, peer = v === 'dm' ? dmPeer(A.channel) : null;
  const t = srv ? [D.hash, srv.name] : peer ? [D.at, peer.name] : v === 'official' ? [D.bubble, 'Square'] : v === 'shop' ? [D.grid, 'Loja'] : v === 'quests' ? [D.quest, 'Missões'] : [D.users, 'Amigos'];
  const n = A.incoming.length;
  return `<header class="x-tb"><button type="button" class="hov x-burger" data-act="drawer" aria-label="Abrir menu">${ic(D.menu, 20, '#33333A', 1.8)}</button><span class="x-tt">${ic(t[0], 15, '#33333A', 1.9)}<span>${esc(t[1])}</span></span><span class="x-ti"><button type="button" class="hov" data-act="nav" data-k="notif" aria-label="Caixa de entrada" title="Caixa de entrada">${ic(D.inbox, 18, '#33333A', 1.8)}${n ? '<i class="udot"></i>' : ''}</button><button type="button" class="hov" data-act="nav" data-k="help" aria-label="Central de ajuda" title="Central de ajuda">${ic(D.help, 18, '#33333A', 1.8)}</button></span></header>`;
}

/* ---- página Amigos ---- */
function flistHTML() {
  const q = (A.gq || '').trim().toLowerCase();
  const base = A.ftab === 'online' ? A.friends.filter((p) => p.on) : A.friends;
  const list = base.filter((p) => !q || p.name.toLowerCase().indexOf(q) !== -1 || (p.user || '').toLowerCase().indexOf(q) !== -1);
  const title = `<h2 class="fcount">${A.ftab === 'online' ? 'Disponível' : 'Todos os amigos'} — ${base.length}</h2>`;
  if (!list.length) return title + `<div class="fempty">${q ? 'Nenhum amigo encontrado.' : A.ftab === 'online' ? 'Ninguém está disponível agora.' : 'Você ainda não tem amigos.'}${A.friends.length || q ? '' : '<div class="hcta"><button type="button" class="mbtn sm" data-act="add-tab">Adicionar amigo</button></div>'}</div>`;
  return title + list.map((p) => `<div class="fr"><button type="button" class="fmain" data-act="dm-open" data-id="${p.id}" aria-label="Abrir conversa com ${esc(p.name)}">${xAv(p, 'md')}<span class="tx"><b>${esc(p.name)}</b><small>${esc(p.st)}</small></span>${udot(p.dm)}</button><span class="fx"><button type="button" class="rb" data-act="dm-open" data-id="${p.id}" aria-label="Enviar mensagem" title="Enviar mensagem">${ic(D.bubble, 18, '#33333A', 1.8)}</button><button type="button" class="rb" data-act="fmenu" data-id="${p.id}" aria-label="Mais ações" title="Mais">${ic(D.dots, 18, '#33333A', 2)}</button></span></div>`).join('');
}
function addFriendHTML() {
  const f = A.af;
  return `<div class="af"><div class="afh"><div><h2>Adicionar amigo</h2><p>Você pode adicionar amigos com o nome de usuário Square deles.</p></div>${IMG_MASCOT}</div>
  <div class="afbox"><div class="afr"><input id="af-user" type="text" placeholder="Insira um nome de usuário" maxlength="30" value="${esc(f.user)}" data-app-bind="af:user" autocomplete="off" spellcheck="false" aria-label="Nome de usuário"><button type="button" class="mbtn sm" id="af-send" data-act="af-send"${f.user.trim() && !f.busy ? '' : ' disabled'}>Enviar pedido de amizade</button></div>
  <div class="afn"><textarea id="af-note" rows="3" maxlength="120" placeholder="Personalize sua solicitação (opcional)" data-app-bind="af:note" aria-label="Mensagem do pedido">${esc(f.note)}</textarea><span class="afc" id="af-cnt">${120 - f.note.length}</span></div></div>
  <p class="afhint">O que você escrever aqui também aparecerá nas suas mensagens diretas se vocês se tornarem amigos.</p>
  <hr class="chr0"><h3>Outros lugares para fazer amigos</h3><p class="afp">Ninguém vem à cabeça? Confira nossa lista de servidores públicos que tem todas as tribos, de jogos a culinária, música, anime e muito mais.</p>
  <button type="button" class="exl" data-act="srv-explore"><span class="exi">${ic(D.compass, 20, '#fff', 1.8)}</span><b>Explorar Servidores Públicos</b>${ic(D.chevR, 16, '#33333A', 2)}</button></div>`;
}
function friendsPageHTML() {
  const tab = A.ftab, t = (k, l) => `<button type="button" class="ftab${tab === k ? ' on' : ''}" data-act="ftab" data-k="${k}" aria-pressed="${tab === k}">${l}</button>`;
  const body = tab === 'add' ? addFriendHTML() : `<label class="fsearch"><input id="gsearch" type="text" placeholder="Buscar" value="${esc(A.gq)}" data-app-bind="gq" autocomplete="off" aria-label="Buscar amigos">${ic(D.search, 18, '#55555F', 1.8)}</label><div class="flist2" id="flist">${flistHTML()}</div>`;
  return `<header class="x-ph"><div class="pt fpt">${ic(D.users, 22, '#33333A', 1.6)}<h1>Amigos</h1></div><i class="dotsep" aria-hidden="true"></i>${t('online', 'Disponível')}${t('all', 'Todos')}<button type="button" class="ftab add${tab === 'add' ? ' on' : ''}" data-act="ftab" data-k="add" aria-pressed="${tab === 'add'}">Adicionar amigo</button><span class="tsp"></span><button type="button" class="hov sq" data-act="toast-soon" data-msg="Conversas em grupo chegam em breve" aria-label="Nova conversa em grupo" title="Nova conversa em grupo">${ic(D.userPlus, 20, '#33333A', 1.7)}</button></header>
  <div class="x-pb"><section class="x-pm">${body}</section><aside class="x-act" aria-label="Ativo agora"><h2>Ativo agora</h2><div class="acard"><b>Por enquanto, está quieto...</b><p>Quando um(a) amigo(a) começa uma atividade, como jogar um jogo ou bater papo por voz, mostraremos aqui!</p></div></aside></div>`;
}
const soonPage = (icon, title, text) => `<header class="x-ph"><div class="pt">${ic(icon, 22, '#33333A', 1.6)}<h1>${title}</h1></div></header><div class="x-pb"><section class="x-pm soon"><div class="soonc">${ic(icon, 40, '#9A9AA7', 1.4)}<h2>${title}: em breve</h2><p>${text}</p></div></section></div>`;
function officialPageHTML() {
  const name = (displayName() || '').split(' ')[0];
  return `<header class="x-ph"><div class="pt"><span class="xav sm sqo">${logoMark(16)}</span><h1>Square <u class="ofi">${ic(D.check, 10, '#fff', 3.2)}OFICIAL</u></h1></div></header>
  <div class="x-pb"><div class="x-chat"><div class="msgs"><div class="fill"></div><div class="min"><div class="col"><span class="av40 sqo">${logoMark(20)}</span></div><div class="bub"><span class="an">Square</span>Olá, ${esc(name)}! Bem-vindo(a) à Square. Aqui você conversa com amigos, cria servidores e participa de comunidades. Para começar, adicione um amigo ou crie o seu primeiro servidor.</div></div></div>
  <div class="comp"><div class="cbar"><input type="text" placeholder="Você não pode responder a esta conversa." disabled aria-label="Resposta indisponível"></div></div></div></div>`;
}
function dmPageHTML() {
  const peer = dmPeer(A.channel) || { name: 'Conversa', ini: '?', g: G.lilac, id: '' };
  return `<header class="x-ph"><div class="pt">${ic(D.at, 22, '#33333A', 1.6)}<h1>${esc(peer.name)}</h1><i class="sd ${sdCls(peer)} inl"></i></div><span class="tsp"></span><button type="button" class="hov sq${A.panel === 'search' ? ' sel' : ''}" data-act="nav" data-k="search" aria-label="Buscar mensagens" title="Buscar mensagens">${ic(D.search, 20, '#33333A', 1.7)}</button><button type="button" class="hov sq" data-act="profile" data-id="${peer.id}" aria-label="Ver perfil" title="Ver perfil">${ic(D.user, 20, '#33333A', 1.7)}</button></header>
  <div class="x-pb"><div class="x-chat"><div class="msgs" id="msgs" role="log" aria-label="Mensagens" aria-live="polite">${serverMsgsHTML()}</div>${composerHTML(true, 'Conversar com @' + peer.name)}</div></div>`;
}
function serverPageHTML() {
  const srv = curServer(), chObj = srv.text.find((c) => c.id === A.channel);
  const ib = (act, icon, label, on, extra = '') => `<button type="button" class="hov sq${on ? ' sel' : ''}" data-act="${act}" ${extra} aria-label="${label}" title="${label}">${ic(icon, 20, '#33333A', 1.7)}</button>`;
  return `<header class="x-ph"><div class="pt">${ic(D.hash, 22, '#33333A', 1.7)}<h1>${esc(chObj ? chObj.name : 'Sem canal')}</h1></div><span class="tsp"></span>${ib('toast-soon', D.threads, 'Tópicos', false, 'data-msg="Os tópicos chegam em breve"')}${ib('toast-soon', D.bell, 'Configurações de notificação', false, 'data-msg="As notificações por canal chegam em breve"')}${ib('nav', D.pin, 'Mensagens fixadas', A.panel === 'pins', 'data-k="pins"')}${ib('nav', D.users, 'Lista de membros', A.showMembers, 'data-k="members"')}<button type="button" class="xsearch" data-act="nav" data-k="search" aria-label="Buscar mensagens"><span>Buscar ${esc(srv.name)}</span>${ic(D.search, 16, '#55555F', 1.8)}</button></header>
  <div class="x-pb"><div class="x-chat"><div class="msgs" id="msgs" role="log" aria-label="Mensagens" aria-live="polite">${serverMsgsHTML()}</div>${composerHTML(!!chObj, chObj ? 'Conversar em #' + chObj.name : 'Crie um canal de texto para conversar')}</div>
  ${A.showMembers ? `<aside class="x-mem" aria-label="Lista de membros">${srv.mine ? '<button type="button" class="lnk banlnk" data-act="bans">Ver banidos</button>' : ''}<div class="mlist" id="mlist">${membersListHTML()}</div></aside>` : ''}</div>`;
}
function welcomeHTML(srv, chObj) {
  if (!srv.mine) return `<div class="wlc"><h2>Bem-vindo(a) a ${esc(srv.name)}</h2><p>Este é o começo do canal #${esc(chObj ? chObj.name : '')}.</p></div>`;
  const card = (act, bg, icon, label, extra = '') => `<button type="button" class="wc" data-act="${act}" ${extra}><span class="wi" style="background:${bg}">${ic(icon, 18, '#fff', 1.8)}</span><b>${label}</b>${ic(D.chevR, 16, '#55555F', 2)}</button>`;
  return `<div class="wlc"><h2>Bem-vindo(a) a<br>${esc(srv.name)}</h2><p>Este é seu servidor, novinho em folha. Aqui vão algumas dicas para ajudar você a começar! Para mais informações, confira nosso <a href="#" data-act="soon" data-msg="O guia de como começar chega em breve">guia de como começar</a>.</p>
  <div class="wcs">${card('nav', '#9D8CCF', D.userPlus, 'Convide seus amigos', 'data-k="invite"')}${card('toast-soon', '#78BE9D', D.camera, 'Personalize seu servidor com um ícone', 'data-msg="Os ícones de servidor chegam em breve"')}${card('focus-msg', '#7DB8CF', D.send, 'Envie sua primeira mensagem')}${card('toast-soon', '#6CBF7E', D.download, 'Baixar o App Square', 'data-msg="Os apps para celular e computador chegam em breve"')}${card('toast-soon', '#E897AB', D.apps, 'Adicione seu primeiro app', 'data-msg="Os apps de servidor chegam em breve"')}${card('open-boost', '#C77DBA', D.spark, 'Desbloqueie vantagens para todos com impulsos')}</div></div>`;
}
function dmIntroHTML(peer) {
  if (!peer) return '';
  return `<div class="wlc dmi">${xAv(peer, 'xl')}<h2>${esc(peer.name)}</h2><small>@${esc(peer.user || '')}</small><p>Este é o começo da sua conversa com <b>${esc(peer.name)}</b>.</p></div>`;
}

/* ---- janelas novas: buscar conversa e criar servidor em passos ---- */
function qsResHTML(q) {
  q = String(q || '').trim().toLowerCase();
  const m = (s) => !q || String(s || '').toLowerCase().indexOf(q) !== -1;
  const fr = A.friends.filter((f) => m(f.name) || m(f.user)).slice(0, 6).map((f) => `<button type="button" class="qr" data-act="qs-go" data-k="dm" data-id="${f.id}">${xAv(f, 'sm')}<b>${esc(f.name)}</b><small>@${esc(f.user)}</small></button>`);
  const sv = SERVERS.filter((s) => m(s.name)).slice(0, 5).map((s) => `<button type="button" class="qr" data-act="qs-go" data-k="srv" data-id="${s.id}"><span class="stl sm" style="background:${s.tile}">${esc(s.ini)}</span><b>${esc(s.name)}</b><small>servidor</small></button>`);
  const ch = []; SERVERS.forEach((s) => s.text.forEach((c) => { if (m(c.name) && q) ch.push(`<button type="button" class="qr" data-act="qs-go" data-k="chan" data-id="${c.id}" data-sid="${s.id}">${ic(D.hash, 18, '#55555F', 1.9)}<b>${esc(c.name)}</b><small>${esc(s.name)}</small></button>`); }));
  const all = [].concat(fr.length ? ['<h4>Amigos</h4>'].concat(fr) : [], sv.length ? ['<h4>Servidores</h4>'].concat(sv) : [], ch.length ? ['<h4>Canais</h4>'].concat(ch.slice(0, 6)) : []);
  return all.length ? all.join('') : '<p class="mnote">Nada encontrado.</p>';
}
function qsHTML() {
  return `<div class="mback qsb" data-act="modal-bg"><div class="modal qs" role="dialog" aria-modal="true" aria-label="Encontre ou comece uma conversa"><input id="qs-in" class="qsin" type="text" placeholder="Onde você quer ir?" value="${esc(A.modal.q || '')}" data-app-bind="m:q" autocomplete="off" aria-label="Buscar"><div class="qsres" id="qsres">${qsResHTML(A.modal.q)}</div><div class="qsf">Procure amigos, servidores e canais.</div></div></div>`;
}
function srvNewHTML(m) {
  const first = !SERVERS.length, step = m.step;
  const x = `<button type="button" class="hov sq mx" data-act="modal-close" aria-label="Fechar">${ic(D.close, 18, '#55555F', 1.8)}</button>`;
  let inner = '';
  if (step === 'start') {
    const row = (k, ico, label) => `<button type="button" class="sn-r" data-act="sn-tpl" data-k="${k}"><span class="sn-i">${ico}</span><b>${label}</b>${ic(D.chevR, 16, '#55555F', 2)}</button>`;
    inner = `<h2>${first ? 'Crie seu primeiro servidor na Square' : 'Criar seu servidor'}</h2><p class="sn-p">Seu servidor é onde você e seus amigos se reúnem. Crie o seu e comece a interagir.</p>
    <div class="sn-l">${row('own', '🛠️', 'Criar o meu')}<h3>Começar de um molde</h3>${TPLS.map((t) => row(t[0], t[2], t[1])).join('')}</div>
    ${first ? '<div class="sn-f"><a href="#" data-act="modal-open" data-k="srv" data-mode="join">Já tem um convite? Entrar em um servidor</a></div>' : '<div class="sn-f2"><b>Já tem um convite?</b><button type="button" class="mbtn ghost" data-act="modal-open" data-k="srv" data-mode="join">Entrar em um servidor</button></div>'}`;
  } else if (step === 'about') {
    inner = `<h2>Conte-nos mais sobre o seu servidor</h2><p class="sn-p">Para podermos te ajudar com as configurações, seu novo servidor é para alguns amigos ou uma grande comunidade?</p>
    <div class="sn-l"><button type="button" class="sn-r" data-act="sn-kind" data-k="friends"><span class="sn-i">🛋️</span><b>Para meus amigos e eu</b>${ic(D.chevR, 16, '#55555F', 2)}</button><button type="button" class="sn-r" data-act="sn-kind" data-k="community"><span class="sn-i">🌍</span><b>Para um clube ou comunidade</b>${ic(D.chevR, 16, '#55555F', 2)}</button></div>
    <p class="sn-skip">Não sabe? Você pode <a href="#" data-act="sn-kind" data-k="">pular essa pergunta</a> por enquanto.</p><div class="sn-b"><button type="button" class="sn-back" data-act="sn-back">Voltar</button></div>`;
  } else {
    inner = `<h2>Personalize o seu servidor</h2><p class="sn-p">Deixe seu novo servidor com a sua cara dando um nome e um ícone a ele. Se quiser, é possível mudar depois.</p>
    <button type="button" class="sn-up" data-act="toast-soon" data-msg="Os ícones de servidor chegam em breve" aria-label="Enviar ícone"><span>${ic(D.camera, 22, '#33333A', 1.7)}<small>Enviar</small></span><i>${ic(D.plus, 14, '#fff', 2.4)}</i></button>
    <div class="mf sn-n"><label for="mf-name">Nome do servidor <em>*</em></label><input id="mf-name" data-mf type="text" data-app-bind="m:name" maxlength="40" value="${esc(m.name)}" autocomplete="off" spellcheck="false"></div>
    ${m.kind === 'community' ? `<div class="mf"><button type="button" class="mtog${m.pub ? ' on' : ''}" data-act="m-pub" aria-pressed="${!!m.pub}"><i></i><span>Servidor público (aparece em Explorar)</span></button></div>` : ''}
    <p class="sn-t">Ao criar um servidor, você concorda com as <a href="/termos" target="_blank" rel="noopener">diretrizes da comunidade</a> da Square.</p>
    ${m.err ? `<div class="merr" role="alert">${esc(m.err)}</div>` : ''}
    <div class="sn-b"><button type="button" class="sn-back" data-act="sn-back">Voltar</button><button type="button" class="mbtn" data-act="modal-submit"${m.busy ? ' disabled' : ''}>${m.busy ? 'Aguarde…' : 'Criar'}</button></div>`;
  }
  const compact = step === 'start' && !first;
  return `<div class="mback" data-act="modal-bg"><div class="modal sn${compact ? ' compact' : ''}" role="dialog" aria-modal="true" aria-label="Criar servidor">${compact ? '' : `<div class="sn-art">${ILLUS}</div>`}<div class="sn-c">${x}${inner}</div></div></div>`;
}

function appView() {
  if (window.SQ_SET && window.SQ_SET.def.in_vol === undefined) window.SQ_SET.def.in_vol = 100;
  const panel = A.panel ? PANELS[A.panel] : null;
  const reqRow = (p) => `<div class="it req"><button type="button" class="pf" data-act="profile" data-id="${p.id}" aria-label="Ver perfil de ${esc(p.name)}" style="background:${p.g}">${esc(p.ini)}</button><span class="tx"><b>${esc(p.name)}</b><span>Quer ser seu amigo${p.user ? ' · @' + esc(p.user) : ''}</span>${p.note ? `<span class="rnote">“${esc(p.note)}”</span>` : ''}</span><button type="button" class="mbtn sm ghost" data-act="fr-decline" data-id="${p.id}">Recusar</button><button type="button" class="mbtn sm" data-act="fr-accept" data-id="${p.id}">Aceitar</button></div>`;
  const panelHTML = panel ? `<div class="panel" role="dialog" aria-label="${panel.title}"><div class="ph"><span>${panel.title}</span><button type="button" class="hov sq" data-act="close-panel" aria-label="Fechar painel">${ic(D.close, 16, '#55555F', 1.8)}</button></div>
    ${A.panel === 'search' ? searchPanelHTML() : A.panel === 'mentions' ? mentionsPanelHTML() : A.panel === 'notif' ? (A.incoming.length ? A.incoming.map(reqRow).join('') : '<div class="it"><span>Nada por aqui ainda.</span></div>') + '<button type="button" class="it res" data-act="mentions-open"><b>Ver menções</b><span>Mensagens em que citaram você</span></button>' : panel.items.length ? panel.items.map((it) => `<div class="it"><b>${esc(it.t)}</b><span>${esc(it.s)}</span></div>`).join('') : '<div class="it"><span>Nada por aqui ainda.</span></div>'}</div>` : '';
  markCur();
  const ready = A.world === 'ready', v = A.view;
  let page;
  if (A.world === 'loading') page = '<div class="x-load"><div class="spin" role="status" aria-label="Carregando"></div></div>';
  else if (A.world === 'error') page = `<div class="x-load"><div class="hempty">${esc(A.werr)}</div><div class="hcta"><button type="button" class="mbtn" data-act="reload-world">Tentar de novo</button></div></div>`;
  else if (v === 'server' && SERVERS.length) page = serverPageHTML();
  else if (v === 'dm') page = dmPageHTML();
  else if (v === 'official') page = officialPageHTML();
  else if (v === 'shop') page = soonPage(D.grid, 'Loja', 'Estamos preparando a loja da Square. Por enquanto, nada para comprar.');
  else if (v === 'quests') page = soonPage(D.quest, 'Missões', 'As missões e os Pontos chegam junto com a loja.');
  else page = friendsPageHTML();
  let fm = '';
  if (A.pop && A.pop.k === 'fmenu') {
    const p = findPerson(A.pop.id);
    if (p) fm = `<div class="pop fm" role="menu" style="left:${A.pop.x}px;top:${A.pop.y}px"><button type="button" class="pi" data-act="profile" data-id="${p.id}"><span class="tx"><b>Ver perfil</b></span></button><button type="button" class="pi" data-act="dm-open" data-id="${p.id}"><span class="tx"><b>Enviar mensagem</b></span></button><button type="button" class="pi bad" data-act="fr-remove" data-id="${p.id}"><span class="tx"><b>Remover amigo</b></span></button><button type="button" class="pi bad" data-act="fr-block" data-id="${p.id}"><span class="tx"><b>Bloquear</b></span></button></div>`;
  }
  return `<div class="x">${titlebarHTML()}<div class="x-bd">${leftHTML()}<main class="x-main" aria-label="Conteúdo">${page}</main></div>${panelHTML}${fm}${!ready ? '' : ''}${modalHTML()}</div>`;
}


/* ---- ações da nova casca ---- */
async function afSend() {
  const f = A.af, u = f.user.trim().replace(/^@/, ''); if (!u || f.busy) return;
  f.busy = true; render();
  const w = A;
  try {
    const r = await rpc('send_friend_request', { p_username: u, p_note: f.note.trim() });
    await loadWorld(() => {});
    if (A !== w) return;
    A.af = { user: '', note: '', busy: false }; render(); toast(FR_MSG[r] || 'Pronto');
  } catch (e) { if (A === w) { f.busy = false; render(); toast(errText(e)); } }
}
function shellAct(act, el, ev) {
  const go = (v) => { A.view = v; A.panel = null; render(); return true; };
  switch (act) {
    case 'soon': if (ev) ev.preventDefault(); toast(el.dataset.msg || 'Em breve'); return true;
    case 'go-home': return go('friends');
    case 'go-official': return go('official');
    case 'go-shop': return go('shop');
    case 'go-quests': return go('quests');
    case 'add-tab': A.ftab = 'add'; go('friends'); setTimeout(() => { const f = document.getElementById('af-user'); if (f) f.focus(); }, 0); return true;
    case 'ftab': A.ftab = el.dataset.k; go('friends'); if (A.ftab === 'add') setTimeout(() => { const f = document.getElementById('af-user'); if (f) f.focus(); }, 0); return true;
    case 'open-plus': if (window.SQ_SET) window.SQ_SET.open('plus'); return true;
    case 'open-boost': if (window.SQ_SET) window.SQ_SET.open('boost'); return true;
    case 'open-settings': if (window.SQ_SET) window.SQ_SET.open(el.dataset.p || undefined); return true;
    case 'srv-new': A.modal = { type: 'srvnew', step: 'start', tpl: '', kind: '', name: '', pub: false, err: '', busy: false }; render(); return true;
    case 'srv-explore': A.modal = { type: 'srv', mode: 'explore', name: '', code: '', pub: false, list: null, err: '', busy: false }; render(); loadExplore(); return true;
    case 'qs-open': A.modal = { type: 'qs', q: '' }; render(); setTimeout(() => { const f = document.getElementById('qs-in'); if (f) f.focus(); }, 0); return true;
    case 'drawer': A.drawer = !A.drawer; render(); return true;
    case 'csec': A.csec[el.dataset.k] = !A.csec[el.dataset.k]; render(); return true;
    case 'srvmenu': A.pop = A.pop && A.pop.k === 'srv' ? null : { k: 'srv', sub: '' }; render(); return true;
    case 'pop': { const k = el.dataset.k; A.pop = A.pop && A.pop.k === k ? null : { k, sub: '' }; if (A.pop && (k === 'mic' || k === 'head')) loadDevs(); render(); return true; }
    case 'pop-sub': if (A.pop) { const x = el.dataset.sub; A.pop.sub = A.pop.sub === x ? '' : x; if (x === 'indev' || x === 'outdev') loadDevs(); render(); } return true;
    case 'pop-dev': {
      const k = el.dataset.k, id = el.dataset.id;
      if (window.SQ_SET) window.SQ_SET.setP(k, id);
      if (k === 'out_device' && VC) Object.keys(VC.peers).forEach((u) => { const a = VC.peers[u].audio; if (a && a.setSinkId) a.setSinkId(id === 'default' ? '' : id).catch(() => {}); });
      if (A.pop) A.pop.sub = ''; render(); return true;
    }
    case 'status-set': setPresence(el.dataset.s, Number(el.dataset.ms) || 0); return true;
    case 'fmenu': {
      const r = el.getBoundingClientRect(), w = 200, h = 176;
      const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w));
      let y = r.bottom + 4; if (y + h > window.innerHeight) y = Math.max(8, r.top - h - 4);
      A.pop = { k: 'fmenu', id: el.dataset.id, x, y }; render(); return true;
    }
    case 'af-send': afSend(); return true;
    case 'mentions-open': A.panel = 'mentions'; loadMentions(); render(); return true;
    case 'focus-msg': setTimeout(() => { const f = document.getElementById('msg'); if (f) f.focus(); }, 0); return true;
    default: return false;
  }
}
const POP_ACTS = ['pop', 'pop-sub', 'pop-dev', 'status-set', 'srvmenu', 'drawer'];
function appAction(act, el, ev) {
  if (A.pop && !POP_ACTS.includes(act)) A.pop = null;
  if (A.drawer && !POP_ACTS.includes(act) && act !== 'mute' && act !== 'deaf') A.drawer = false;
  if (shellAct(act, el, ev)) return;
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
      quiet(); const ct = curTrack();
      if (!ct) { openMusic('search'); return; }
      if (A.loadedId !== ct.id) playIdx(A.qi);
      else if (AUD.paused) { A.playing = true; AUD.play().catch(() => { A.playing = false; paintMusic(); }); paintMusic(); }
      else AUD.pause();
      return;
    }
    case 'seek': { quiet(); if (!curTrack() || A.loadedId !== curTrack().id) return; const r = el.getBoundingClientRect(); const f = Math.min(1, Math.max(0, ((ev ? ev.clientX : r.left) - r.left) / (r.width || 1))); const d = AUD.duration || 30; AUD.currentTime = f * d; A.prog = f * d; paintProg(); return; }
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
    case 'mute': A.muted = !A.muted; voiceApply(); if (window.SQ_SET) window.SQ_SET.fx(A.muted ? 'mute' : 'unmute'); break;
    case 'deaf': A.deafened = !A.deafened; voiceApply(); if (window.SQ_SET) window.SQ_SET.fx(A.deafened ? 'deaf' : 'undeaf'); break;
    case 'menu': A.menu = !A.menu; break;
    case 'settings': A.menu = false; if (window.SQ_SET) window.SQ_SET.open(); else toast('Não foi possível abrir as configurações.'); break;
    case 'logout': logout(); return;
    case 'nav': { const k = el.dataset.k; if (k === 'invite') { openInvite(); return; } if (k === 'members') A.showMembers = !A.showMembers; else { A.panel = A.panel === k ? null : k; if (A.panel === 'mentions') loadMentions(); if (A.panel === 'search') { A.sres = null; runSearch(); } } break; }
    case 'close-panel': A.panel = null; break;
    case 'otoggle': A.onlineOpen = !A.onlineOpen; break;
    case 'ftoggle': A.offlineOpen = !A.offlineOpen; break;
    case 'emoji-toggle': A.emojiOpen = !A.emojiOpen; break;
    case 'emoji': A.draft += el.dataset.ch; A.emojiOpen = false; render(); { const m = document.getElementById('msg'); if (m) m.focus(); } return;
    case 'send': doSend(false); return;
    case 'hsend': doSend(true); return;
    case 'hub': A.view = 'friends'; A.panel = null; break;
    case 'srv-open': { selectServer(el.dataset.id); render({ scroll: true }); return; }
    case 'friends-open': if (SERVERS.length) { A.view = 'server'; A.showMembers = true; A.panel = null; } break;
    case 'chat-open': { const s = serverOfChan(A.hubKey); if (!s && dmPeer(A.hubKey)) { A.channel = A.hubKey; A.view = 'dm'; A.panel = null; render({ scroll: true }); return; } if (s) { A.server = s.id; A.channel = A.hubKey; A.search = ''; A.view = 'server'; A.panel = null; render({ scroll: true }); } return; }
    case 'hubchat': A.hubKey = el.dataset.key; A.hubSrv = false; render({ scroll: true }); return;
    case 'hubsrv': A.hubSrv = true; render(); return;
    case 'pin': { const id = el.dataset.id; if (el.dataset.close) A.modal = null; pinAct(id, true); return; }
    case 'unpin': pinAct(el.dataset.id, false); return;
    case 'pin-add': if (!SERVERS.length) return toast('Entre em um servidor primeiro.'); if (pinCount() >= 4) return toast(ERRS.too_many_pins); A.modal = { type: 'pinpick', err: '', busy: false }; render(); return;
    case 'mprev': quiet(); nextTrack(-1); return;
    case 'mnext': quiet(); nextTrack(1); return;
    case 'mtrack': quiet(); playIdx(Number(el.dataset.i) || 0); return;
    case 'panel': A.panel = A.panel === el.dataset.k ? null : el.dataset.k; break;
    case 'goto-msg': { const ch = el.dataset.ch, srv = serverOfChan(ch); A.panel = null; if (srv) { A.server = srv.id; A.channel = ch; A.view = 'server'; } else if (A.dmUser[ch]) { A.channel = ch; A.view = 'dm'; } render({ scroll: true }); return true; }
    case 'wd-opts': if (!planPaid()) return toast(ERRS.plan_widget); A.modal = { type: 'widget', err: '', busy: false }; render(); return;
    case 'wd-set': if (planPaid() && (el.dataset.k === 'featured' || STREAMS[el.dataset.k])) { store.set('sq.wd.' + myId(), el.dataset.k); A.modal = null; render(); } return;
    case 'feat-join': { const id = el.dataset.id; rpc('join_public_server', { p_server: id }).then(async () => { await loadWorld(() => {}); A.hubSrv = true; render(); toast('Você entrou no servidor'); }).catch((e) => toast(errText(e))); return; }
    case 'toast-soon': toast(el.dataset.msg || 'Isso chega em breve'); return;
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
  if (t.dataset.pv) {
    const v = Number(t.value); t.style.setProperty('--v', v + '%');
    if (window.SQ_SET) window.SQ_SET.setP(t.dataset.pv, v);
    if (VC) {
      if (t.dataset.pv === 'in_vol' && VC.gain) VC.gain.gain.value = v / 100;
      if (t.dataset.pv === 'out_vol') Object.keys(VC.peers).forEach((u) => { if (VC.peers[u].audio) VC.peers[u].audio.volume = v / 100; });
    }
    return;
  }
  if (t.dataset.appBind) {
    if (t.dataset.appBind.startsWith('af:')) { A.af[t.dataset.appBind.slice(3)] = t.value; const b = document.getElementById('af-send'); if (b) b.disabled = !A.af.user.trim() || A.af.busy; const c = document.getElementById('af-cnt'); if (c) c.textContent = String(120 - A.af.note.length); return; }
    if (t.dataset.appBind === 'sq') { A.sq = t.value; clearTimeout(sqTimer); sqTimer = setTimeout(() => { runSearch(); if (A.panel === 'search') render(); }, 350); return; }
    if (t.dataset.appBind === 'search') { A.search = t.value; const l = document.getElementById('mlist'); if (l) l.innerHTML = membersListHTML(); }
    else if (t.dataset.appBind === 'gq') { A.gq = t.value; A.search = t.value; refilter(); }
    else if (t.dataset.appBind.startsWith('m:')) { if (A.modal) { A.modal[t.dataset.appBind.slice(2)] = t.value; if (A.modal.type === 'music' && t.dataset.appBind === 'm:q') { clearTimeout(musT); musT = setTimeout(musSearch, 450); } if (A.modal.type === 'qs') { const r = document.getElementById('qsres'); if (r) r.innerHTML = qsResHTML(A.modal.q); } } }
    else if (t.dataset.appBind === 'hdraft') { A.hdraft = t.value; const b = document.getElementById('hsend'); if (b) b.hidden = !A.hdraft.trim(); if (t.value) sendTyping(); }
    else { A.draft = t.value; const b = document.getElementById('send-btn'); if (b) b.hidden = !A.draft.trim(); if (t.value) sendTyping(); }
    return;
  }
  const b = t.dataset.bind;
  if (!b || t.type === 'checkbox' || t.tagName === 'SELECT') return;
  setPath(b, t.value); onBound(b, t);
});
$root.addEventListener('wheel', (e) => {
  const c = e.target && e.target.closest ? e.target.closest('#scar') : null;
  if (!c || e.ctrlKey || c.scrollWidth <= c.clientWidth) return;
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY, max = c.scrollWidth - c.clientWidth;
  if ((d < 0 && c.scrollLeft <= 0) || (d > 0 && c.scrollLeft >= max - 1)) return;
  e.preventDefault(); c.scrollLeft += d;
}, { passive: false });
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
  if (e.target.id === 'af-user' && e.key === 'Enter') { e.preventDefault(); afSend(); }
  if (e.target.id === 'qs-in' && e.key === 'Enter') { e.preventDefault(); const b = document.querySelector('#qsres .qr'); if (b) b.click(); }
  if (e.target.matches && e.target.matches('.modal input[data-mf]') && e.key === 'Enter') { e.preventDefault(); modalSubmit(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.view === 'app' && A.modal) { closeModal(); return; }
  if (e.key === 'Escape' && S.view === 'app' && (A.menu || A.panel || A.emojiOpen || A.pop || A.drawer)) { A.menu = false; A.panel = null; A.emojiOpen = false; A.pop = null; A.drawer = false; render(); }
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
    if (A.menu || A.emojiOpen || (A.pop && !e.target.closest('.pop'))) { A.menu = false; A.emojiOpen = false; if (!e.target.closest('.pop')) A.pop = null; render(); }
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
