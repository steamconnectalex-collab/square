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
const freshR = () => ({ email: '', display: '', user: '', pass: '', day: '', month: '', year: '', opt: false, show: false, touched: false, srv: {}, busy: false, err: '' });
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
  if (!dobParts(r)) e.dob = 'Informe uma data de nascimento válida.';
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
  <p class="fine">Ao clicar em “Criar conta”, você concorda com os termos de serviço e confirma que leu a política de privacidade.</p>
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
      birth_date: dobParts(r), marketing_opt_in: !!r.opt
    });
    S.pendingEmail = d.email; tab.set('sq.pending', d.email);
    S.v = freshV(); S.v.coolUntil = Date.now() + 30000;
    if (d.sent === false) S.v.notice = 'Já enviamos um código há poucos instantes. Confira sua caixa de entrada.';
    r.pass = ''; r.busy = false;
    go('verify');
  } catch (e) {
    r.busy = false;
    const m = { email_taken: 'email', invalid_email: 'email', username_taken: 'user', invalid_username: 'user', weak_password: 'pass', invalid_birth_date: 'dob' }[e.error];
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
   TELA PRINCIPAL (dados de demonstração; o chat real vem depois)
   ===================================================================== */
const G = {
  lilac: 'linear-gradient(135deg,#D9CDF2,#9D8CCF)', rose: 'linear-gradient(135deg,#FAD3DC,#E897AB)',
  sky: 'linear-gradient(135deg,#C9E6F0,#7DB8CF)', mint: 'linear-gradient(135deg,#CBE9D9,#78BE9D)',
  sand: 'linear-gradient(135deg,#F9E5C0,#EBBA6C)', slate: 'linear-gradient(135deg,#DCDCE4,#9A9AA7)'
};
/* FOTOS DE TESTE (provisório): só para ter uma ideia de como o projeto fica.
   Antes do lançamento, trocar por um ícone de boneco: USE_TEST_PHOTOS = false e apagar site/img/. */
const USE_TEST_PHOTOS = true;
const ph = (file, fallback) => (USE_TEST_PHOTOS ? `url('img/${file}.jpg') center/cover no-repeat, ${fallback}` : fallback);
const meBg = () => ph('eu', G.lilac);
const meIni = (name) => (USE_TEST_PHOTOS ? '' : (name.charAt(0) || '?').toUpperCase());
const Pp = (id, name, st, g, photo) => ({ id, name, st, g: photo ? ph(photo, g) : g, ini: photo && USE_TEST_PHOTOS ? '' : name.charAt(0) });
const V = (name, g, bot) => ({ name, g, bot: !!bot });
const SERVERS = [
  { id: 's1', name: 'Arena Estelar', users: '119.282', activity: '15 minutos atrás', ini: 'A', tile: 'linear-gradient(160deg,#F4C7D3,#B79BDB)',
    text: [{ id: 'geral', name: 'Geral' }, { id: 'amigos', name: 'Amigos próximos' }],
    voice: [
      { id: 'sala', name: 'Sala principal', members: [V('Lorena Lima', G.rose), V('Irwin Peixoto', G.sky), V('Estefani Leal', G.mint)] },
      { id: 'rapida', name: 'Partida rápida', members: [V('Yasmin Sabino', G.sand), V('Duda Brandão', G.lilac), V('Bot de música', G.slate, true)] },
      { id: 'treino', name: 'Treino', members: [V('Rafa Teles', G.sky), V('Nina Prado', G.rose)] }],
    online: [Pp('lia', 'Lia Monteiro', 'Arena Estelar: nível 15 Vanguarda', G.rose, 'estatua'), Pp('salma', 'Salma Fonseca', 'Reinos de Vale: menu principal', G.lilac, 'anime'), Pp('marina', 'Marina Rocha', 'Cidade Neon: Operadora', G.sky, 'mono1'), Pp('theo', 'Theo Bramante', 'Dunas: 14 jogadores restantes', G.slate, 'tux')],
    offline: [Pp('leo', 'Leo Cavalcante', 'Offline', G.mint), Pp('caio', 'Caio Santana', 'Offline', G.sand)] },
  { id: 's2', name: 'Dunas', users: '212.990', activity: '2 horas atrás', ini: 'D', tile: 'linear-gradient(160deg,#F7DDB5,#E39B6B)',
    text: [{ id: 'geral', name: 'Geral' }, { id: 'estrategias', name: 'Estratégias' }],
    voice: [
      { id: 'comboio', name: 'Comboio', members: [V('Bruno Azevedo', G.sky), V('Camila Duarte', G.rose)] },
      { id: 'duplas', name: 'Modo duplas', members: [V('Tati Moura', G.mint), V('Bot de música', G.slate, true)] }],
    online: [Pp('bruno', 'Bruno Azevedo', 'Dunas: modo duplas', G.sky, 'terno'), Pp('camila', 'Camila Duarte', 'Ouvindo música', G.rose, 'morcego'), Pp('rodrigo', 'Rodrigo Nunes', 'Arena Estelar: treino', G.lilac, 'craque'), Pp('tati', 'Tati Moura', 'Online', G.mint, 'mono2')],
    offline: [Pp('hugo', 'Hugo Pires', 'Offline', G.sand), Pp('vera', 'Vera Lins', 'Offline', G.slate)] },
  { id: 's3', name: 'Cidade Neon', users: '112.230', activity: 'ontem', ini: 'N', tile: 'linear-gradient(160deg,#BFE3EE,#6C9AD0)',
    text: [{ id: 'geral', name: 'Geral' }, { id: 'clipes', name: 'Clipes' }],
    voice: [
      { id: 'garagem', name: 'Garagem', members: [V('Ravi Costa', G.sand), V('Julia Prado', G.lilac)] },
      { id: 'cobertura', name: 'Cobertura', members: [V('Pietra Lemos', G.mint)] }],
    online: [Pp('ravi', 'Ravi Costa', 'Cidade Neon: patrulha', G.sand), Pp('julia', 'Julia Prado', 'Online', G.lilac), Pp('otavio', 'Otávio Sá', 'Ouvindo música', G.sky), Pp('pietra', 'Pietra Lemos', 'Reinos de Vale: Mapa novo', G.mint)],
    offline: [Pp('nando', 'Nando Alves', 'Offline', G.slate), Pp('bela', 'Bela Furtado', 'Offline', G.rose)] }
];
const PANELS = {
  notif: { title: 'Notificações', items: [{ t: 'Lia mencionou você em Geral', s: 'há 2 minutos' }, { t: 'Marina entrou na Sala principal', s: 'há 8 minutos' }, { t: 'Dunas convidou você para jogar', s: 'há 1 hora' }] },
  pins: { title: 'Mensagens fixadas', items: [{ t: 'Regras do grupo', s: 'Respeite todo mundo e avise quando for faltar a uma partida.' }, { t: 'Horário das partidas', s: 'Sextas, às 21h. Chame os amigos com antecedência.' }] },
  mentions: { title: 'Menções', items: [{ t: 'Marina: Ok, Davi. Corre!', s: 'Geral · 12:57' }] },
  help: { title: 'Central de ajuda', items: [{ t: 'Como criar um servidor', s: 'Passo a passo para começar a sua comunidade.' }, { t: 'Atalhos do teclado', s: 'Enter envia a mensagem que você escreveu.' }, { t: 'Falar com o suporte', s: 'Resposta em até um dia útil.' }] }
};
const EMOJIS = [['😀', 'Sorriso'], ['😂', 'Rindo'], ['👍', 'Joia'], ['🔥', 'Fogo'], ['🎮', 'Controle'], ['🎉', 'Festa'], ['❤️', 'Coração'], ['😮', 'Surpresa']];
const REPLIES = ['Boa!', 'Chegando já.', 'Haha, verdade.', 'Fechou, bora!', 'Já estou no lobby.', 'Combinado.', 'Depois me conta mais.'];

let A = null;
function seedThreads(first) {
  return {
    's1:geral': [
      { id: 1, from: 'lia', text: 'Galera, a partida começa em 10 minutos.', time: '12:53' },
      { id: 2, from: 'salma', text: 'Melhor ser rápido. Minha mãe está me esperando pra sair.', time: '12:55' },
      { id: 3, from: 'me', text: 'Beleza, chego em alguns minutos.', time: '12:56' },
      { id: 4, from: 'marina', text: `Ok, ${first}. Corre!`, time: '12:57' },
      { id: 5, from: 'theo', text: 'Hoje não vai dar, estou passando mal. Tento chegar à tarde, mas se não der, sem problema, tranquilo!', time: '12:57' },
      { id: 6, from: 'me', text: 'Que pena, Theo. Melhoras!', time: '12:58' },
      { id: 7, from: 'marina', text: 'Caramba, Theo! O que aconteceu?', time: '12:58' }],
    's1:amigos': [
      { id: 1, from: 'marina', text: 'Quem fecha a dupla comigo hoje à noite?', time: '11:20' },
      { id: 2, from: 'me', text: 'Eu fecho, só preciso terminar uma coisa antes.', time: '11:24' },
      { id: 3, from: 'lia', text: 'Me chama pro próximo, estou sem dupla.', time: '11:31' }],
    's2:geral': [
      { id: 1, from: 'bruno', text: 'Alguém topa uma dupla em Dunas?', time: '09:40' },
      { id: 2, from: 'camila', text: 'Eu! Só terminar o café.', time: '09:42' },
      { id: 3, from: 'me', text: 'Entro em 5 minutos.', time: '09:44' }],
    's2:estrategias': [
      { id: 1, from: 'rodrigo', text: 'A rota pelo cânion é mais segura no começo.', time: '08:15' },
      { id: 2, from: 'me', text: 'Anotado, valeu!', time: '08:18' }],
    's3:geral': [
      { id: 1, from: 'ravi', text: 'Saiu atualização nova hoje cedo.', time: '10:05' },
      { id: 2, from: 'julia', text: 'Vi aqui, o mapa novo ficou lindo.', time: '10:09' }],
    's3:clipes': [
      { id: 1, from: 'pietra', text: 'Olha esse clipe da última partida!', time: '16:30' },
      { id: 2, from: 'otavio', text: 'Isso foi sorte ou habilidade?', time: '16:32' }]
  };
}
const firstName = () => displayName().split(/\s+/)[0] || 'Você';
function initApp() {
  if (A && A.owner === (S.session && S.session.user && S.session.user.id)) return;
  A = {
    owner: S.session && S.session.user && S.session.user.id,
    server: 's1', channel: 'geral', collapsed: { 's1:treino': true }, voice: 's1:sala', muted: false, deafened: false,
    panel: null, showMembers: true, onlineOpen: true, offlineOpen: true, draft: '', search: '', emojiOpen: false,
    typing: null, typingKey: null, menu: false, threads: seedThreads(firstName()), t1: null, t2: null,
    view: 'hub', hubKey: 's1:geral', hdraft: '', gq: '', searchOpen: false, barOpen: false, playing: true, track: 0, prog: 34, ntab: 'news', entered: false
  };
}
function stopAppTimers() { if (A) { clearTimeout(A.t1); clearTimeout(A.t2); A.t1 = A.t2 = null; } }

const curServer = () => SERVERS.find((s) => s.id === A.server) || SERVERS[0];

/* ---------------------------------------------------------------------
   PAINEL INICIAL (tela principal depois do login): amigos, conversa,
   festas fixadas, mais jogados, player e notícias. Dados de demonstração.
   --------------------------------------------------------------------- */
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
const NEWS = [
  { src: 'Notícias Arena', t: 'Temporada nova chegou à Arena Estelar', s: 'Mapa novo, modos novos e recompensas até o fim do mês.', g: 'linear-gradient(160deg,#F4C7D3,#B79BDB)' },
  { src: 'Dunas Oficial', t: 'Modo duplas ganha ranking', s: 'Suba de nível com os amigos e ganhe títulos.', g: 'linear-gradient(160deg,#F7DDB5,#E39B6B)' },
  { src: 'Cidade Neon News', t: 'Atualização de outono já está no ar', s: 'Corrida noturna e ajustes de desempenho.', g: 'linear-gradient(160deg,#BFE3EE,#6C9AD0)' }
];
const FREE = [
  { src: 'Loja Square', t: 'Reinos de Vale grátis no fim de semana', s: 'Resgate até domingo e jogue com a turma.', g: 'linear-gradient(160deg,#CBE9D9,#78BE9D)' },
  { src: 'Loja Square', t: 'Pacote de avatares sem custo', s: 'Cinco molduras novas para o seu perfil.', g: 'linear-gradient(160deg,#D9CDF2,#9D8CCF)' },
  { src: 'Loja Square', t: 'Teste Arena Estelar Premium', s: 'Três dias com todos os modos liberados.', g: 'linear-gradient(160deg,#FAD3DC,#E897AB)' }
];
const HUB_KEYS = ['s1:geral', 's2:geral'];
const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const srvOf = (id) => SERVERS.find((s) => s.id === id) || SERVERS[0];

function friendsList() {
  const seen = {}, out = [];
  SERVERS.forEach((s) => s.online.forEach((p) => { if (!seen[p.id]) { seen[p.id] = 1; out.push({ p, sid: s.id }); } }));
  return out;
}
function friendsHTML() {
  const q = (A.gq || '').trim().toLowerCase();
  const list = friendsList().filter((f) => !q || f.p.name.toLowerCase().indexOf(q) !== -1);
  if (!list.length) return '<div class="hempty">Nenhum amigo encontrado.</div>';
  return list.map((f) => `<button type="button" class="frow hov" data-act="friend" data-sid="${f.sid}" data-id="${f.p.id}" aria-label="Conversar com ${esc(f.p.name)}"><span class="pf" style="background:${f.p.g}" aria-hidden="true">${esc(f.p.ini)}<i></i></span><span class="tx"><b>${esc(f.p.name)}</b><small>${esc(f.p.st)}</small></span></button>`).join('');
}
function refilter() {
  const f = document.getElementById('flist'); if (f) f.innerHTML = friendsHTML();
  const l = document.getElementById('mlist'); if (l) l.innerHTML = membersListHTML();
}

function topbarHTML() {
  const hub = A.view === 'hub';
  return `<header class="tbar">
  <button type="button" class="tbh ${hub ? 'sel' : 'hov'}" data-act="hub" aria-label="Início" aria-pressed="${hub}">${ic(D.bubble, 22, '#33333A', 1.6)}</button>
  <i class="tsep" aria-hidden="true"></i>
  <nav class="tsrv" aria-label="Seus servidores">${SERVERS.map((s) => { const on = !hub && A.server === s.id; return `<button type="button" class="stile${on ? ' on' : ''}" data-act="srv-open" data-id="${s.id}" aria-label="${esc(s.name)}" aria-pressed="${on}" title="${esc(s.name)}" style="background:${s.tile}">${s.ini}</button>`; }).join('')}<button type="button" class="stile add" data-act="toast-server" aria-label="Adicionar servidor" title="Adicionar servidor">${ic(D.plus, 20, '#33333A', 1.8)}</button></nav>
  <span class="tsp"></span><i class="tsep" aria-hidden="true"></i>
  <div class="tsearch${A.searchOpen ? ' open' : ''}" id="tsearch"><input id="gsearch" type="text" placeholder="Buscar amigos" value="${esc(A.gq)}" data-app-bind="gq" autocomplete="off" aria-label="Buscar amigos"><button type="button" class="tbs hov" data-act="gsearch" aria-label="Buscar">${ic(D.search, 22, '#33333A', 1.7)}</button></div>
</header>`;
}

function hubChatHTML() {
  const key = A.hubKey, srv = srvOf(key.split(':')[0]);
  const people = {}; srv.online.concat(srv.offline).forEach((p) => { people[p.id] = p; });
  const thread = (A.threads[key] || []).slice(-3);
  const typingP = A.typing && A.typingKey === key ? people[A.typing] : null;
  const tabs = HUB_KEYS.map((k) => { const s = srvOf(k.split(':')[0]), on = k === key; return `<button type="button" class="ctab${on ? ' on' : ''}" data-act="hubchat" data-key="${k}" aria-pressed="${on}" aria-label="${esc(s.name)}" title="${esc(s.name)}" style="background:${s.tile}">${s.ini}</button>`; }).join('');
  return `<div class="hchat">
  <div class="hch">${tabs}<span class="tsp"></span><button type="button" class="hov wext" data-act="chat-open" aria-label="Abrir a conversa completa">${ic(D.ext, 17)}</button></div>
  <div class="hmsgs" id="hmsgs" role="log" aria-label="Mensagens recentes" aria-live="polite">
    ${thread.map((m) => {
      if (m.from === 'me') return `<div class="mout"><div class="bub"><span class="sr">Você: </span>${esc(m.text)}</div></div>`;
      const p = people[m.from];
      return `<div class="min"><div class="av40" aria-hidden="true" style="background:${p ? p.g : G.slate}">${esc(p ? p.ini : '')}</div><div class="bub"><span class="sr">${esc(p ? p.name : '')}: </span>${esc(m.text)}</div></div>`;
    }).join('')}
    ${typingP ? `<div class="min"><div class="av40" aria-hidden="true" style="background:${typingP.g}">${esc(typingP.ini)}</div><div class="typing"><i></i><i></i><i></i></div></div>` : ''}
  </div>
  <div class="cbar hbar">
    <button type="button" class="hov ib" data-act="toast-attach" aria-label="Anexar arquivo">${ic(D.clip, 18)}</button>
    <input id="hmsg" type="text" placeholder="Escreva algo..." value="${esc(A.hdraft)}" data-app-bind="hdraft" autocomplete="off" aria-label="Escreva uma mensagem">
    <button type="button" class="go" id="hsend" data-act="hsend" aria-label="Enviar mensagem"${A.hdraft.trim() ? '' : ' hidden'}>${ic(D.send, 17, '#FFFFFF', 1.8)}</button>
  </div>
</div>`;
}

function pinnedHTML() {
  const av = [G.rose, G.sky, G.mint].map((g, i) => `<span class="pav" style="background:${g};margin-left:${i ? -10 : 0}px"></span>`).join('');
  return `<div class="pp"><h2>Festas fixadas</h2><div class="pgrid">
    <button type="button" class="pslot has" data-act="srv-open" data-id="s1" aria-label="Abrir Arena Estelar"><span class="pavs">${av}</span><small>Arena Estelar</small></button>
    ${[0, 1, 2].map(() => `<button type="button" class="pslot" data-act="toast-pin" aria-label="Fixar uma festa">${ic(D.plus, 20, '#62626D', 1.6)}</button>`).join('')}
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
  const card = (x) => `<article class="ncard"><div class="nart" style="background:${x.g}"><button type="button" class="hov next" data-act="toast-soon" aria-label="Abrir">${ic(D.ext, 16, '#1D1D22', 1.8)}</button></div><div class="nb"><div class="src"><span style="background:${x.g}"></span>${esc(x.src)}</div><h4>${esc(x.t)}</h4><p>${esc(x.s)}</p></div></article>`;
  const tab = (k, label) => `<button type="button" role="tab" class="ntab${A.ntab === k ? ' on' : ''}" id="tab-${k}" data-act="ntab" data-k="${k}" aria-selected="${A.ntab === k}">${label}</button>`;
  return `<div class="ntabs" role="tablist">${tab('news', 'Notícias')}${tab('free', 'Jogos grátis')}<span class="tsp"></span><button type="button" class="hov wext" data-act="toast-soon" aria-label="Abrir">${ic(D.ext, 17)}</button></div>
  <div class="npane${A.ntab === 'news' ? ' on' : ''}" id="pane-news" role="tabpanel">${NEWS.map(card).join('')}</div>
  <div class="npane${A.ntab === 'free' ? ' on' : ''}" id="pane-free" role="tabpanel">${FREE.map(card).join('')}</div>`;
}

function userbarHTML() {
  const me = displayName(), mutedEff = A.muted || A.deafened;
  const x = (act, icon, label, i, extra = '') => `<button type="button" class="hov tb" data-act="${act}" ${extra} aria-label="${label}" style="transition-delay:${i * 55}ms">${ic(icon, 20, '#33333A', 1.7)}</button>`;
  return `<div class="barwrap"><div class="ubar${A.barOpen ? ' open' : ''}" id="ubar">
  ${A.menu ? `<div class="menu" role="menu" aria-label="Menu da conta"><button type="button" role="menuitem" class="hov" data-act="settings">Configurações</button><button type="button" role="menuitem" class="hov out" data-act="logout">Sair da conta</button></div>` : ''}
  <span class="pic" title="${esc(me)}" aria-label="${esc(me)}" style="background:${meBg()}">${esc(meIni(me))}</span>
  <button type="button" class="hov tb" data-act="deaf" aria-label="${A.deafened ? 'Ativar áudio' : 'Desativar áudio'}" aria-pressed="${A.deafened}">${A.deafened ? ic(D.head + '<path d="M4 4l16 16"/>', 20, '#D92D45', 1.8) : ic(D.head, 20, '#33333A', 1.7)}</button>
  <button type="button" class="hov tb" data-act="mute" aria-label="${mutedEff ? 'Ativar microfone' : 'Silenciar microfone'}" aria-pressed="${mutedEff}">${mutedEff ? ic(D.micOff, 20, '#D92D45', 1.8) : ic(D.mic, 20, '#33333A', 1.7)}</button>
  <button type="button" class="hov tb" data-act="menu" aria-label="Menu da conta" aria-haspopup="true" aria-expanded="${A.menu}">${ic(D.gear, 20, '#33333A', 1.6)}</button>
  <button type="button" class="hov tb dots" id="b-dots" data-act="bar" aria-label="Mais opções" aria-expanded="${A.barOpen}">${ic(D.dots, 20, '#33333A', 1.7)}</button>
  <span class="xtra">${x('panel', D.bell, 'Notificações', 1, 'data-k="notif"')}${x('toast-friend', D.userPlus, 'Adicionar amigo', 2)}${x('toast-edit', D.edit, 'Editar perfil', 3)}${x('panel', D.help, 'Central de ajuda', 4, 'data-k="help"')}${x('bar', D.chevL, 'Recolher', 5)}</span>
</div></div>`;
}

function hubHTML(enter) {
  const w = (cls, i, inner) => `<section class="w ${cls}" style="--i:${i}">${inner}</section>`;
  return `<main class="hub${enter ? ' enter' : ''}" aria-label="Painel inicial">
  ${w('w-fr', 0, `<div class="wh"><h2>Amigos online</h2><button type="button" class="hov wext" data-act="friends-open" aria-label="Abrir lista de membros">${ic(D.ext, 17)}</button></div><div class="flist" id="flist">${friendsHTML()}</div>`)}
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
    if (A.prog >= t.d) { A.track = (A.track + 1) % TRACKS.length; A.prog = 0; if (A.view === 'hub') render(); return; }
    paintProg();
  }, 1000);
}
function paintProg() {
  if (S.view !== 'app' || !A || A.view !== 'hub') return;
  const t = TRACKS[A.track], p = Math.min(100, (A.prog / t.d) * 100);
  const f = document.getElementById('mfill'), k = document.getElementById('mknob'), c = document.getElementById('mcur');
  if (f) f.style.width = p + '%'; if (k) k.style.left = p + '%'; if (c) c.textContent = fmt(A.prog);
}
function hubSend() {
  const text = A.hdraft.trim();
  if (!text) return;
  A.threads[A.hubKey] = (A.threads[A.hubKey] || []).concat([{ id: Date.now(), from: 'me', text, time: nowHM() }]);
  A.hdraft = '';
  scheduleReply(A.hubKey);
  render({ scroll: true });
  const el = document.getElementById('hmsg'); if (el) el.focus();
}

function membersListHTML() {
  const srv = curServer();
  const q = (A.search || '').trim().toLowerCase();
  const match = (p) => !q || p.name.toLowerCase().indexOf(q) !== -1;
  const on = srv.online.filter(match), off = srv.offline.filter(match);
  const plural = (n) => (n === 1 ? ' membro' : ' membros');
  const row = (p, offline) => `<div class="mrow${offline ? ' off' : ''}"><div class="pf" style="background:${p.g}" aria-hidden="true">${esc(p.ini)}</div>
    <div class="tx"><b>${esc(p.name)}</b><span>${esc(offline ? 'Offline' : p.st)}</span></div>
    <button type="button" class="hov dm" data-act="dm" data-id="${p.id}" aria-label="Enviar mensagem para ${esc(p.name)}">${ic(D.dm, 19, '#55555F', 1.6)}</button></div>`;
  const grp = (open, key, label) => `<button type="button" class="hov mg" data-act="${key}" aria-expanded="${open}"><span>${label}</span>${ic(open ? D.up : D.down, 18)}</button>`;
  return `${grp(A.onlineOpen, 'otoggle', 'Online (' + on.length + plural(on.length) + ')')}
  ${A.onlineOpen ? `<div style="display:flex;flex-direction:column;gap:4px">${on.map((p) => row(p, false)).join('')}</div>` : ''}
  <div style="height:1px;margin:8px 0;background:rgba(29,29,34,.08)"></div>
  ${grp(A.offlineOpen, 'ftoggle', 'Offline (' + off.length + plural(off.length) + ')')}
  ${A.offlineOpen ? `<div style="display:flex;flex-direction:column;gap:4px">${off.map((p) => row(p, true)).join('')}</div>` : ''}
  ${on.length + off.length === 0 ? '<div style="padding:12px 4px;font-size:13px;color:#55555F">Nenhum membro encontrado para essa busca.</div>' : ''}`;
}

function serverHTML() {
  const srv = curServer();
  const mutedEff = A.muted || A.deafened;
  const me = displayName();
  const initial = (me.charAt(0) || '?').toUpperCase();
  const people = srv.online.concat(srv.offline); const byId = {}; people.forEach((p) => { byId[p.id] = p; });
  const isDm = A.channel.indexOf('dm:') === 0;
  const dmPerson = isDm ? byId[A.channel.slice(3)] : null;
  const chObj = srv.text.find((c) => c.id === A.channel);
  const chTitle = isDm ? (dmPerson ? dmPerson.name : 'Conversa') : (chObj ? chObj.name : 'Geral');
  const threadKey = srv.id + ':' + A.channel;
  const thread = A.threads[threadKey] || [];
  const typingP = A.typing && A.typingKey === threadKey ? byId[A.typing] : null;
  let voiceName = '';
  if (A.voice) { const [sid, gid] = A.voice.split(':'); const vs = SERVERS.find((s) => s.id === sid); const vg = vs && vs.voice.find((g) => g.id === gid); voiceName = vg ? vg.name + ' · ' + vs.name : ''; }
  const nav = (k, icon, label, on) => `<button type="button" class="nbtn ${on ? 'sel' : 'hov'}" data-act="nav" data-k="${k}" aria-pressed="${!!on}">${ic(icon, 18, '#55555F', 1.6)}${label}</button>`;
  const plus = (label, act) => `<button type="button" class="hov sq" data-act="${act}" aria-label="${label}">${ic(D.plus, 18)}</button>`;

  return `<div class="ap">
<div class="cloud" aria-hidden="true" style="left:-120px;bottom:-160px;width:560px;height:460px;background:radial-gradient(closest-side,rgba(140,140,158,.42),rgba(140,140,158,0))"></div>
<div class="cloud" aria-hidden="true" style="left:190px;top:38%;width:420px;height:300px;background:radial-gradient(closest-side,rgba(176,176,192,.32),rgba(176,176,192,0))"></div>

<aside class="side" aria-label="Servidores e canais">
  <div class="sbrand">${logo(14)}${BRAND}</div>
  <label class="search"><input id="search" type="text" placeholder="Buscar membros" value="${esc(A.search)}" data-app-bind="search" autocomplete="off" aria-label="Buscar membros">${ic(D.search, 17)}</label>
  <div class="sscroll" id="sscroll">
    <div class="blk" style="gap:8px">
      <div class="bh"><span>${ic(D.gamepad, 19, '#55555F', 1.6)}Seus servidores</span>${plus('Adicionar servidor', 'toast-server')}</div>
      <div class="tiles">${SERVERS.map((s) => { const on = s.id === A.server; return `<button type="button" class="tile" data-act="srv" data-id="${s.id}" aria-pressed="${on}" aria-label="${esc(s.name)}, ${s.users} usuários">
        <span class="art" style="background:${s.tile};box-shadow:${on ? '0 0 0 2px #FFFFFF,0 0 0 4px #1D1D22,0 10px 18px rgba(29,29,34,.2)' : '0 8px 16px rgba(29,29,34,.16)'}">${s.ini}</span>
        <span class="n">${esc(s.name)}</span><span class="u">${s.users}</span></button>`; }).join('')}</div>
    </div>
    <div class="div"></div>
    <div class="blk">
      <div class="bh"><span>${ic(D.hash, 19, '#55555F', 1.6)}Canais de texto</span>${plus('Adicionar canal de texto', 'toast-channel')}</div>
      ${srv.text.map((c) => { const on = A.channel === c.id; return `<button type="button" class="chan ${on ? 'sel' : 'hov'}" data-act="chan" data-id="${c.id}" aria-current="${on}" style="font-weight:${on ? 700 : 400}">${esc(c.name)}</button>`; }).join('')}
    </div>
    <div class="div"></div>
    <div class="blk">
      <div class="bh"><span>${ic(D.volume, 19, '#55555F', 1.6)}Canais de voz</span>${plus('Adicionar canal de voz', 'toast-channel')}</div>
      ${srv.voice.map((g) => {
        const key = srv.id + ':' + g.id, joined = A.voice === key, open = !A.collapsed[key];
        const members = g.members.map((m) => ({ name: m.name, g: m.g, bot: m.bot, muted: false, w: 500 }));
        if (joined) members.unshift({ name: me + ' (você)', g: meBg(), bot: false, muted: mutedEff, w: 700 });
        return `<div class="vg"><div class="vgh">
          <button type="button" class="hov vjoin" data-act="vjoin" data-key="${key}" aria-pressed="${joined}" aria-label="${joined ? 'Sair de ' : 'Entrar em '}${esc(g.name)}" style="color:${joined ? '#1B6B47' : '#33333A'}"><i style="background:${joined ? '#2DA770' : 'rgba(29,29,34,.22)'}"></i><span>${esc(g.name)}</span></button>
          <button type="button" class="hov sq" data-act="vopen" data-key="${key}" aria-label="${open ? 'Ocultar ' : 'Mostrar '}${esc(g.name)}" aria-expanded="${open}">${ic(open ? D.up : D.down, 17, '#55555F', 1.8)}</button></div>
          ${open ? `<div style="display:flex;flex-direction:column;gap:2px">${members.map((m) => `<div class="vm"><span class="av" style="background:${m.g}"></span><span class="nm" style="font-weight:${m.w}">${esc(m.name)}</span>${m.muted ? ic(D.micOff, 15, '#D92D45', 1.8) : (m.bot ? ic(D.music, 15, '#62626D', 1.8) : ic(D.head, 15, '#62626D', 1.8))}</div>`).join('')}</div>` : ''}</div>`;
      }).join('')}
    </div>
  </div>
  ${A.voice ? `<div class="vbar"><div style="min-width:0"><b>Voz conectada</b><span>${esc(voiceName)}</span></div><button type="button" class="hov tb" data-act="leave-voice" aria-label="Sair da chamada de voz">${ic(D.leave, 17, '#1B6B47', 1.8)}</button></div>` : ''}
  <div class="me">
    ${A.menu ? `<div class="menu" role="menu" aria-label="Menu da conta"><button type="button" role="menuitem" class="hov" data-act="settings">Configurações</button><button type="button" role="menuitem" class="hov out" data-act="logout">Sair da conta</button></div>` : ''}
    <div class="who"><span class="pic" aria-hidden="true" style="background:${meBg()}">${esc(USE_TEST_PHOTOS ? '' : initial)}</span><strong title="${esc(S.session && S.session.user ? S.session.user.email : '')}">${esc(me)}</strong></div>
    <div class="tools">
      <button type="button" class="hov tb" data-act="mute" aria-label="${mutedEff ? 'Ativar microfone' : 'Silenciar microfone'}" aria-pressed="${mutedEff}">${mutedEff ? ic(D.micOff, 18, '#D92D45', 1.8) : ic(D.mic)}</button>
      <button type="button" class="hov tb" data-act="deaf" aria-label="${A.deafened ? 'Ativar áudio' : 'Desativar áudio'}" aria-pressed="${A.deafened}">${A.deafened ? ic(D.head + '<path d="M4 4l16 16"/>', 18, '#D92D45', 1.8) : ic(D.head)}</button>
      <button type="button" class="hov tb" data-act="menu" aria-label="Menu da conta" aria-haspopup="true" aria-expanded="${A.menu}">${ic(D.sliders)}</button>
    </div>
  </div>
</aside>

<div class="main">
  <header class="top">
    <div class="t">${ic(D.gamepad, 24, '#55555F', 1.6)}<div style="min-width:0"><h1>${esc(srv.name)}</h1><small>Última atividade: ${esc(srv.activity)}</small></div></div>
    <nav class="nav" aria-label="Ferramentas do servidor">
      ${nav('notif', D.bell, 'Notificações', A.panel === 'notif')}${nav('pins', D.pin, 'Mensagens fixadas', A.panel === 'pins')}${nav('members', D.users, 'Lista de membros', A.showMembers)}${nav('mentions', D.at, 'Menções', A.panel === 'mentions')}${nav('help', D.help, 'Central de ajuda', A.panel === 'help')}
    </nav>
  </header>
  <div class="body">
    ${A.showMembers ? `<aside class="mem" aria-label="Lista de membros"><h3>${ic(D.users, 20, '#55555F', 1.6)}Lista de membros</h3><div class="mlist" id="mlist">${membersListHTML()}</div></aside>` : ''}
    <section class="chat" aria-label="Conversa">
      <div class="ch">${ic(isDm ? D.at : D.hash, 19, '#55555F', 1.6)}<h2>${esc(chTitle)}</h2></div>
      <div class="msgs" id="msgs" role="log" aria-label="Mensagens" aria-live="polite">
        <div class="fill"></div>
        ${thread.length === 0 ? `<div class="empty">Nenhuma mensagem ainda. Diga oi para ${esc(chTitle)}.</div>` : ''}
        ${thread.map((m) => {
          if (m.from === 'me') return `<div class="mout"><div class="bub"><span class="sr">Você: </span>${esc(m.text)}</div></div>`;
          const p = byId[m.from];
          return `<div class="min"><div class="col" aria-hidden="true"><div class="av40" style="background:${p ? p.g : G.slate}">${esc(p ? p.ini : '')}</div><small>${esc(m.time)}</small></div>
            <div class="bub"><span class="sr">${esc(p ? p.name : '')} às ${esc(m.time)}: </span>${esc(m.text)}</div></div>`;
        }).join('')}
        ${typingP ? `<div class="min"><div class="av40" aria-hidden="true" style="background:${typingP.g}">${esc(typingP.ini)}</div><div class="typing"><i></i><i></i><i></i></div><span style="padding-bottom:6px;font-size:11.5px;color:#62626D">${esc(typingP.name.split(' ')[0])} está digitando</span></div>` : ''}
      </div>
      <div class="comp">
        ${A.emojiOpen ? `<div class="emoji" role="group" aria-label="Escolher emoji">${EMOJIS.map((e) => `<button type="button" class="hov" data-act="emoji" data-ch="${e[0]}" aria-label="Inserir emoji ${e[1]}">${e[0]}</button>`).join('')}</div>` : ''}
        <div class="cbar">
          <button type="button" class="hov plus" data-act="toast-attach" aria-label="Anexar arquivo">${ic(D.plus, 19)}</button>
          <input id="msg" type="text" placeholder="Escreva algo..." value="${esc(A.draft)}" data-app-bind="draft" autocomplete="off" aria-label="Escreva uma mensagem">
          <button type="button" class="hov ib" data-act="toast-gift" aria-label="Enviar presente">${ic(D.gift, 19, '#55555F', 1.6)}</button>
          <button type="button" class="hov ib" data-act="toast-gif" aria-label="Escolher GIF"><span class="gif">GIF</span></button>
          <button type="button" class="hov ib" data-act="emoji-toggle" aria-label="Escolher emoji" aria-expanded="${A.emojiOpen}">${ic(D.smile, 19, '#55555F', 1.6)}</button>
          <button type="button" class="go" id="send-btn" data-act="send" aria-label="Enviar mensagem"${A.draft.trim() ? '' : ' hidden'}>${ic(D.send, 18, '#FFFFFF', 1.8)}</button>
        </div>
      </div>
    </section>
  </div>
</div>
</div>`;
}

function appView() {
  const enter = !A.entered; A.entered = true;
  const panel = A.panel ? PANELS[A.panel] : null;
  const panelHTML = panel ? `<div class="panel" role="dialog" aria-label="${panel.title}"><div class="ph"><span>${panel.title}</span><button type="button" class="hov sq" data-act="close-panel" aria-label="Fechar painel">${ic(D.close, 16, '#55555F', 1.8)}</button></div>
    ${panel.items.map((it) => `<div class="it"><b>${esc(it.t)}</b><span>${esc(it.s)}</span></div>`).join('')}</div>` : '';
  return `<div class="shell">
<div class="cloud" aria-hidden="true" style="left:-140px;bottom:-180px;width:600px;height:480px;background:radial-gradient(closest-side,rgba(140,140,158,.34),rgba(140,140,158,0))"></div>
<div class="cloud c2" aria-hidden="true" style="right:-160px;top:20%;width:520px;height:420px;background:radial-gradient(closest-side,rgba(214,200,240,.4),rgba(214,200,240,0))"></div>
${topbarHTML()}${panelHTML}${A.view === 'hub' ? hubHTML(enter) : serverHTML()}</div>`;
}

function appSend() {
  const text = A.draft.trim();
  if (!text) return;
  const key = A.server + ':' + A.channel;
  A.threads[key] = (A.threads[key] || []).concat([{ id: Date.now(), from: 'me', text, time: nowHM() }]);
  A.draft = ''; A.emojiOpen = false;
  scheduleReply(key);
  render({ scroll: true });
  const el = document.getElementById('msg'); if (el) el.focus();
}
function scheduleReply(key) {
  const sid = key.split(':')[0], ch = key.slice(sid.length + 1);
  const srv = srvOf(sid);
  const who = ch.indexOf('dm:') === 0 ? srv.online.find((p) => p.id === ch.slice(3)) : srv.online[Math.floor(Math.random() * srv.online.length)];
  if (!who) return;
  stopAppTimers();
  A.t1 = setTimeout(() => { if (S.view !== 'app') return; A.typing = who.id; A.typingKey = key; render({ scroll: true }); }, 800);
  A.t2 = setTimeout(() => {
    if (S.view !== 'app') return;
    A.threads[key] = (A.threads[key] || []).concat([{ id: Date.now() + 1, from: who.id, text: REPLIES[Math.floor(Math.random() * REPLIES.length)], time: nowHM() }]);
    A.typing = null; A.typingKey = null; render({ scroll: true });
  }, 2600);
}

function appAction(act, el, ev) {
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
    default: break;
  }
  if (act !== 'menu') A.menu = false;
  if (act !== 'emoji-toggle' && act !== 'emoji') A.emojiOpen = false;
  const reset = () => { A.emojiOpen = false; A.typing = null; A.typingKey = null; };
  switch (act) {
    case 'srv': { const s = SERVERS.find((x) => x.id === el.dataset.id); A.server = s.id; A.channel = s.text[0].id; A.search = ''; reset(); break; }
    case 'chan': A.channel = el.dataset.id; reset(); break;
    case 'dm': A.channel = 'dm:' + el.dataset.id; reset(); break;
    case 'vjoin': A.voice = A.voice === el.dataset.key ? null : el.dataset.key; break;
    case 'vopen': A.collapsed[el.dataset.key] = !A.collapsed[el.dataset.key]; break;
    case 'leave-voice': A.voice = null; break;
    case 'mute': A.muted = !A.muted; break;
    case 'deaf': A.deafened = !A.deafened; break;
    case 'menu': A.menu = !A.menu; break;
    case 'settings': A.menu = false; toast('Configurações chegam em breve'); break;
    case 'logout': logout(); return;
    case 'nav': { const k = el.dataset.k; if (k === 'members') A.showMembers = !A.showMembers; else A.panel = A.panel === k ? null : k; break; }
    case 'close-panel': A.panel = null; break;
    case 'otoggle': A.onlineOpen = !A.onlineOpen; break;
    case 'ftoggle': A.offlineOpen = !A.offlineOpen; break;
    case 'emoji-toggle': A.emojiOpen = !A.emojiOpen; break;
    case 'emoji': A.draft += el.dataset.ch; A.emojiOpen = false; render(); { const m = document.getElementById('msg'); if (m) m.focus(); } return;
    case 'send': appSend(); return;
    case 'hsend': hubSend(); return;
    case 'hub': A.view = 'hub'; A.panel = null; reset(); break;
    case 'srv-open': { const s = SERVERS.find((x) => x.id === el.dataset.id) || SERVERS[0]; A.server = s.id; A.channel = s.text[0].id; A.search = ''; A.view = 'server'; A.panel = null; reset(); render({ scroll: true }); return; }
    case 'friend': { A.server = el.dataset.sid; A.channel = 'dm:' + el.dataset.id; A.search = ''; A.view = 'server'; A.panel = null; reset(); render({ scroll: true }); return; }
    case 'friends-open': A.view = 'server'; A.showMembers = true; A.panel = null; reset(); break;
    case 'chat-open': { const k = A.hubKey, sid = k.split(':')[0]; A.server = sid; A.channel = k.slice(sid.length + 1); A.search = ''; A.view = 'server'; A.panel = null; reset(); render({ scroll: true }); return; }
    case 'hubchat': A.hubKey = el.dataset.key; reset(); render({ scroll: true }); return;
    case 'mprev': A.track = (A.track + TRACKS.length - 1) % TRACKS.length; A.prog = 0; break;
    case 'mnext': A.track = (A.track + 1) % TRACKS.length; A.prog = 0; break;
    case 'mtrack': A.track = Number(el.dataset.i) || 0; A.prog = 0; A.playing = true; break;
    case 'panel': A.panel = A.panel === el.dataset.k ? null : el.dataset.k; break;
    case 'toast-soon': toast('Isso chega em breve'); return;
    case 'toast-pin': toast('Fixar festas chega em breve'); return;
    case 'toast-friend': toast('Adicionar amigos chega em breve'); return;
    case 'toast-edit': toast('Editar perfil chega em breve'); return;
    case 'toast-server': toast('Criar servidor chega em breve'); return;
    case 'toast-channel': toast('Criar canais chega em breve'); return;
    case 'toast-attach': toast('Anexos chegam em breve'); return;
    case 'toast-gift': toast('Presentes chegam em breve'); return;
    case 'toast-gif': toast('GIFs chegam em breve'); return;
    default: return;
  }
  render({ scroll: act === 'srv' || act === 'chan' || act === 'dm' });
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
    if (t.dataset.appBind === 'search') { A.search = t.value; const l = document.getElementById('mlist'); if (l) l.innerHTML = membersListHTML(); }
    else if (t.dataset.appBind === 'gq') { A.gq = t.value; A.search = t.value; refilter(); }
    else if (t.dataset.appBind === 'hdraft') { A.hdraft = t.value; const b = document.getElementById('hsend'); if (b) b.hidden = !A.hdraft.trim(); }
    else { A.draft = t.value; const b = document.getElementById('send-btn'); if (b) b.hidden = !A.draft.trim(); }
    return;
  }
  const b = t.dataset.bind;
  if (!b || t.type === 'checkbox' || t.tagName === 'SELECT') return;
  setPath(b, t.value); onBound(b, t);
});
$root.addEventListener('change', (e) => {
  const t = e.target, b = t.dataset.bind;
  if (!b) return;
  if (t.type === 'checkbox') setPath(b, t.checked);
  else if (t.tagName === 'SELECT') { setPath(b, t.value); if (S.r.touched) render(); }
});
$root.addEventListener('keydown', (e) => {
  if (e.target.id === 'msg' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); appSend(); }
  if (e.target.id === 'hmsg' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); hubSend(); }
});
document.addEventListener('keydown', (e) => {
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
