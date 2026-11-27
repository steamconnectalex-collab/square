(() => {
'use strict';

/* =====================================================================
   Shiqi. — site real: acesso à conta (cadastro com código, login, QR Code,
   recuperação de senha) + tela principal.
   Backend: Supabase Edge Function "auth" + Supabase Auth/PostgREST.
   ===================================================================== */

const C = window.SQ_CONFIG;
const BRAND = 'Shiqi';
const $root = document.getElementById('root');

/* ---------------------------------------------------------------- util */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
const userOk = (v) => /^[A-Za-z0-9._]{3,20}$/.test(String(v).trim());
const normCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
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
  toast.t = setTimeout(() => { el.innerHTML = ''; }, Math.max(2400, (window.SQ_SET ? Number(window.SQ_SET.P('notif_ms')) || 3 : 3) * 1000));
}

/* --------------------------------------------------------------- icons */
const ic = (d, s = 18, c = '#55555F', w = 1.7) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const D = {
  bubble: '<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3.5 7.5 8.5 6 8.5-6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  micOff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/>',
  head: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  leave: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
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
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  userPlus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6 1.4 0 2.6.3 3.7.9M18 14v6M15 17h6"/>',
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
  lId: '', lPw: '', lShow: false, lTouched: false, lErr: '', lBusy: false, lMfa: false, lCode: '', lRecUse: false, lTotp: false,
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
  S.lId = ''; S.lPw = ''; S.lTouched = false; S.lErr = ''; S.lMfa = false; S.lCode = ''; S.lRecUse = false; S.lTotp = false;
  go('login');
  if (tok) fetch(C.SUPABASE_URL + '/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: C.SUPABASE_KEY, authorization: 'Bearer ' + tok } }).catch(() => {});
}
const displayName = () => (S.profile && S.profile.display_name) || (S.session && S.session.user && S.session.user.email ? S.session.user.email.split('@')[0] : 'Você');

async function onSignedIn(d) {
  saveSession(d);
  S.lPw = ''; S.lBusy = false; S.lErr = ''; S.lMfa = false; S.lCode = ''; S.lRecUse = false; S.lTotp = false;
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
  ['msgs', 'sscroll', 'mlist', 'flist', 'lj'].forEach((id) => { const el = document.getElementById(id); if (el) snap.scroll[id] = el.scrollTop; });
  const views = { home: homeView, login: loginView, register: registerView, verify: verifyView, forgot: forgotView, forgotSent: forgotSentView, newPass: newPassView, passDone: passDoneView, approve: approveView, app: appView };
  $root.innerHTML = (views[S.view] || loginView)();
  if (o.top) window.scrollTo(0, 0);
  Object.keys(snap.scroll).forEach((id) => { const el = document.getElementById(id); if (el) el.scrollTop = snap.scroll[id]; });
  if (o.scroll) { ['msgs'].forEach((id) => { const el = document.getElementById(id); if (el) el.scrollTop = el.scrollHeight; }); }
  if (snap.id && !o.top) {
    const el = document.getElementById(snap.id);
    if (el) { el.focus(); if (snap.s && el.setSelectionRange) { try { el.setSelectionRange(snap.s[0], snap.s[1]); } catch (e) { /* tipo sem seleção */ } } }
  }
  if (S.view === 'app' && A && A.world === 'ready') { saveNav(); ensureThread(curKey()); }
  if (S.view === 'app' && A) updateTyping();
  if (S.view === 'app' && VC) attachVideos();
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
  if (S.lTotp) return loginTotpView();
  const idBad = S.lTouched && !S.lId.trim();
  const pwBad = S.lTouched && !S.lPw;
  return shell(`<section class="card" aria-labelledby="t-login">
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
  ${S.lMfa ? `<div class="field">
    <label class="lbl" for="login-code">${S.lRecUse ? 'Código de recuperação' : 'Código do aplicativo de autenticação'} <span class="req" aria-hidden="true">*</span></label>
    <input id="login-code" class="inp" type="text" inputmode="${S.lRecUse ? 'text' : 'numeric'}" data-bind="lCode" value="${esc(S.lCode)}" maxlength="${S.lRecUse ? 12 : 8}" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" data-autofocus>
    <small class="hint">${S.lRecUse ? 'Usar um código de recuperação desliga a verificação em duas etapas da sua conta.' : 'Abra o aplicativo de autenticação e digite o código de 6 números.'}</small>
    <button type="button" class="lnk sl" data-act="login-rec">${S.lRecUse ? 'Usar o código do aplicativo' : 'Usar um código de recuperação'}</button>
  </div>` : ''}
  ${alertBox(S.lErr)}
  ${submitBtn(S.lBusy, 'Entrar', 'Entrando…')}
  <div class="small">Precisando de uma conta? <button type="button" class="lnk" data-act="to-register">Registre-se</button></div>
  <button type="button" class="altlogin" data-act="to-totp">${ic(D.shield || '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="m9 12 2 2 4-4"/>', 16, 'currentColor', 1.8)}<span>Entrar com o código do autenticador</span></button>
</form>
</section>`);
}

/* ----- entrar só com o código do aplicativo de autenticação (quem já ligou a verificação em duas etapas) ----- */
function loginTotpView() {
  const idBad = S.lTouched && !S.lId.trim();
  const cBad = S.lTouched && S.lCode.replace(/\D/g, '').length !== 6;
  return shell(`<section class="card" aria-labelledby="t-totp">
<form class="stack grow" data-form="logintotp" novalidate>
  <div class="center"><h1 id="t-totp" class="ttl big">Entrar com o autenticador</h1><p class="lead">Use o código de 6 números do Google Authenticator (ou do aplicativo que você configurou). Funciona só para contas que já ligaram a verificação em duas etapas.</p></div>
  <div class="field">
    <label class="lbl" for="login-id">E-mail ou nome de usuário <span class="req" aria-hidden="true">*</span></label>
    <input id="login-id" class="inp${idBad ? ' bad' : ''}" type="text" data-bind="lId" value="${esc(S.lId)}" autocomplete="username" autocapitalize="none" spellcheck="false" data-autofocus aria-invalid="${idBad}">
    ${idBad ? '<div class="err" role="alert">Informe seu e-mail ou nome de usuário.</div>' : ''}
  </div>
  <div class="field">
    <label class="lbl" for="login-code">Código do aplicativo <span class="req" aria-hidden="true">*</span></label>
    <input id="login-code" class="inp${cBad ? ' bad' : ''}" type="text" inputmode="numeric" data-bind="lCode" value="${esc(S.lCode)}" maxlength="8" autocomplete="one-time-code" spellcheck="false" aria-invalid="${cBad}">
    ${cBad ? '<div class="err" role="alert">Digite os 6 números do código.</div>' : ''}
  </div>
  ${alertBox(S.lErr)}
  ${submitBtn(S.lBusy, 'Entrar', 'Entrando…')}
  <button type="button" class="lnk sc" data-act="to-pw">Voltar para e-mail e senha</button>
</form>
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
  if (a.state === 'loading') inner = '<div role="status" aria-busy="true" aria-label="Carregando" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0"><i class="sk c" style="width:56px;height:56px"></i><i class="sk" style="height:16px;width:220px"></i><i class="sk" style="height:11px;width:260px"></i><i class="sk" style="height:11px;width:200px"></i><i class="sk p" style="height:44px;width:100%;margin-top:10px"></i></div>';
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
  if (q.state === 'loading') inner = '<i class="sk" role="status" aria-label="Gerando código" style="width:100%;height:100%;border-radius:14px"></i>';
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
async function doLoginTotp() {
  S.lTouched = true;
  const code = S.lCode.replace(/\D/g, '');
  if (!S.lId.trim() || code.length !== 6) { render(); return; }
  S.lBusy = true; S.lErr = ''; render();
  try {
    const d = await api('/login/totp', { identifier: S.lId.trim(), code });
    S.lTotp = false; S.lCode = '';
    await onSignedIn(d);
  } catch (e) {
    S.lBusy = false; S.lErr = e.message || 'Não foi possível entrar agora.';
    if (S.view === 'login') render();
  }
}
async function doLogin() {
  S.lTouched = true;
  if (!S.lId.trim() || !S.lPw) { render(); return; }
  S.lBusy = true; S.lErr = ''; render();
  try {
    if (S.lMfa && !S.lCode.trim()) { S.lBusy = false; S.lErr = 'Digite o código para continuar.'; render(); return; }
    const body = { identifier: S.lId.trim(), password: S.lPw };
    if (S.lMfa) body[S.lRecUse ? 'recovery_code' : 'code'] = S.lCode.trim();
    const d = await api('/login', body);
    if (d.mfa_required) { S.lMfa = true; S.lBusy = false; S.lErr = ''; render(); return; }
    await onSignedIn(d);
    if (d.mfa_disabled) setTimeout(() => toast('A verificação em duas etapas foi desligada. Ligue de novo em Configurações > Conta.'), 600);
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
    const m = { email_taken: 'email', invalid_email: 'email', username_taken: 'user', invalid_username: 'user', weak_password: 'pass', pwned_password: 'pass', invalid_birth_date: 'dob', too_young: 'dob', terms_required: 'terms' }[e.error];
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
    if (d.mfa_required) { S.n = freshN(); S.lMfa = false; S.lErr = 'Senha alterada! Entre com a senha nova e o código do aplicativo de autenticação.'; go('login'); return; }
    saveSession(d);
    S.n = freshN();
    go('done');
  } catch (e) { n.busy = false; n.err = e.message; if (S.view === 'newPass') render(); }
}

/* =====================================================================
   TELA PRINCIPAL — dados reais do Supabase (servidores, canais, mensagens e perfis).
   Ainda de demonstração: jogos, notícias, amigos/DM, voz.
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
const STICKERS = [['🐱', 'gato'], ['🐶', 'cachorro'], ['🦊', 'raposa'], ['🐼', 'panda'], ['🐸', 'sapo'], ['🦄', 'unicórnio'], ['🐙', 'polvo'], ['🦖', 'dinossauro'], ['🍕', 'pizza'], ['🍩', 'rosquinha'], ['🍉', 'melancia'], ['☕', 'café'], ['🎸', 'guitarra'], ['🚀', 'foguete'], ['🌈', 'arco-íris'], ['⭐', 'estrela'], ['💜', 'coração roxo'], ['🔥', 'fogo'], ['👋', 'oi'], ['🎉', 'festa'], ['😎', 'legal'], ['🥳', 'comemorando'], ['😴', 'dormindo'], ['🤯', 'mente explodindo']];
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
  syncSend: () => { if (typeof syncSend === 'function') syncSend(); },
  voiceApply: () => { if (typeof voiceApply === 'function') voiceApply(); },
  rpc, sb, toast, displayName, logout: () => logout(),
  me: () => (A && A.me) || null,
  email: () => (S.session && S.session.user && S.session.user.email) || '',
  plan: () => (A && A.plan) || 'free',
  servers: () => SERVERS,
  unread: () => (A && A.unread ? Object.keys(A.unread).filter((k) => A.unread[k]).length : 0),
  reload: () => { if (A && S.view === 'app') loadWorld(); },
  setEmail: (e) => { if (S.session) { S.session.user = Object.assign({}, S.session.user, { email: e }); store.set('sq.session', S.session); } },
  fn: async (path, body) => { const t = await freshToken(); return api(path, body || {}, t); },
  authFetch: async (path, o = {}) => {
    const t = await freshToken();
    return fetch(C.SUPABASE_URL + path, { method: o.method || 'GET', headers: { apikey: C.SUPABASE_KEY, authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
  },
  editProfile: () => { if (window.SQ_PERFIL) window.SQ_PERFIL.open(); },
  esc, ic, D,
  render: () => { if (A && S.view === 'app') render(); },
  go: (v) => { if (A) { A.view = v; A.panel = null; A.modal = null; A.drawer = false; render(); } },
  saveProfile: async (f) => { await sb('/rest/v1/profiles?id=eq.' + myId(), { method: 'PATCH', body: f }); await loadWorld(() => {}); },
  uploadAvatar: async (blob) => {
    const old = (A && A.me && A.me.avatar) || '', path = myId() + '/' + Date.now() + '.jpg';
    await storageCall('POST', path, blob, 'image/jpeg');
    await sb('/rest/v1/profiles?id=eq.' + myId(), { method: 'PATCH', body: { avatar_path: path } });
    if (old) storageCall('DELETE', old).catch(() => {});
    await loadWorld(() => {});
  },
  removeAvatar: async () => {
    const old = (A && A.me && A.me.avatar) || ''; if (!old) return;
    await sb('/rest/v1/profiles?id=eq.' + myId(), { method: 'PATCH', body: { avatar_path: null } });
    storageCall('DELETE', old).catch(() => {});
    await loadWorld(() => {});
  },
  accents: ACCENTS, avatarUrl,
};
const ERRS = {
  not_authenticated: 'Sua sessão expirou. Entre de novo.', network: 'Sem conexão. Verifique sua internet e tente de novo.',
  invalid_name: 'O nome está fora do tamanho permitido.', too_many_servers: 'Você atingiu o limite de servidores.',
  too_many_channels: 'Esse servidor já tem o máximo de canais.', not_owner: 'Só o dono do servidor pode fazer isso.',
  not_member: 'Você não faz parte deste servidor.', user_not_found: 'Não encontramos ninguém com esse @usuário.', requests_closed: 'Esta pessoa não está aceitando pedidos de amizade de você.', rate_limited: 'Calma! Você está enviando mensagens rápido demais. Espere alguns segundos.', banned: 'Você foi banido deste servidor.', cannot_remove_self: 'Você não pode fazer isso com você mesmo.', voice_full: 'A sala de voz está cheia (máximo de 10 pessoas).', not_member: 'Você não faz parte deste servidor.', you_blocked: 'Você bloqueou essa pessoa. Desbloqueie para adicioná-la.', cannot_add_self: 'Você não pode adicionar a si mesmo.',
  too_many_requests: 'Você já tem pedidos demais esperando resposta.', no_request: 'Esse pedido não existe mais.', not_friends: 'Vocês ainda não são amigos.', not_owner: 'Só o dono do servidor faz isso.', past_date: 'A data do evento precisa ser no futuro.', too_many_events: 'Este servidor já tem eventos demais marcados.', invalid_thread: 'Não dá para responder a essa mensagem.', dm_closed: 'Esta pessoa não está aceitando mensagens diretas de você.', invalid_invite: 'Convite inválido ou expirado.',
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
const FIELDS = 'id,author_id,content,created_at,edited_at,attachment_path,attachment_alt,thread_of';
const mapMsg = (r) => ({ id: r.id, from: r.author_id, text: r.content, at: r.created_at, edited: !!r.edited_at, img: r.attachment_path || '', alt: r.attachment_alt || '', thread: r.thread_of || null });
const attUrl = (path) => C.SUPABASE_URL + '/storage/v1/object/public/attachments/' + path.split('/').map(encodeURIComponent).join('/');
const mentionsMe = (text) => { const u = A && A.me && A.me.user; return !!u && new RegExp('(^|[^a-z0-9_])@' + u.replace(/[^a-z0-9_.]/gi, '') + '(?![a-z0-9_])', 'i').test(text || ''); };
/* filtro de spam (regra simples): 2+ links ou link encurtado; "all" vale para todos, "unknown" só para quem não é amigo */
function isSpam(m) {
  const lvl = window.SQ_SET ? window.SQ_SET.P('spam') : 'unknown';
  if (lvl === 'none' || !m || m.from === myId() || (A.spamOk && A.spamOk[m.id])) return false;
  if (lvl === 'unknown' && relOf(m.from) === 'friend') return false;
  const t = String(m.text || ''), links = t.match(/https?:\/\/\S+|www\.\S+/gi) || [];
  return links.length >= 2 || /(?:bit\.ly|tinyurl\.com|cutt\.ly|is\.gd|t\.co)\//i.test(t);
}
function msgBody(m) {
  if (/^::sticker::/.test(m.text || '')) { const st = SPV('stickers', 'always'); return `<span class="stk ${st === 'never' ? 'still' : st === 'hover' ? 'hv' : 'an'}" role="img" aria-label="Figurinha">${esc(m.text.slice(11))}</span>`; }
  if (isSpam(m)) return `<span class="spamn">Mensagem filtrada como possível spam. <button type="button" class="lnk" data-act="spam-show" data-id="${esc(String(m.id))}">Mostrar mesmo assim</button></span>`;
  const me = A && A.me && A.me.user ? A.me.user.toLowerCase() : '';
  let t = m.img && m.text === '📷 Imagem' ? '' : esc(m.text);
  const SPV2 = (k) => (window.SQ_SET ? window.SQ_SET.P(k) : undefined);
  // links clicáveis (só http/https) e, se ligado, um selo com o endereço do site
  t = t.replace(/(https?:\/\/[^\s<]+)/g, (u) => { let host = ''; try { host = new URL(u.replace(/&amp;/g, '&')).hostname.replace(/^www\./, ''); } catch (e) { return u; } return `<a class="lk" href="${u}" target="_blank" rel="noopener noreferrer nofollow">${u}</a>${SPV2('msg_links') !== false && SPV2('msg_attach') !== false ? `<span class="lkchip" title="${esc(host)}">🔗 ${esc(host)}</span>` : ''}`; });
  // spoiler: ||texto|| — mostra ao clicar, ou sempre (ou se você é dono do servidor, no modo "Em servidores que modero")
  const spMode = SPV2('spoilers'), srvNow = curServer(), iMod = !!(srvNow && srvNow.owner === myId()) && spMode === 'mod';
  t = t.replace(/\|\|([^|]{1,500}?)\|\|/g, (x, a) => (spMode === 'always' || iMod ? `<span class="spoiler open">${a}</span>` : `<button type="button" class="spoiler" data-act="spoiler" aria-label="Spoiler: clique para mostrar">${a}</button>`));
  t = t.replace(/(^|[\s(])@([a-zA-Z0-9_]{2,30})/g, (x, a, u) => a + '<span class="mention' + (u.toLowerCase() === me ? ' me' : '') + '">@' + u + '</span>');
  let img = '';
  if (m.img) {
    const u = attUrl(m.img), alt = SPV2('img_desc') && m.alt ? m.alt : 'Imagem enviada';
    const gif = /\.gif(\?|$)/i.test(m.img), still = gif && SPV2('play_gifs') === false;
    img = SPV2('msg_upload') === false
      ? `<button type="button" class="lnk attshow" data-act="att-show" data-src="${esc(u)}" data-alt="${esc(alt)}">Mostrar imagem</button>`
      : `<a class="att${still ? ' gifstill' : ''}" href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="${esc(alt)}" loading="lazy"${still ? ' data-still="1"' : ''}>${still ? '<span class="gifbadge">GIF</span>' : ''}</a>`;
    if (SPV2('img_desc') && m.alt) img += `<small class="altd">${esc(m.alt)}</small>`;
  }
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
    id: uid, upd: (p && p.profile_updated_at) || '', name, user: (p && p.username) || '', bio: (p && p.bio) || '', status, accent: (p && p.accent) || '#9D8CCF',
    since: (p && p.created_at) || '', role: role || '', me, on, presence: me ? pres : (on ? pres : 'off'), st: on ? (pres === 'idle' ? 'Ausente' : pres === 'dnd' ? 'Não perturbe' : (status || 'Online')) : 'Offline',
    avatar: av, g: avBg(av, me ? G.lilac : gradFor(uid)), ini: av ? '' : name.charAt(0).toUpperCase()
  };
}

function initApp() {
  const uid = myId();
  if (A && A.owner === uid) { startLive(); openJoin(); return; }
  SERVERS = [];
  A = {
    owner: uid, world: 'loading', werr: '', me: null, server: null, channel: null, voice: null, vpage: null, vst: {}, vfxOpen: false, muted: false, deafened: false,
    panel: null, showMembers: true, onlineOpen: true, offlineOpen: true, draft: '', search: '', emojiOpen: false, menu: false,
    view: 'friends', ftab: 'all', af: { user: '', note: '', busy: false }, pop: null, drawer: false, csec: { text: false, voice: false }, devs: null, plan: 'free', gq: '', entered: false,
    threads: {}, rx: {}, tc: {}, rxPick: null, loaded: {}, loading: {}, more: {}, terr: {}, modal: null, poll: null, beat: null, tt: null, typing: {}, pollN: 0, friends: [], incoming: [], outgoing: [], known: {}, dmByUser: {}, dmUser: {}, blocked: new Set(), unread: {}, vrost: {}
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
  A.rxT = setInterval(() => { if (!document.hidden) loadRx(curKey()); loadTc(curKey()); }, 4000);
  rtStart();
  beat(true);
}
function stopAppTimers() { voiceLeave(true); if (A) { clearInterval(A.poll); clearInterval(A.beat); clearInterval(A.tt); clearInterval(A.rxT); A.poll = A.beat = A.tt = A.rxT = null; } rtStop(false); }

const srvIni = (n) => { const w = String(n || '').trim().split(/\s+/).filter(Boolean); return (w.length ? w.map((x) => Array.from(x)[0]).slice(0, 3).join('') : '?'); };
const favList = () => { try { return JSON.parse(localStorage.getItem('sq.favsrv.' + myId()) || '[]') || []; } catch (e) { return []; } };
const favSrv = (id) => favList().includes(id);
const railServers = () => (SPV('fav_servers', false) ? SERVERS.slice().sort((a, b) => Number(favSrv(b.id)) - Number(favSrv(a.id))) : SERVERS);
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
    const [srv, chs, mem, fr, dmc, dmm, blk] = await Promise.all([
      sb('/rest/v1/servers?select=id,name,owner_id,created_at,is_public&order=created_at.asc'),
      sb('/rest/v1/channels?select=id,server_id,name,kind,position&server_id=not.is.null&order=position.asc'),
      sb('/rest/v1/server_members?select=server_id,user_id,role'),
      sb('/rest/v1/friendships?select=user_a,user_b,requester,status,note,created_at'),
      sb('/rest/v1/channels?select=id&kind=eq.dm'),
      sb('/rest/v1/dm_members?select=channel_id,user_id,state'),
      sb('/rest/v1/blocks?select=blocked')
    ]);
    const other = (f) => (f.user_a === myId() ? f.user_b : f.user_a);
    const ids = Array.from(new Set(mem.map((m) => m.user_id).concat(fr.map(other), blk.map((b) => b.blocked), dmm.map((m) => m.user_id), [myId()])));
    const [profsBase, profsFull] = await Promise.all([
      sb('/rest/v1/profiles?select=id,username,display_name,avatar_path,last_seen,presence,deactivated_at,profile_updated_at&id=in.(' + ids.join(',') + ')'),
      sb('/rest/v1/rpc/profiles_full', { method: 'POST', body: { p_ids: ids.slice(0, 200) } }).catch(() => [])
    ]);
    const fullBy = {}; (profsFull || []).forEach((x) => { fullBy[x.id] = x; });
    const profs = profsBase.map((p) => Object.assign({ bio: '', status_text: '', accent: '#9D8CCF', created_at: null }, p, fullBy[p.id] || {}));
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
    const fsince = {}; fr.forEach((f) => { fsince[other(f)] = f.created_at || ''; });
    w.friends = fr.filter((f) => f.status === 'accepted').map((f) => known[other(f)]).filter(Boolean).map((p) => Object.assign({}, p, { dm: dmByUser[p.id] || '', fsince: fsince[p.id] || '' })).sort(byName);
    const isFr = new Set(w.friends.map((f) => f.id));
    w.dmReq = []; w.dmOther = [];
    dmc.forEach((c) => {
      const mine = dmm.find((x) => x.channel_id === c.id && x.user_id === myId()), o = dmUser[c.id], pp = o && known[o];
      if (!mine || !pp || isFr.has(o)) return;
      if (mine.state === 'request') w.dmReq.push(Object.assign({}, pp, { dm: c.id })); else w.dmOther.push(Object.assign({}, pp, { dm: c.id }));
    });
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
const NAV_OK = ['friends', 'dm', 'server', 'official', 'plus', 'quests', 'shop'];
function saveNav() {
  if (!A || !A.owner || A.world !== 'ready' || !A.restored) return;
  store.set('sq.nav.' + A.owner, { view: A.view, server: A.server, channel: A.channel });
}
function fixSelection() {
  if (!A.restored) {
    A.restored = true;
    const n = store.get('sq.nav.' + A.owner);
    if (n && NAV_OK.includes(n.view)) { A.view = n.view; A.server = n.server || null; A.channel = n.channel || null; }
  }
  if (A.view === 'dm' && !A.friends.some((f) => f.dm && f.dm === A.channel)) { A.view = 'friends'; A.channel = null; }
  if (A.view === 'server') {
    const s = SERVERS.find((x) => x.id === A.server);
    if (!s) { A.view = 'friends'; A.server = null; A.channel = null; }
    else if (!s.text.some((c) => c.id === A.channel)) A.channel = s.text[0] ? s.text[0].id : null;
  }
}
function selectServer(id) {
  const s = SERVERS.find((x) => x.id === id); if (!s) return;
  A.server = s.id; A.channel = s.text[0] ? s.text[0].id : null; A.view = 'server'; A.panel = null; A.search = ''; A.vpage = null;
}
function friendNotes(prev) {
  if (!A || !A.friends || (A.me && A.me.presence === 'dnd')) return;
  const note = (msg) => { toast(msg); if (window.SQ_SET) window.SQ_SET.notify('friend', msg, ''); };
  A.friends.forEach((f) => {
    const p = prev[f.id]; if (!p) return;
    if (!p.on && f.on && SPV('n_friend_online', true)) note(f.name + ' ficou online');
    if (f.upd && f.upd !== p.upd && SPV('n_friend_profile', true)) note(f.name + ' atualizou o perfil');
  });
  if (SPV('n_anniv', true)) {
    const today = new Date(), key = 'sq.anniv.' + myId(), day = today.toISOString().slice(0, 10);
    if (store.get(key) === day) return;
    const hit = A.friends.filter((f) => { const d = f.fsince && new Date(f.fsince); return d && !isNaN(d) && d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear(); });
    if (hit.length) { store.set(key, day); const y = today.getFullYear() - new Date(hit[0].fsince).getFullYear(); note('Você e ' + hit[0].name + ' fazem ' + y + (y === 1 ? ' ano' : ' anos') + ' de amizade hoje!'); }
  }
}
const evSeen = new Set();
async function eventNotes() {
  if (!SPV('n_event', true) || (A && A.me && A.me.presence === 'dnd')) return;
  try {
    const now = Date.now(), evs = await sb('/rest/v1/server_events?select=id,title,starts_at&starts_at=gte.' + encodeURIComponent(new Date(now - 60000).toISOString()) + '&starts_at=lte.' + encodeURIComponent(new Date(now + 900000).toISOString()));
    const mine = evs.length ? await sb('/rest/v1/event_interest?select=event_id&user_id=eq.' + myId() + '&event_id=in.(' + evs.map((e) => e.id).join(',') + ')') : [];
    mine.forEach((i) => {
      if (evSeen.has(i.event_id)) return; evSeen.add(i.event_id);
      const e = evs.find((x) => x.id === i.event_id); if (!e) return;
      const msg = 'O evento "' + e.title + '" começa em breve';
      toast(msg); if (window.SQ_SET) window.SQ_SET.notify('event', msg, '');
    });
  } catch (e) { /* tenta no próximo ciclo */ }
}
async function beat(first) {
  if (S.view !== 'app' || !A || document.hidden) return;
  const w = A;
  try {
    await sb('/rest/v1/profiles?id=eq.' + myId(), { method: 'PATCH', body: { last_seen: new Date().toISOString() } });
    presenceExpire();
    if (!first && A === w && w.world === 'ready') {
      const prev = {}; (w.friends || []).forEach((f) => { prev[f.id] = { on: f.on, upd: f.upd }; });
      await loadWorld(refilter);
      if (A === w) { friendNotes(prev); eventNotes(); }
    }
  } catch (e) { /* tenta de novo no próximo ciclo */ }
}

/* ------------------------------------------------------------ mensagens */
async function ensureThread(key) {
  if (!key || A.loaded[key] || A.loading[key] || A.terr[key]) return;
  const w = A; A.loading[key] = 1;
  try {
    const rows = await sb(`/rest/v1/messages?select=${FIELDS}&channel_id=eq.${key}&thread_of=is.null&order=id.desc&limit=50`);
    if (A !== w) return;
    w.more[key] = rows.length === 50;
    w.threads[key] = rows.reverse().map(mapMsg);
    w.loaded[key] = 1;
  } catch (e) { if (A === w) w.terr[key] = 1; }
  finally { if (A === w) w.loading[key] = 0; }
  if (A === w && S.view === 'app' && curKey() === key) { const had = A.unread[key]; paintMsgs(true); markCur(); if (had && !A.unread[key]) render(); }
}
/* "Reproduzir GIFs" desligado: mostra só o primeiro quadro (o clique abre o GIF) */
function freezeGifs(root) {
  root.querySelectorAll('img[data-still]').forEach((im) => {
    const go = () => { try { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); c.className = im.className; c.setAttribute('role', 'img'); c.setAttribute('aria-label', im.alt || 'GIF'); im.replaceWith(c); } catch (e) { /* mantém animado */ } };
    if (im.complete && im.naturalWidth) go(); else im.addEventListener('load', go, { once: true });
  });
}
/* ----- reações ----- */
async function loadRx(key) {
  if (!A || !key || !A.loaded[key] || A.rxBusy || !SPV('msg_react', true)) return;
  const ids = (A.threads[key] || []).slice(-100).map((m) => m.id); if (!ids.length) return;
  const w = A; A.rxBusy = true;
  try {
    const rows = await sb('/rest/v1/message_reactions?select=message_id,user_id,emoji&message_id=in.(' + ids.join(',') + ')');
    if (A !== w) return;
    const by = {}; rows.forEach((r) => { ((by[r.message_id] = by[r.message_id] || {})[r.emoji] = (by[r.message_id][r.emoji] || [])).push(r.user_id); });
    const before = JSON.stringify(ids.map((i) => w.rx[i] || null));
    ids.forEach((i) => { if (by[i]) w.rx[i] = by[i]; else delete w.rx[i]; });
    if (before !== JSON.stringify(ids.map((i) => w.rx[i] || null)) && curKey() === key) paintMsgs('keep');
  } catch (e) { /* tenta de novo */ }
  finally { if (A === w) w.rxBusy = false; }
}
function rxHTML(m) {
  if (!SPV('msg_react', true)) return '';
  const r = A.rx[m.id] || {}, me = myId();
  const chips = Object.keys(r).map((e) => { const on = r[e].includes(me); return `<button type="button" class="rxc${on ? ' on' : ''}" data-act="rx" data-id="${m.id}" data-e="${esc(e)}" aria-pressed="${on}" aria-label="${esc(e)} ${r[e].length} ${r[e].length === 1 ? 'reação' : 'reações'}">${esc(e)} <b>${r[e].length}</b></button>`; }).join('');
  const pick = A.rxPick === m.id ? `<span class="rxp" role="group" aria-label="Escolher reação">${EMOJIS.map((e) => `<button type="button" class="hov" data-act="rx" data-id="${m.id}" data-e="${e[0]}" aria-label="Reagir com ${e[1]}">${e[0]}</button>`).join('')}</span>` : '';
  return chips || pick ? `<div class="rxs">${chips}${pick}</div>` : '';
}
async function toggleRx(id, emoji) {
  const key = curKey(), w = A;
  A.rxPick = null;
  const cur = A.rx[id] = A.rx[id] || {}, me = myId(), list = cur[emoji] || [];
  const was = list.includes(me);
  if (was) { cur[emoji] = list.filter((u) => u !== me); if (!cur[emoji].length) delete cur[emoji]; } else cur[emoji] = list.concat(me);
  if (!Object.keys(cur).length) delete A.rx[id];
  paintMsgs('keep');
  try { await rpc('toggle_reaction', { p_message: Number(id), p_emoji: emoji }); }
  catch (e) { if (A === w) { toast(errText(e)); } }
  if (A === w) loadRx(key);
}
/* ----- tópicos (respostas em fio) ----- */
async function loadTc(key) {
  if (!A || !key || !A.loaded[key] || A.tcBusy) return;
  const ids = (A.threads[key] || []).slice(-100).map((m) => m.id); if (!ids.length) return;
  const w = A; A.tcBusy = true;
  try {
    const rows = await sb('/rest/v1/messages?select=thread_of&thread_of=in.(' + ids.join(',') + ')&limit=1000');
    if (A !== w) return;
    const cnt = {}; rows.forEach((r) => { cnt[r.thread_of] = (cnt[r.thread_of] || 0) + 1; });
    const before = JSON.stringify(ids.map((i) => w.tc[i] || 0)); ids.forEach((i) => { if (cnt[i]) w.tc[i] = cnt[i]; else delete w.tc[i]; });
    if (before !== JSON.stringify(ids.map((i) => w.tc[i] || 0)) && curKey() === key) paintMsgs('keep');
  } catch (e) { /* tenta de novo */ }
  finally { if (A === w) w.tcBusy = false; }
}
function threadListHTML(m) {
  if (m.items == null) return skWrap(skRows(2, 40), 'Carregando');
  if (!m.items.length) return '<p class="mnote">Ainda não há respostas. Escreva a primeira.</p>';
  const srv = curServer(), key = m.key;
  return m.items.filter((x) => !A.blocked.has(x.from)).map((x) => {
    const p = x.from === myId() ? null : srv ? srv.byId[x.from] : dmPeer(key), nm = x.from === myId() ? 'Você' : p ? p.name : 'Ex-membro';
    return `<div class="thr"><b>${esc(nm)}</b> <small>${esc(msgTime(x.at))}</small><div>${msgBody(x)}</div></div>`;
  }).join('');
}
async function loadReplies(m) {
  try {
    const rows = await sb('/rest/v1/messages?select=' + FIELDS + '&thread_of=eq.' + m.parent.id + '&order=id.asc&limit=200');
    if (A.modal !== m) return;
    const old = m.items ? m.items.length : -1; m.items = rows.map(mapMsg);
    const l = document.getElementById('thlist');
    if (l && old !== -1) { const down = l.scrollHeight - l.scrollTop - l.clientHeight < 40; l.innerHTML = threadListHTML(m); if (down) l.scrollTop = l.scrollHeight; } else render();
  } catch (e) { if (A.modal === m && m.items == null) { m.items = []; m.err = errText(e); render(); } }
}
function openThread(id) {
  const key = curKey(), par = (A.threads[key] || []).find((x) => String(x.id) === String(id)); if (!par) return;
  const m = A.modal = { type: 'thread', key, parent: par, items: null, reply: '', err: '', busy: false };
  render(); loadReplies(m);
  const iv = setInterval(() => { if (A.modal !== m) return clearInterval(iv); if (!document.hidden) loadReplies(m); }, 3000);
}
function paintMsgs(stick) {
  const el = document.getElementById('msgs'); if (!el) return;
  const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  el.innerHTML = serverMsgsHTML();
  freezeGifs(el);
  if (stick === true || (stick !== 'keep' && near)) el.scrollTop = el.scrollHeight;
}
async function pollTick(force) {
  if (S.view !== 'app' || !A || document.hidden || A.world !== 'ready' || A.polling) return;
  if (RT.ok && force !== true && ++A.pollN % 10 !== 0) return;
  const key = curKey(); if (!key || !A.loaded[key]) return;
  const th = A.threads[key], last = th.length ? th[th.length - 1].id : 0;
  const w = A; A.polling = true;
  try {
    const rows = await sb(`/rest/v1/messages?select=${FIELDS}&channel_id=eq.${key}&thread_of=is.null&id=gt.${last}&order=id.asc&limit=100`);
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
    const rows = await sb(`/rest/v1/messages?select=${FIELDS}&channel_id=eq.${key}&thread_of=is.null&id=lt.${th[0].id}&order=id.desc&limit=50`);
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
const isDesk = () => window.matchMedia('(min-width:901px)').matches;
const vclock = () => { const t = VC && VC.t0 ? Math.floor((Date.now() - VC.t0) / 1000) : 0; return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
let VC = null; // { ch, stream, peers: { uid: { pc, audio, queue } }, ping }
const vsend = (event, payload) => { if (VC) rtSend(VTOP(VC.ch), 'broadcast', { type: 'broadcast', event, payload: Object.assign({ from: myId() }, payload) }); };
const voiceRoster = (ch) => ((A && A.vrost[ch]) || []);
async function loadVoice() {
  const w = A; if (!w) return;
  try {
    const rows = await sb('/rest/v1/voice_members?select=channel_id,user_id,seen_at,muted,deafened,video,screen');
    if (A !== w) return;
    const lim = Date.now() - 45000, r = {}, st = {};
    rows.forEach((x) => { if (new Date(x.seen_at).getTime() >= lim) { (r[x.channel_id] = r[x.channel_id] || []).push(x.user_id); st[x.user_id] = { m: !!x.muted || !!x.deafened, d: !!x.deafened, v: !!x.video, s: !!x.screen }; } });
    A.vrost = r; A.vst = st;
    if (S.view === 'app' && A.world === 'ready') render();
  } catch (e) { /* sem lista de voz */ }
}
function voiceApply() {
  if (!VC) return;
  const off = A.muted || A.deafened;
  const ptt = !!(window.SQ_SET && window.SQ_SET.P('ptt'));
  VC.stream.getAudioTracks().forEach((t) => { t.enabled = !off && (!ptt || !!A.pttDown); });
  Object.keys(VC.peers).forEach((u) => { if (VC.peers[u].audio) VC.peers[u].audio.muted = !!A.deafened; });
}
/* sensibilidade do microfone: só transmite quando o volume passa do limite (Personalizado = controle seu; Isolamento = limite fixo; Estúdio = sempre aberto) */
let VCG = null;
function vadTick() {
  if (!VCG || !VC) return;
  const prof = SPV('input_profile', 'custom'); let thr = 0;
  if (prof === 'custom') thr = 0.003 + ((100 - Number(SPV('sens', 40))) / 100) * 0.07; else if (prof === 'isolation') thr = 0.02;
  VCG.an.getByteTimeDomainData(VCG.buf);
  let sum = 0; for (let i = 0; i < VCG.buf.length; i++) { const v = (VCG.buf[i] - 128) / 128; sum += v * v; }
  const rms = Math.sqrt(sum / VCG.buf.length), now = Date.now(), hold = SPV('adv_vad', true) ? 700 : 250;
  if (!thr || rms >= thr) VCG.hold = now + hold;
  VCG.gate.gain.value = now <= VCG.hold ? 1 : 0;
}
async function voiceJoin(ch) {
  if (VC && VC.ch === ch) return;
  if (VC && SPV('warn_switch', true) && !window.confirm('Você já está em um canal de voz. Sair dele e entrar neste?')) return;
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
    const dest = ctx.createMediaStreamDestination(), gate = ctx.createGain(), an = ctx.createAnalyser(); an.fftSize = 512;
    src.connect(gain); gain.connect(gate); gate.connect(dest); gain.connect(an); stream = dest.stream; VCG = { gate, an, buf: new Uint8Array(an.fftSize), hold: 0 };
  } catch (e) { try { if (ctx) ctx.close(); } catch (e2) { /* ok */ } ctx = null; gain = null; stream = raw; }
  VC = { ch, t0: Date.now(), stream, raw, ctx, gain, vad: VCG ? setInterval(vadTick, 80) : 0, peers: {}, tlast: {}, talkT: setInterval(talkTick, 120), ping: setInterval(() => { rpc('voice_ping', { p_channel: ch }).catch(() => {}); }, 15000) };
  voiceApply();
  if (window.SQ_SET) { window.SQ_SET.fx('join'); window.SQ_SET.entrySound((SERVERS.find((x) => (x.voice || []).some((c) => c.id === ch)) || {}).id); }
  A.voice = ch;
  voiceState();
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
  const pc = new RTCPeerConnection(ICE), peer = { pc, audio: null, queue: [], neg: false, making: false, polite: myId() > uid, vstream: null, vsender: null, an: null, buf: null };
  VC.peers[uid] = peer;
  VC.stream.getTracks().forEach((tr) => pc.addTrack(tr, VC.stream));
  if (VC.vstream) addVideoTrack(peer);
  pc.onicecandidate = (e) => { if (e.candidate) vsend('ice', { to: uid, cand: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
  pc.onnegotiationneeded = async () => {
    if (!peer.neg || !VC) return;
    try { peer.making = true; const o = await pc.createOffer(); if (pc.signalingState !== 'stable') return; await pc.setLocalDescription(o); vsend('offer', { to: uid, sdp: pc.localDescription.sdp }); }
    catch (e) { /* tenta de novo na próxima mudança */ }
    finally { peer.making = false; }
  };
  pc.ontrack = (e) => {
    if (e.track.kind === 'video') { peer.vstream = new MediaStream([e.track]); attachVideos(); return; }
    try { if (VC && VC.ctx) { const src = VC.ctx.createMediaStreamSource(e.streams[0]), an = VC.ctx.createAnalyser(); an.fftSize = 512; src.connect(an); peer.an = an; peer.buf = new Uint8Array(512); } } catch (e2) { /* sem detecção de fala */ }
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
    if (ev === 'hello') { voiceDrop(uid); vsend('hi', { to: uid }); if (myId() < uid) voiceOffer(uid); }
    else if (ev === 'hi') { if (myId() < uid) voiceOffer(uid); }
    else if (ev === 'offer') {
      const peer = VC.peers[uid] || voicePeer(uid);
      const collision = peer.making || peer.pc.signalingState !== 'stable';
      if (collision && !peer.polite) return;
      if (collision) await peer.pc.setLocalDescription({ type: 'rollback' });
      await peer.pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
      const an = await peer.pc.createAnswer(); await peer.pc.setLocalDescription(an);
      vsend('answer', { to: uid, sdp: peer.pc.localDescription.sdp });
      peer.neg = true;
      peer.queue.splice(0).forEach((c) => peer.pc.addIceCandidate(c).catch(() => {}));
    } else if (ev === 'answer') {
      const peer = VC.peers[uid]; if (!peer) return;
      await peer.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
      peer.neg = true;
      peer.queue.splice(0).forEach((c) => peer.pc.addIceCandidate(c).catch(() => {}));
    } else if (ev === 'ice') {
      const peer = VC.peers[uid]; if (!peer || !d.cand) return;
      if (peer.pc.remoteDescription) peer.pc.addIceCandidate(d.cand).catch(() => {}); else peer.queue.push(d.cand);
    } else if (ev === 'sfx') { if (typeof d.id === 'string' && Object.prototype.hasOwnProperty.call(SFX, d.id)) { sfxPlay(d.id); showFx(uid, d.id); } }
    else if (ev === 'bye') voiceDrop(uid);
  } catch (e) { const p = VC && VC.peers[uid]; if (!p || !p.neg) voiceDrop(uid); }
}
/* ---- estado, câmera, tela, quem fala, efeitos ---- */
function voiceState() {
  if (!VC) return;
  rpc('voice_set_state', { p_muted: !!A.muted, p_deafened: !!A.deafened, p_video: !!VC.cam, p_screen: !!VC.scr }).catch(() => {});
}
function addVideoTrack(peer) {
  const tr = VC.vstream && VC.vstream.getVideoTracks()[0]; if (!tr) return;
  try { peer.vsender = peer.pc.addTrack(tr, VC.vstream); } catch (e) { /* já enviando */ }
}
function voiceStopVideo(quiet) {
  if (!VC || !VC.vstream) return;
  VC.vstream.getTracks().forEach((t) => { t.onended = null; t.stop(); });
  Object.keys(VC.peers).forEach((u) => { const p = VC.peers[u]; if (p.vsender) { try { p.pc.removeTrack(p.vsender); } catch (e) { /* ok */ } p.vsender = null; } });
  VC.vstream = null; VC.cam = false; VC.scr = false;
  if (!quiet) { voiceState(); if (S.view === 'app') render(); }
}
function voiceSetVideo(st, kind) {
  voiceStopVideo(true);
  VC.vstream = st; VC.cam = kind === 'cam'; VC.scr = kind === 'scr';
  const tr = st.getVideoTracks()[0]; if (tr) tr.onended = () => { if (VC && VC.vstream === st) voiceStopVideo(); };
  Object.keys(VC.peers).forEach((u) => addVideoTrack(VC.peers[u]));
  voiceState(); render();
}
async function voiceCam() {
  if (!VC) return;
  if (VC.cam) return voiceStopVideo();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast('Este navegador não permite usar a câmera.');
  try { voiceSetVideo(await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }), 'cam'); }
  catch (e) { toast('Não consegui usar a câmera. Libere a câmera para este site no navegador e tente de novo.'); }
}
async function voiceScreen() {
  if (!VC) return;
  if (VC.scr) return voiceStopVideo();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return toast('Este aparelho não permite compartilhar a tela.');
  try { voiceSetVideo(await navigator.mediaDevices.getDisplayMedia({ video: true }), 'scr'); }
  catch (e) { /* a pessoa cancelou */ }
}
function attachVideos() {
  if (!VC) return;
  document.querySelectorAll('video[data-vs]').forEach((v) => {
    const u = v.dataset.vs, st = u === myId() ? VC.vstream : (VC.peers[u] && VC.peers[u].vstream);
    if (st && v.srcObject !== st) { v.srcObject = st; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
  });
}
const rmsOf = (an, buf) => { an.getByteTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; } return Math.sqrt(sum / buf.length); };
function talkTick() {
  if (!VC) return;
  const now = Date.now(), me = myId();
  if (VCG && !(A.muted || A.deafened) && VCG.gate.gain.value > 0 && rmsOf(VCG.an, VCG.buf) > 0.02) VC.tlast[me] = now;
  Object.keys(VC.peers).forEach((u) => { const p = VC.peers[u]; if (p.an && rmsOf(p.an, p.buf) > 0.015) VC.tlast[u] = now; });
  document.querySelectorAll('.vt[data-vt]').forEach((el) => el.classList.toggle('talk', now - (VC.tlast[el.dataset.vt] || 0) < 350));
  const tm = document.getElementById('vtm'); if (tm) { const c = vclock(); if (tm.textContent !== c) tm.textContent = c; }
}
const fxMenuHTML = (cls) => `<div class="vfxp${cls ? ' ' + cls : ''}" role="menu" aria-label="Efeitos sonoros">${Object.keys(SFX).map((k) => `<button type="button" class="hov" role="menuitem" data-act="vsfx" data-id="${k}"><span>${SFX[k][1]}</span><small>${SFX[k][0]}</small></button>`).join('')}</div>`;
const SFX = { bell: ['Sino', '🔔'], horn: ['Buzina', '📣'], clap: ['Aplausos', '👏'], drum: ['Tambor', '🥁'], coin: ['Moeda', '🪙'], sad: ['Trombone triste', '😢'], siren: ['Sirene', '🚨'], pop: ['Plim', '✨'] };
function sfxPlay(id) {
  if (!VC || A.deafened || !Object.prototype.hasOwnProperty.call(SFX, id)) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  let ctx = VC.ctx || VC.sfx; if (!ctx) { try { ctx = VC.sfx = new AC(); } catch (e) { return; } }
  if (ctx.resume) ctx.resume().catch(() => {});
  const t0 = ctx.currentTime, vol = 0.18 * (window.SQ_SET ? window.SQ_SET.outputVolume() : 1);
  const tone = (f, at, dur, type, to) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0 + at); if (to) o.frequency.linearRampToValueAtTime(to, t0 + at + dur); g.gain.setValueAtTime(vol, t0 + at); g.gain.exponentialRampToValueAtTime(0.001, t0 + at + dur); o.connect(g); g.connect(ctx.destination); o.start(t0 + at); o.stop(t0 + at + dur + 0.02); };
  const noise = (at, dur) => { const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), dd = b.getChannelData(0); for (let i = 0; i < n; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / n); const sr = ctx.createBufferSource(), g = ctx.createGain(); sr.buffer = b; g.gain.value = vol * 1.6; sr.connect(g); g.connect(ctx.destination); sr.start(t0 + at); };
  if (id === 'bell') { tone(880, 0, 1.2); tone(1320, 0, 1); }
  else if (id === 'horn') tone(220, 0, 0.8, 'sawtooth');
  else if (id === 'clap') for (let i = 0; i < 7; i++) noise(i * 0.09, 0.08);
  else if (id === 'drum') { tone(150, 0, 0.3, 'sine', 50); tone(150, 0.35, 0.3, 'sine', 50); }
  else if (id === 'coin') { tone(988, 0, 0.12, 'square'); tone(1319, 0.1, 0.5, 'square'); }
  else if (id === 'sad') { tone(392, 0, 0.35, 'sawtooth'); tone(370, 0.35, 0.35, 'sawtooth'); tone(349, 0.7, 0.35, 'sawtooth'); tone(330, 1.05, 0.9, 'sawtooth', 290); }
  else if (id === 'siren') { tone(600, 0, 0.5, 'sine', 900); tone(900, 0.5, 0.5, 'sine', 600); }
  else { tone(660, 0, 0.08, 'triangle'); tone(990, 0.08, 0.18, 'triangle'); }
}
function showFx(uid, id) {
  const el = document.querySelector('.vt[data-vt="' + uid + '"]'); if (!el) return;
  const sp = document.createElement('span'); sp.className = 'vfx'; sp.textContent = SFX[id][1]; el.appendChild(sp); setTimeout(() => sp.remove(), 1700);
}
function voiceSfx(id) {
  if (!VC || !Object.prototype.hasOwnProperty.call(SFX, id) || Date.now() - (VC.sfxAt || 0) < 1500) return;
  VC.sfxAt = Date.now(); A.vfxOpen = false;
  sfxPlay(id); vsend('sfx', { id }); showFx(myId(), id); render();
}
function voiceLeave(quiet) {
  if (!VC) return;
  if (window.SQ_SET && !quiet) window.SQ_SET.fx('leave');
  const v = VC; vsend('bye', {});
  VC = null;
  clearInterval(v.ping); clearInterval(v.vad); clearInterval(v.talkT); VCG = null;
  if (v.vstream) v.vstream.getTracks().forEach((t) => { t.onended = null; t.stop(); });
  if (v.sfx) { try { v.sfx.close(); } catch (e) { /* ok */ } }
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
    if (r.thread_of) { if (r.author_id !== myId()) { loadTc(ch); const tm = A.modal; if (tm && tm.type === 'thread' && String(tm.parent.id) === String(r.thread_of)) loadReplies(tm); } return; }
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
async function sendTo(key, text, img, alt) {
  const body = { channel_id: key, content: text };
  if (img) body.attachment_path = img;
  if (img && alt) body.attachment_alt = alt;
  const rows = await sb('/rest/v1/messages?select=' + FIELDS, { method: 'POST', body, prefer: 'return=representation' });
  const m = mapMsg(rows[0]), th = A.threads[key];
  if (th && !th.some((x) => x.id === m.id)) th.push(m);
}
function syncSend() {
  const b = document.getElementById('send-btn'); if (b) b.hidden = !A.draft.trim() && !SPV('send_btn', false);
}
async function shrinkMax(file, max) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('img'))), 'image/jpeg', 0.82));
}
function pickImage() {
  const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/jpeg,image/png,image/webp,image/gif';
  f.addEventListener('change', () => { if (f.files && f.files[0]) sendImage(f.files[0]); });
  f.click();
}
async function sendImage(file) {
  const key = A.channel;
  if (!key || A.sending) return;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return toast('Use uma imagem JPG, PNG, WebP ou GIF.');
  if (file.type === 'image/gif' && file.size > 3 * 1024 * 1024) return toast('O GIF é muito grande (máximo 3 MB).');
  if (file.size > 15 * 1024 * 1024) return toast('A imagem é muito grande (máximo 15 MB).');
  A.sending = true; toast('Enviando imagem…');
  const caption = A.draft.trim();
  try {
    const isGif = file.type === 'image/gif';
    const blob = isGif ? file : await shrinkMax(file, 1280);
    const path = myId() + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '' + Math.random().toString(16).slice(2)) + (isGif ? '.gif' : '.jpg');
    await storageCall('POST', path, blob, isGif ? 'image/gif' : 'image/jpeg', 'attachments');
    let alt = '';
    if (SPV('img_desc', false)) { try { alt = (window.prompt('Descreva a imagem para quem usa leitor de tela (opcional):', '') || '').trim().slice(0, 300); } catch (e) { alt = ''; } }
    await sendTo(key, caption || '📷 Imagem', path, alt);
    if (caption) { A.draft = ''; const i = document.getElementById('msg'); if (i) i.value = ''; syncSend(); }
  } catch (e) { toast(e && e.message === 'upload_failed' ? 'Não foi possível enviar a imagem. Tente outra.' : errText(e)); }
  A.sending = false;
  if (curKey() === key) paintMsgs(true);
}
async function doSend() {
  const key = A.channel;
  const text = A.draft.trim();
  if (!text || !key || A.sending) return;
  A.sending = true;
  A.draft = ''; A.emojiOpen = false;
  const input = document.getElementById('msg'); if (input) { input.value = ''; input.focus(); }
  syncSend();
  try { await sendTo(key, text); }
  catch (e) {
    if (!A.draft) { A.draft = text; const i2 = document.getElementById('msg'); if (i2) i2.value = text; syncSend(); }
    toast(errText(e));
  }
  A.sending = false;
  if (curKey() === key) paintMsgs(true);
}

function refilter() {
  const f = document.getElementById('flist'); if (f) f.innerHTML = flistHTML();
  const l = document.getElementById('mlist'); if (l) l.innerHTML = membersListHTML();
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
  <div style="height:1px;margin:8px 0;background:rgba(128,128,128,.22)"></div>
  ${grp(A.offlineOpen, 'ftoggle', 'Offline (' + off.length + plural(off.length) + ')')}
  ${A.offlineOpen ? `<div style="display:flex;flex-direction:column;gap:4px">${off.map((p) => row(p, true)).join('')}</div>` : ''}
  ${on.length + off.length === 0 ? '<div style="padding:12px 4px;font-size:13px;color:#55555F">Nenhum membro encontrado para essa busca.</div>' : ''}`;
}

function serverMsgsHTML() {
  const dm = A.view === 'dm', srv = dm ? null : curServer(), key = A.channel, me = myId();
  if ((!srv && !dm) || !key) return '<div class="fill"></div><div class="empty">Este servidor ainda não tem canais de texto.</div>';
  if (!A.loaded[key]) return A.terr[key] ? '<div class="fill"></div><div class="empty">Não foi possível carregar as mensagens. <button type="button" class="lnk" data-act="retry-thread">Tentar de novo</button></div>' : `<div class="skbox skfill" role="status" aria-busy="true" aria-label="Carregando mensagens">${skMsgs(6)}</div>`;
  const th = (A.threads[key] || []).filter((m) => !A.blocked.has(m.from));
  const intro = A.more[key] ? '' : (srv ? welcomeHTML(srv, srv.text.find((c) => c.id === key)) : dmIntroHTML(dmPeer(key)));
  const acts = (m) => {
    const mine = m.from === me;
    const rbtn = SPV('msg_react', true) ? `<button type="button" class="hov" data-act="rx-pick" data-id="${m.id}" aria-label="Adicionar reação">${ic(D.smile || D.plus, 14, '#55555F', 1.8)}</button>` : '';
    const tbtn = `<button type="button" class="hov" data-act="thread-open" data-id="${m.id}" aria-label="Responder em tópico">${ic(D.dm, 14, '#55555F', 1.8)}</button>`;
    if (!mine && !(srv && srv.owner === me)) return `<span class="mact">${rbtn}${tbtn}</span>`;
    return `<span class="mact">${rbtn}${tbtn}${mine ? `<button type="button" class="hov" data-act="msg-edit" data-id="${m.id}" aria-label="Editar mensagem">${ic(D.edit, 14, '#55555F', 1.8)}</button>` : ''}<button type="button" class="hov" data-act="msg-del" data-id="${m.id}" aria-label="Apagar mensagem">${ic(D.close, 14, '#55555F', 1.8)}</button></span>`;
  };
  const tcb = (m) => { const n = A.tc[m.id]; return n ? `<button type="button" class="tcb" data-act="thread-open" data-id="${m.id}">${n} ${n === 1 ? 'resposta' : 'respostas'} em tópico</button>` : ''; };
  return '<div class="fill"></div>'
    + (A.more[key] ? '<button type="button" class="lnk older" data-act="older">Ver mensagens mais antigas</button>' : '')
    + intro
    + (th.length || intro ? '' : '<div class="empty">Nenhuma mensagem ainda. Seja o primeiro a escrever.</div>')
    + th.map((m) => {
      const ed = m.edited ? ' <small class="ed">(editada)</small>' : '';
      if (m.from === me) return `<div class="mout">${acts(m)}<div class="bub"><span class="sr">Você: </span>${msgBody(m)}${ed}${rxHTML(m)}${tcb(m)}</div></div>`;
      const p = srv ? srv.byId[m.from] : dmPeer(key), nm = p ? p.name : 'Ex-membro';
      return `<div class="min"><div class="col"><button type="button" class="av40" data-act="profile" data-id="${m.from}" aria-label="Ver perfil de ${esc(nm)}" style="background:${p ? p.g : G.slate}">${esc(p ? p.ini : '')}</button><small>${esc(msgTime(m.at))}</small></div>
        <div class="bub"><button type="button" class="an" data-act="profile" data-id="${m.from}">${esc(nm)}</button>${msgBody(m)}${ed}${rxHTML(m)}${tcb(m)}</div>${acts(m)}</div>`;
    }).join('');
}

function composerHTML(ok, ph) {
  return `      <div class="comp">
        ${A.stickerOpen ? `<div class="emoji stkp" role="group" aria-label="Escolher figurinha">${STICKERS.map((e) => `<button type="button" class="hov" data-act="sticker" data-ch="${e[0]}" aria-label="Enviar figurinha ${e[1]}">${e[0]}</button>`).join('')}</div>` : ''}
        ${A.emojiOpen ? `<div class="emoji" role="group" aria-label="Escolher emoji">${EMOJIS.map((e) => `<button type="button" class="hov" data-act="emoji" data-ch="${e[0]}" aria-label="Inserir emoji ${e[1]}">${e[0]}</button>`).join('')}</div>` : ''}
        <div class="typing" id="typing" aria-live="polite"></div>
        <div class="cbar${SPV('plain_input', false) ? ' plain' : ''}">
          <button type="button" class="hov plus" data-act="attach" aria-label="Anexar imagem">${ic(D.plus, 19)}</button>
          <input id="msg" type="text" placeholder="${ph}" maxlength="2000" value="${esc(A.draft)}" data-app-bind="draft" autocomplete="off" aria-label="Escreva uma mensagem"${ok ? '' : ' disabled'}>
          <button type="button" class="hov ib" data-act="toast-gift" aria-label="Enviar presente">${ic(D.gift, 19, '#55555F', 1.6)}</button>
          <button type="button" class="hov ib" data-act="toast-gif" aria-label="Escolher GIF"><span class="gif">GIF</span></button>
          <button type="button" class="hov ib" data-act="sticker-toggle" aria-label="Escolher figurinha" aria-expanded="${!!A.stickerOpen}">${ic(D.sticker, 19, '#55555F', 1.6)}</button>
          <button type="button" class="hov ib" data-act="emoji-toggle" aria-label="Escolher emoji" aria-expanded="${A.emojiOpen}">${ic(D.smile, 19, '#55555F', 1.6)}</button>
          <button type="button" class="hov ib" data-act="toast-soon" data-msg="Os apps chegam em breve" aria-label="Apps">${ic(D.apps, 19, '#55555F', 1.6)}</button>
          <button type="button" class="go" id="send-btn" data-act="send" aria-label="Enviar mensagem"${A.draft.trim() || SPV('send_btn', false) ? '' : ' hidden'}>${ic(D.send, 18, '#FFFFFF', 1.8)}</button>
        </div>
      </div>`;
}
function voiceBarHTML() {
  if (!A.voice) return '';
  const s = SERVERS.find((x) => x.voice.some((g) => g.id === A.voice)), g = s && s.voice.find((x) => x.id === A.voice);
  const cam = !!(VC && VC.cam), scr = !!(VC && VC.scr);
  const b = (act, icon, label, on, extra = '') => `<button type="button" class="vbb${on ? ' sel' : ''}" data-act="${act}" ${extra} aria-label="${label}" title="${label}">${ic(icon, 20, on ? '#fff' : '#33333A', 1.8)}</button>`;
  return `<div class="vbar" role="status"><div class="vbt"><span class="vsig">${ic(D.signal, 18, '#1F9D63', 2.2)}</span><button type="button" class="vtt" data-act="vopen" aria-label="Abrir a chamada"><b>Voz conectada</b><small>${esc(g ? g.name : 'Sala')}${s ? ' / ' + esc(s.name) : ''}</small></button><button type="button" class="hov sq" data-act="vleave" aria-label="Desconectar da chamada" title="Desconectar">${ic(D.hangup, 20, '#33333A', 1.9)}</button></div>
  <div class="vbbs">${b('vcam', cam ? D.camera : D.camOff, cam ? 'Desligar câmera' : 'Ligar câmera', cam, `aria-pressed="${cam}"`)}${b('vscr', D.screen, scr ? 'Parar de compartilhar a tela' : 'Compartilhar tela', scr, `aria-pressed="${scr}"`)}${b('toast-soon', D.apps, 'Atividades', false, 'data-msg="As atividades chegam em breve"')}${b('vfx', D.party, 'Efeitos sonoros', !!A.vfxOpen, `aria-expanded="${!!A.vfxOpen}"`)}</div>${A.vfxOpen && !A.vpage ? fxMenuHTML('side') : ''}</div>`;
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
      body = head + (m.list == null ? skWrap(skRows(4, 40), 'Carregando servidores') : m.list.length ? `<div class="mus-list">${m.list.map((x) => `<div class="exrow"><span class="stl sm" style="background:${tileFor(x.id)}">${esc(String(x.name).charAt(0).toUpperCase())}</span><span class="tx"><b>${esc(x.name)}</b><small>${x.members} ${x.members === 1 ? 'membro' : 'membros'}</small></span>${x.joined ? '<small class="exin">Você já está</small>' : `<button type="button" class="mbtn sm" data-act="explore-join" data-id="${esc(x.id)}"${m.busy ? ' disabled' : ''}>Entrar</button>`}</div>`).join('')}</div>` : '<p class="mnote">Ainda não há servidores públicos. Crie o primeiro: marque "Servidor público" ao criar.</p>');
    } else {
      body = head + mField('mf-name', 'Nome do servidor', 'name', m.name, { ph: 'Ex.: Meus amigos', max: 40, hint: 'Você será o dono. Já vem com os canais Geral e Sala principal.' })
        + `<div class="mf"><button type="button" class="mtog${m.pub ? ' on' : ''}" data-act="m-pub" aria-pressed="${!!m.pub}"><i></i><span>Servidor público (aparece em Explorar)</span></button><small>Qualquer pessoa logada poderá entrar. Por enquanto só dá para escolher isso ao criar.</small></div>`;
    }
  } else if (m.type === 'chan') {
    title = 'Criar canal'; label = 'Criar canal';
    body = tabs([{ act: 'modal-mode', mode: 'text', l: 'Texto', on: m.kind !== 'voice' }, { act: 'modal-mode', mode: 'voice', l: 'Voz', on: m.kind === 'voice' }])
      + mField('mf-name', 'Nome do canal', 'name', m.name, { ph: m.kind === 'voice' ? 'Ex.: Sala de jogos' : 'Ex.: Avisos', max: 30 })
      + (m.kind === 'voice' ? '<p class="mnote">Até 10 pessoas por sala. O áudio vai direto entre os participantes.</p>' : '');
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
        ${SPV('dev_mode', false) ? `<button type="button" class="lnk" data-act="copy-id" data-id="${esc(p.id)}">Copiar ID do usuário</button>` : ''}
      </div></div>`;
      const rel = p.me ? 'me' : relOf(p.id), dis = m.busy ? ' disabled' : '';
      foot = rel === 'me' ? '<button type="button" class="mbtn" data-act="edit-profile">Editar perfil</button>'
        : rel === 'friend' ? `<button type="button" class="mbtn ghost" data-act="fr-remove" data-id="${p.id}"${dis}>Remover amigo</button><button type="button" class="mbtn" data-act="dm" data-id="${p.id}"${dis}>Enviar mensagem</button>`
        : rel === 'incoming' ? `<button type="button" class="mbtn ghost" data-act="fr-decline" data-id="${p.id}"${dis}>Recusar</button><button type="button" class="mbtn" data-act="fr-accept" data-id="${p.id}"${dis}>Aceitar pedido</button>`
        : rel === 'blocked' ? `<button type="button" class="mbtn" data-act="fr-unblock" data-id="${p.id}"${dis}>Desbloquear</button>`
        : rel === 'outgoing' ? `<button type="button" class="mbtn ghost" data-act="fr-remove" data-id="${p.id}"${dis}>Cancelar pedido</button><button type="button" class="mbtn" data-act="dm" data-id="${p.id}"${dis}>Enviar mensagem</button>`
        : `<button type="button" class="mbtn ghost" data-act="dm" data-id="${p.id}"${dis}>Enviar mensagem</button><button type="button" class="mbtn" data-act="fr-add" data-user="${esc(p.user)}"${dis}>Adicionar amigo</button>`;
      const sv = A.view === 'server' ? curServer() : null;
      if (sv && sv.mine && !p.me && sv.byId[p.id]) foot = `<button type="button" class="blink" data-act="mod" data-k="kick" data-id="${p.id}"${dis}>Expulsar</button><button type="button" class="blink" data-act="mod" data-k="ban" data-id="${p.id}"${dis}>Banir</button>` + foot;
      if (rel !== 'me' && rel !== 'blocked') foot = `<button type="button" class="blink" data-act="fr-block" data-id="${p.id}"${dis}>Bloquear</button>` + foot;
    }
  } else if (m.type === 'mod') {
    title = m.k === 'ban' ? 'Banir do servidor' : 'Expulsar do servidor'; label = m.k === 'ban' ? 'Banir' : 'Expulsar';
    body = `<p class="mnote">${m.k === 'ban' ? 'Banir' : 'Expulsar'} ${esc(m.name)}? ${m.k === 'ban' ? 'A pessoa sai do servidor e não consegue voltar por convite, até você desbanir.' : 'A pessoa sai do servidor, mas pode voltar com um novo convite.'}</p>`;
  } else if (m.type === 'bans') {
    title = 'Pessoas banidas';
    body = m.items == null ? skWrap(skRows(3, 34), 'Carregando') : m.items.length ? `<div class="banlist">${m.items.map((b) => `<div class="banrow"><span><b>${esc(b.display_name || 'Pessoa')}</b>${b.username ? ' <small>@' + esc(b.username) + '</small>' : ''}</span><button type="button" class="mbtn sm ghost" data-act="unban" data-id="${b.user_id}"${m.busy ? ' disabled' : ''}>Desbanir</button></div>`).join('')}</div>` : '<p class="mnote">Ninguém foi banido deste servidor.</p>';
    foot = '<button type="button" class="mbtn ghost" data-act="modal-close">Fechar</button>';
  } else if (m.type === 'events') {
    const srv = curServer();
    if (m.view === 'new') {
      title = 'Criar evento'; label = 'Criar evento';
      body = mField('ev-t', 'Nome do evento', 'evTitle', m.evTitle, { ph: 'Ex.: Noite de jogos', max: 80 }) + mField('ev-p', 'Local (opcional)', 'evPlace', m.evPlace, { ph: 'Ex.: Canal de voz Geral', max: 80 }) + `<div class="mf"><label for="ev-d">Data e hora</label><input id="ev-d" data-mf type="datetime-local" data-app-bind="m:evWhen" value="${esc(m.evWhen)}"></div>` + mField('ev-x', 'Descrição (opcional)', 'evDesc', m.evDesc, { area: true, max: 500 });
    } else {
      title = 'Eventos do servidor';
      const fmt = (d) => new Date(d).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      body = m.items == null ? skWrap(skRows(3, 44), 'Carregando') : m.items.length ? `<div class="evlist">${m.items.map((e) => `<div class="evrow"><div class="evtx"><b>${esc(e.title)}</b><small>${esc(fmt(e.starts_at))}${e.place ? ' · ' + esc(e.place) : ''}</small>${e.description ? `<p>${esc(e.description)}</p>` : ''}<small>${e.n} ${e.n === 1 ? 'pessoa interessada' : 'pessoas interessadas'}</small></div><div class="evb"><button type="button" class="mbtn${e.mine ? ' ghost' : ''}" data-act="event-int" data-id="${e.id}" aria-pressed="${e.mine}">${e.mine ? 'Tenho interesse ✓' : 'Tenho interesse'}</button>${srv && srv.mine ? `<button type="button" class="mbtn ghost" data-act="event-del" data-id="${e.id}">Excluir</button>` : ''}</div></div>`).join('')}</div>` : '<p class="mnote">Nenhum evento marcado por enquanto.</p>';
      foot = `<button type="button" class="mbtn ghost" data-act="modal-close">Fechar</button>${srv && srv.mine ? '<button type="button" class="mbtn" data-act="event-new">Criar evento</button>' : ''}`;
    }
  } else if (m.type === 'thread') {
    title = 'Tópico'; label = 'Responder';
    const srv = curServer(), pp = m.parent.from === myId() ? null : srv ? srv.byId[m.parent.from] : dmPeer(m.key);
    body = `<div class="thp"><b>${esc(m.parent.from === myId() ? 'Você' : pp ? pp.name : 'Ex-membro')}</b><div>${msgBody(m.parent)}</div></div><div id="thlist" class="thlist" aria-live="polite">${threadListHTML(m)}</div>` + mField('th-r', 'Sua resposta', 'reply', m.reply, { ph: 'Responder neste tópico', max: 2000 });
  } else if (m.type === 'vinvite') {
    title = 'Adicionar pessoas'; foot = '<button type="button" class="mbtn ghost" data-act="modal-close">Fechar</button>';
    body = '<p class="mnote">Avise o grupo que você está na chamada de voz ou convide quem ainda não está no servidor.</p><div class="vinvb"><button type="button" class="mbtn" data-act="v-notify">Avisar no canal de texto</button><button type="button" class="mbtn ghost" data-act="nav" data-k="invite">Criar convite do servidor</button></div>';
  } else if (m.type === 'block') {
    title = 'Bloquear pessoa'; label = 'Bloquear';
    body = `<p class="mnote">Bloquear ${esc(m.name)}? Vocês deixam de ser amigos e você não verá as mensagens dela nos servidores. Você pode desbloquear depois, no perfil dela.</p>`;
  }
  const showSubmit = !((m.type === 'events' && m.view !== 'new') || m.type === 'invite' || m.type === 'profile' || m.type === 'bans' || m.type === 'vinvite' || (m.type === 'srv' && m.mode === 'explore'));
  return `<div class="mback" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="mhead"><h2>${esc(title)}</h2><button type="button" class="hov sq" data-act="modal-close" aria-label="Fechar">${ic(D.close, 16, '#55555F', 1.8)}</button></header>
    <div class="mbody">${body}${m.err ? `<div class="merr" role="alert">${esc(m.err)}</div>` : ''}</div>
    <footer class="mfoot">${showSubmit ? `<button type="button" class="mbtn ghost" data-act="modal-close">Cancelar</button><button type="button" class="mbtn${m.type === 'del' || m.type === 'block' || m.type === 'mod' ? ' danger' : ''}" data-act="modal-submit"${m.busy ? ' disabled' : ''}>${m.busy ? 'Aguarde…' : label}</button>` : foot}</footer>
  </div></div>`;
}
async function loadEvents(m) {
  const s = curServer(); if (!s) return;
  try {
    const evs = await sb('/rest/v1/server_events?select=id,title,description,place,starts_at&server_id=eq.' + s.id + '&starts_at=gte.' + encodeURIComponent(new Date(Date.now() - 3600000).toISOString()) + '&order=starts_at.asc&limit=25');
    const ints = evs.length ? await sb('/rest/v1/event_interest?select=event_id,user_id&event_id=in.(' + evs.map((e) => e.id).join(',') + ')') : [];
    if (A.modal !== m) return;
    m.items = evs.map((e) => { const l = ints.filter((i) => i.event_id === e.id); return Object.assign({}, e, { n: l.length, mine: l.some((i) => i.user_id === myId()) }); });
  } catch (e) { if (A.modal !== m) return; m.items = []; m.err = errText(e); }
  render();
}
function focusModal() { setTimeout(() => { const f = document.querySelector('.modal [data-mf]'); if (f) f.focus(); }, 0); }
async function storageCall(method, path, body, type, bucket) {
  const t = await freshToken(); if (!t) throw { message: 'not_authenticated', status: 401 };
  const h = { apikey: C.SUPABASE_KEY, authorization: 'Bearer ' + t };
  if (type) h['content-type'] = type;
  let r; try { r = await fetch(C.SUPABASE_URL + '/storage/v1/object/' + (bucket || 'avatars') + '/' + path, { method, headers: h, body }); } catch (e) { throw { message: 'network', status: 0 }; }
  if (!r.ok) throw { message: 'upload_failed', status: r.status };
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
  if (m.type === 'thread') {
    const text = m.reply.trim();
    if (!text) return modalErr('Escreva a resposta.');
    return run(async () => {
      const rows = await sb('/rest/v1/messages?select=' + FIELDS, { method: 'POST', body: { channel_id: m.key, content: text, thread_of: m.parent.id }, prefer: 'return=representation' });
      if (A.modal === m) { m.items = (m.items || []).concat(mapMsg(rows[0])); m.reply = ''; m.busy = false; render(); focusModal(); const l = document.getElementById('thlist'); if (l) l.scrollTop = l.scrollHeight; loadTc(m.key); }
    });
  }
  if (m.type === 'events') {
    const s = curServer(); if (!s) return;
    const when = m.evWhen ? new Date(m.evWhen) : null;
    if (m.evTitle.trim().length < 2) return modalErr('Dê um nome ao evento (de 2 a 80 letras).');
    if (!when || isNaN(when)) return modalErr('Escolha a data e a hora do evento.');
    if (when.getTime() < Date.now() - 300000) return modalErr('A data do evento precisa ser no futuro.');
    return run(async () => { await rpc('create_event', { p_server: s.id, p_title: m.evTitle.trim(), p_description: m.evDesc.trim(), p_place: m.evPlace.trim(), p_starts: when.toISOString() }); if (A.modal === m) { m.view = 'list'; m.busy = false; m.items = null; render(); loadEvents(m); toast('Evento criado'); } });
  }
  if (m.type === 'block') {
    return run(async () => { await rpc('block_user', { p_other: m.id }); await loadWorld(() => {}); A.modal = null; render(); toast('Pessoa bloqueada'); });
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
      A.panel = null; A.modal = null;
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
    case 'modal-mode': if (A.modal) { if (A.modal.type === 'chan') A.modal.kind = el.dataset.mode; else A.modal.mode = el.dataset.mode; A.modal.err = ''; render(); focusModal(); if (A.modal.type === 'srv' && A.modal.mode === 'explore') loadExplore(); } return true;
    case 'modal-open': {
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
    case 'profile': A.modal = { type: 'profile', id: el.dataset.id }; render(); return true;
    case 'edit-profile': A.modal = null; render(); if (window.SQ_PERFIL) window.SQ_PERFIL.open(); return true;
    case 'fr-add': friendAct('add', '', el.dataset.user); return true;
    case 'fr-accept': friendAct('accept', el.dataset.id); return true;
    case 'fr-decline': friendAct('decline', el.dataset.id); return true;
    case 'fr-remove': friendAct('remove', el.dataset.id); return true;
    case 'dm': friendAct('dm', el.dataset.id); return true;
    case 'dm-open': friendAct('dm', el.dataset.id, '', true); return true;
    case 'dmreq': { const w = A, ok = el.dataset.ok === '1', ch = el.dataset.ch; rpc('respond_dm_request', { p_channel: ch, p_accept: ok }).then(async () => { if (ok) { await loadWorld(() => {}); } else { if (A.channel === ch) { A.view = 'friends'; A.channel = null; } await loadWorld(() => {}); } if (A === w) { render(); toast(ok ? 'Solicitação aceita' : 'Solicitação recusada'); } }).catch((e) => toast(errText(e))); return true; }
    case 'mod': { const p = findPerson(el.dataset.id); if (p) { A.modal = { type: 'mod', k: el.dataset.k, id: p.id, name: p.name, err: '', busy: false }; render(); } return true; }
    case 'events': { if (!curServer()) { toast('Abra um servidor para ver os eventos.'); return true; } const m = A.modal = { type: 'events', view: 'list', items: null, err: '', busy: false, evTitle: '', evPlace: '', evDesc: '', evWhen: '' }; render(); loadEvents(m); return true; }
    case 'event-new': if (A.modal) { A.modal.view = 'new'; A.modal.err = ''; render(); focusModal(); } return true;
    case 'event-int': { const m = A.modal, id = el.dataset.id; rpc('toggle_event_interest', { p_event: id }).then(() => loadEvents(m)).catch((e) => toast(errText(e))); return true; }
    case 'event-del': { const m = A.modal, id = el.dataset.id; rpc('delete_event', { p_event: id }).then(() => { toast('Evento excluído'); loadEvents(m); }).catch((e) => toast(errText(e))); return true; }
    case 'bans': { const s = curServer(); if (!s) return true; const m = A.modal = { type: 'bans', items: null, err: '', busy: false }; render(); rpc('list_bans', { p_server: s.id }).then((r) => { if (A.modal === m) { m.items = r || []; render(); } }).catch((e) => { if (A.modal === m) { m.items = []; m.err = errText(e); render(); } }); return true; }
    case 'unban': { const m = A.modal, s = curServer(); if (!m || !s) return true; m.busy = true; render(); rpc('unban_member', { p_server: s.id, p_user: el.dataset.id }).then(() => { m.items = (m.items || []).filter((b) => b.user_id !== el.dataset.id); m.busy = false; render(); toast('Pessoa desbanida'); }).catch((e) => { m.busy = false; m.err = errText(e); render(); }); return true; }
    case 'fr-unblock': friendAct('unblock', el.dataset.id); return true;
    case 'fr-block': { const p = findPerson(el.dataset.id); if (p) { A.modal = { type: 'block', id: p.id, name: p.name, err: '', busy: false }; render(); focusModal(); } return true; }
    case 'msg-edit': openMsgModal('edit', el); return true;
    case 'thread-open': openThread(el.dataset.id); return true;
    case 'rx-pick': A.rxPick = A.rxPick === el.dataset.id || String(A.rxPick) === el.dataset.id ? null : (isNaN(el.dataset.id) ? el.dataset.id : Number(el.dataset.id)); paintMsgs('keep'); return true;
    case 'rx': toggleRx(el.dataset.id, el.dataset.e); return true;
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
  return rs == null ? skWrap(skRows(4, 34), 'Carregando') : rs.length ? rs.map(resRow).join('') : '<div class="it"><span>Ninguém mencionou você ainda.</span></div>';
}
let sqTimer = null;
function runSearch() {
  const q = (A.sq || '').trim(), key = curKey(), w = A;
  if (q.length < 2 || !key) { A.sres = null; return; }
  A.sres = null;
  sb('/rest/v1/messages?select=id,channel_id,author_id,content,created_at,attachment_path&' + (A.view === 'dm' && SPV('search_scope', 'selected') === 'all' ? 'channel_id=in.(' + A.friends.filter((f) => f.dm).map((f) => f.dm).join(',') + ')' : 'channel_id=eq.' + key) + '&content=ilike.' + esq(q) + '&order=id.desc&limit=30')
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
  signal: '<path d="M5 18v-4M9 18V9M13 18V6M17 18v-7"/>',
  dots: '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  popout: '<path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  camOff: '<path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/><path d="M4 4l16 16"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M12 12V8m0 0-2.2 2.2M12 8l2.2 2.2"/>',
  party: '<path d="M4 20 8.5 8.5 15.5 15.5z"/><path d="M13 4v2.5M19 6.5l-1.8 1.8M20.5 12H18M16 3.5l.5 1.5"/>',
  hangup: '<path d="M3 14.5c5-4.4 13-4.4 18 0l-1.8 3-3.7-1.6v-2.4a11.5 11.5 0 0 0-7 0v2.4L4.8 17.5z"/>',
  volOff: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 9l5 6M21 9l-5 6"/>',
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
  const home = ['friends', 'dm', 'official', 'shop', 'quests', 'plus'].includes(A.view);
  return `<nav class="x-rail" aria-label="Servidores">
  <button type="button" class="rt home${home ? ' on' : ''}" data-act="go-home" aria-label="Mensagens diretas" title="Mensagens diretas">${logoMark(22)}${anyUnread() ? '<i class="udot"></i>' : ''}</button>
  <i class="rsep" aria-hidden="true"></i>
  ${railServers().map((s) => { const on = A.view === 'server' && A.server === s.id; return `<button type="button" class="rt${on ? ' on' : ''}${SPV('fav_servers', false) && favSrv(s.id) ? ' fav' : ''}" data-act="srv-open" data-id="${s.id}" aria-label="${esc(s.name)}" aria-pressed="${on}" title="${esc(s.name)}" style="background:${s.tile}">${esc(s.ini)}</button>`; }).join('')}
  <button type="button" class="rt act" data-act="srv-new" aria-label="Criar ou entrar em um servidor" title="Adicionar um servidor">${ic(D.plus, 22, '#1B6B47', 2)}</button>
  <button type="button" class="rt act" data-act="srv-explore" aria-label="Explorar servidores públicos" title="Explorar servidores públicos">${ic(D.compass, 22, '#1B6B47', 1.8)}</button>
  ${window.squareDesktop ? '' : `<button type="button" class="rt act" data-act="get-app" aria-label="Baixar o app para computador" title="Baixar o app para computador">${ic(D.download, 22, '#1B6B47', 1.8)}</button>`}
</nav>`;
}
function dmColHTML() {
  const v = A.view;
  const nav = (act, icon, label, on, extra = '') => `<button type="button" class="cn${on ? ' on' : ''}" data-act="${act}">${ic(icon, 22, '#33333A', 1.6)}<span>${label}</span>${extra}</button>`;
  const row = (f) => { const on = v === 'dm' && f.dm === A.channel; return `<button type="button" class="dmr${on ? ' on' : ''}" data-act="dm-open" data-id="${f.id}" aria-current="${on}">${xAv(f, 'sm')}<span class="tx"><b>${esc(f.name)}</b></span>${udot(f.dm)}</button>`; };
  return `<button type="button" class="qfind" data-act="qs-open">Encontre ou comece uma conversa</button>
  <div class="cnav">${nav('go-home', D.users, 'Amigos', v === 'friends')}${nav('go-plus', D.spark, 'Shiqi Plus', v === 'plus')}${nav('go-shop', D.grid, 'Loja', v === 'shop')}${nav('go-quests', D.quest, 'Missões', v === 'quests', '<em class="xnb">NOVO</em>')}</div>
  <hr class="chr0">
  <div class="dmh"><span>Mensagens diretas</span><button type="button" class="hov sq" data-act="add-tab" aria-label="Criar mensagem direta" title="Criar mensagem direta">${ic(D.plus, 16, '#55555F', 2)}</button></div>
  <button type="button" class="dmr${v === 'official' ? ' on' : ''}" data-act="go-official" aria-current="${v === 'official'}"><span class="xav sm sqo">${logoMark(16)}</span><span class="tx"><b>Shiqi <u class="ofi">${ic(D.check, 10, '#fff', 3.2)}OFICIAL</u></b><small>Mensagem Oficial da Shiqi</small></span></button>
  ${A.friends.filter((f) => f.dm).concat(A.dmOther || []).map(row).join('')}
  ${(A.dmReq || []).length ? `<div class="dmh"><span>Solicitações de mensagens (${A.dmReq.length})</span></div>${A.dmReq.map((f) => `<div class="dmrq"><button type="button" class="dmr${v === 'dm' && f.dm === A.channel ? ' on' : ''}" data-act="dm-open" data-id="${f.id}">${xAv(f, 'sm')}<span class="tx"><b>${esc(f.name)}</b><small>quer te enviar mensagem</small></span></button><span class="dmrb"><button type="button" class="hov sq" data-act="dmreq" data-ch="${f.dm}" data-ok="1" aria-label="Aceitar solicitação de ${esc(f.name)}" title="Aceitar">${ic(D.check, 16, '#1B6B47', 2.4)}</button><button type="button" class="hov sq" data-act="dmreq" data-ch="${f.dm}" data-ok="0" aria-label="Recusar solicitação de ${esc(f.name)}" title="Recusar">${ic(D.x || D.close || D.plus, 16, '#B3261E', 2.4)}</button></span></div>`).join('')}` : ''}`;
}
function srvColHTML(s) {
  const cs = A.csec;
  const plus = (label, kind) => (s.mine ? `<button type="button" class="hov sq" data-act="modal-open" data-k="chan" data-kind="${kind}" aria-label="${label}" title="${label}">${ic(D.plus, 16, '#55555F', 2)}</button>` : '');
  const sec = (key, label, kind, add) => `<div class="sech"><button type="button" class="sect" data-act="csec" data-k="${key}" aria-expanded="${!cs[key]}">${label}${ic(cs[key] ? D.chevR : D.down, 12, '#55555F', 2.4)}</button>${plus(add, kind)}</div>`;
  const nav = (act, icon, label, extra = '') => `<button type="button" class="cn" data-act="${act}" ${extra}>${ic(icon, 20, '#33333A', 1.6)}<span>${label}</span></button>`;
  const menu = A.pop && A.pop.k === 'srv' ? `<div class="pop smenu" role="menu"><button type="button" class="pi" data-act="nav" data-k="invite">Convidar pessoas${ic(D.userPlus, 16)}</button>${s.mine ? `<button type="button" class="pi" data-act="modal-open" data-k="chan" data-kind="text">Criar canal${ic(D.plus, 16)}</button><button type="button" class="pi" data-act="bans">Ver banidos${ic(D.shield, 16)}</button>` : ''}${SPV('dev_mode', false) ? `<button type="button" class="pi" data-act="copy-id" data-id="${esc(s.id)}">Copiar ID do servidor${ic(D.hash || D.plus, 16)}</button>` : ''}${SPV('fav_servers', false) ? `<button type="button" class="pi" data-act="fav-srv" data-id="${esc(s.id)}">${favSrv(s.id) ? 'Remover dos favoritos' : 'Favoritar servidor'}${ic(D.pin || D.plus, 16)}</button>` : ''}</div>` : '';
  return `<div class="srvh"><button type="button" class="srvn" data-act="srvmenu" aria-haspopup="true" aria-expanded="${!!menu}"><span>${esc(s.name)}</span>${ic(D.down, 14, '#33333A', 2.2)}</button><button type="button" class="hov sq" data-act="nav" data-k="invite" aria-label="Convidar pessoas" title="Convidar pessoas">${ic(D.userPlus, 18, '#33333A', 1.7)}</button>${menu}</div>
  <div class="cnav">${nav('events', D.calendar, 'Eventos')}${nav('open-boost', D.shield, 'Impulsos de servidor')}</div>
  <hr class="chr0">
  ${sec('text', 'Canais de Texto', 'text', 'Adicionar canal de texto')}
  ${cs.text ? '' : s.text.map((c) => { const on = A.channel === c.id; return `<div class="chr${on ? ' on' : ''}"><button type="button" class="chn" data-act="chan" data-id="${c.id}" aria-current="${on}">${ic(D.hash, 18, '#55555F', 1.9)}<span>${esc(c.name)}</span></button><span class="chx"><button type="button" class="hov" data-act="nav" data-k="invite" aria-label="Convidar pessoas" title="Convidar pessoas">${ic(D.userPlus, 15, '#33333A', 1.8)}</button><button type="button" class="hov" data-act="toast-soon" data-msg="As configurações do canal chegam em breve" aria-label="Editar canal" title="Editar canal">${ic(D.gear, 15, '#33333A', 1.7)}</button></span></div>`; }).join('')}
  ${sec('voice', 'Canais de Voz', 'voice', 'Adicionar canal de voz')}
  ${cs.voice ? '' : s.voice.map((g) => { const on = A.voice === g.id; return `<div class="xvg"><div class="chr${on ? ' on' : ''}"><button type="button" class="chn" data-act="vjoin" data-id="${g.id}" aria-label="${on ? 'Abrir a chamada em ' : 'Entrar em '}${esc(g.name)}">${ic(D.volume, 18, on ? '#1F9D63' : '#55555F', 1.8)}<span>${esc(g.name)}</span></button>${on ? `<span class="vtm" id="vtm">${vclock()}</span><span class="chx"><button type="button" class="hov" data-act="vback" aria-label="Abrir o chat de texto" title="Chat de texto">${ic(D.bubble, 15, '#33333A', 1.8)}</button><button type="button" class="hov" data-act="vinvite" aria-label="Convidar pessoas" title="Convidar">${ic(D.userPlus, 15, '#33333A', 1.8)}</button><button type="button" class="hov" data-act="toast-soon" data-msg="As configurações do canal chegam em breve" aria-label="Editar canal" title="Editar canal">${ic(D.gear, 15, '#33333A', 1.7)}</button></span>` : ''}</div>${voiceRoster(g.id).map((u) => { const p = s.byId[u]; return p ? `<div class="xvu"><span class="xav xs" style="background:${p.g}">${esc(p.ini)}</span><span>${esc(p.name)}</span></div>` : ''; }).join('')}</div>`; }).join('')}`;
}
function userPopHTML() {
  const me = A.me || {}, sub = A.pop.sub || '', pr = me.presence || 'online';
  const durs = (s) => `<div class="fly fly2">${[['Por 15 minutos', 900000], ['Por 1 hora', 3600000], ['Por 3 horas', 10800000], ['Por 8 horas', 28800000], ['Por 24 horas', 86400000], ['Até eu mudar', 0]].map((d) => `<button type="button" class="pi" data-act="status-set" data-s="${s}" data-ms="${d[1]}">${d[0]}</button>`).join('')}</div>`;
  const sti = (s, label, desc, dot) => `<div class="pi-w"><button type="button" class="pi st${pr === s ? ' cur' : ''}" data-act="status-set" data-s="${s}" data-ms="0"><i class="sd ${dot} stat"></i><span class="tx"><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span>${s === 'online' ? '' : ic(D.chevR, 14, '#55555F', 2.2)}</button>${s === 'online' ? '' : durs(s)}</div>`;
  const statusFly = `<div class="fly" role="menu">${sti('online', 'Disponível', '', 'on')}${sti('idle', 'Ausente', '', 'idle')}${sti('dnd', 'Não perturbe', 'Você não receberá notificação na área de trabalho', 'dnd')}${sti('invisible', 'Invisível', 'Você vai aparecer Off-line', 'off')}</div>`;
  const ptsFly = `<div class="fly pts"><div class="ptsh">${ic(D.coin, 30, '#7B6BB5', 1.6)}<b>0</b></div><div class="ptst"><small>Desafios ativos</small><button type="button" class="tagx" data-act="toast-soon" data-msg="O Shiqi Plus chega em breve">Desbloquear 1.2x</button></div>
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
  <div class="x-lt">${railHTML()}<aside class="x-col" aria-label="${srv ? 'Canais do servidor' : 'Mensagens diretas'}"><div class="x-cs" id="sscroll">${A.world === 'loading' ? skWrap(`<div style="padding:12px 10px">${skRows(7, 32)}</div>`) : srv ? srvColHTML(srv) : dmColHTML()}</div></aside></div>
  <div class="x-ubw">${ubarHTML()}</div></div>${A.drawer ? '<button type="button" class="x-bk" data-act="drawer" aria-label="Fechar menu"></button>' : ''}`;
}
function titlebarHTML() {
  const v = A.view, srv = v === 'server' ? curServer() : null, peer = v === 'dm' ? dmPeer(A.channel) : null;
  const t = srv ? [D.hash, srv.name] : peer ? [D.at, peer.name] : v === 'official' ? [D.bubble, 'Shiqi'] : v === 'shop' ? [D.grid, 'Loja'] : v === 'quests' ? [D.quest, 'Missões'] : v === 'plus' ? [D.spark, 'Shiqi Plus'] : [D.users, 'Amigos'];
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
  return `<div class="af"><div class="afh"><div><h2>Adicionar amigo</h2><p>Você pode adicionar amigos com o nome de usuário Shiqi deles.</p></div>${IMG_MASCOT}</div>
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
function officialPageHTML() {
  const name = (displayName() || '').split(' ')[0];
  return `<header class="x-ph"><div class="pt"><span class="xav sm sqo">${logoMark(16)}</span><h1>Shiqi <u class="ofi">${ic(D.check, 10, '#fff', 3.2)}OFICIAL</u></h1></div></header>
  <div class="x-pb"><div class="x-chat"><div class="msgs"><div class="fill"></div><div class="min"><div class="col"><span class="av40 sqo">${logoMark(20)}</span></div><div class="bub"><span class="an">Shiqi</span>Olá, ${esc(name)}! Bem-vindo(a) à Shiqi. Aqui você conversa com amigos, cria servidores e participa de comunidades. Para começar, adicione um amigo ou crie o seu primeiro servidor.</div></div></div>
  <div class="comp"><div class="cbar"><input type="text" placeholder="Você não pode responder a esta conversa." disabled aria-label="Resposta indisponível"></div></div></div></div>`;
}
function dmPageHTML() {
  const peer = dmPeer(A.channel) || { name: 'Conversa', ini: '?', g: G.lilac, id: '' };
  return `<header class="x-ph"><div class="pt">${ic(D.at, 22, '#33333A', 1.6)}<h1>${esc(peer.name)}</h1><i class="sd ${sdCls(peer)} inl"></i></div><span class="tsp"></span><button type="button" class="hov sq${A.panel === 'search' ? ' sel' : ''}" data-act="nav" data-k="search" aria-label="Buscar mensagens" title="Buscar mensagens">${ic(D.search, 20, '#33333A', 1.7)}</button><button type="button" class="hov sq" data-act="profile" data-id="${peer.id}" aria-label="Ver perfil" title="Ver perfil">${ic(D.user, 20, '#33333A', 1.7)}</button></header>
  <div class="x-pb"><div class="x-chat"><div class="msgs" id="msgs" role="log" aria-label="Mensagens" aria-live="polite">${serverMsgsHTML()}</div>${composerHTML(true, 'Conversar com @' + peer.name)}</div></div>`;
}
function voicePageHTML(srv, g) {
  const inCall = A.voice === g.id, me = myId();
  let ids = voiceRoster(g.id).slice(); if (inCall && !ids.includes(me)) ids.unshift(me);
  ids = ids.filter((u, i) => ids.indexOf(u) === i);
  if (inCall) ids.sort((a, b) => (a === me ? -1 : b === me ? 1 : 0));
  const people = ids.map((u) => srv.byId[u]).filter(Boolean);
  const off = A.muted || A.deafened;
  const head = `<header class="vph"><button type="button" class="vib" data-act="vback" aria-label="Voltar ao chat">${ic(D.down, 22, '#1D1D22', 2.2)}</button><span class="vchip"><span class="vcn">${esc(g.name)}</span>${ic(D.chevR, 16, '#1D1D22', 2.4)}</span><span class="tsp"></span>${inCall ? `<button type="button" class="vib${A.deafened ? '' : ' sel'}" data-act="deaf" aria-pressed="${!!A.deafened}" aria-label="${A.deafened ? 'Ativar áudio' : 'Desativar áudio'}">${ic(A.deafened ? D.volOff : D.volume, 22, A.deafened ? '#B3261E' : '#fff', 2)}</button>` : ''}<button type="button" class="vib" data-act="vinvite" aria-label="Adicionar pessoas">${ic(D.userPlus, 22, '#1D1D22', 1.8)}</button><button type="button" class="vib" data-act="vback" aria-label="Abrir o chat de texto">${ic(D.bubble, 22, '#1D1D22', 1.8)}</button></header>`;
  if (!inCall) {
    const full = people.length >= 10;
    return `<div class="vp pre"><div class="vsheet" role="dialog" aria-label="Canal de voz ${esc(g.name)}">${head}
    <div class="vbody vpre">${people.length ? `<div class="vwho">${people.map((p) => `<span class="vav sm" style="background:${p.g}" title="${esc(p.name)}">${esc(p.ini)}</span>`).join('')}</div><p class="vmsg"><b>${people.length} ${people.length === 1 ? 'pessoa' : 'pessoas'} na chamada</b><br>Quando estiver pronto para conversar, basta entrar.</p>` : '<p class="vmsg"><b>Ainda não tem ninguém aqui!</b><br>Quando estiver pronto para conversar, basta entrar.</p>'}</div>
    <div class="vdock"><button type="button" class="vdb fix${off ? ' off' : ''}" data-act="mute" aria-pressed="${off}" aria-label="${off ? 'Ativar microfone' : 'Silenciar microfone'}">${ic(off ? D.micOff : D.mic, 24, off ? '#B3261E' : '#1D1D22', 1.9)}</button><button type="button" class="vdb join" data-act="vconnect"${full ? ' disabled' : ''}>${full ? 'Sala cheia' : 'Entrar na chamada de voz'}</button><button type="button" class="vdb fix" data-act="vback" aria-label="Abrir o chat de texto">${ic(D.bubble, 24, '#1D1D22', 1.8)}</button></div></div></div>`;
  }
  const tile = (p) => {
    const mine = p.id === me, st = mine ? { m: off, d: !!A.deafened, v: !!(VC && (VC.cam || VC.scr)), s: !!(VC && VC.scr) } : (A.vst[p.id] || {});
    const badges = `${st.d ? `<span class="vbd" title="Sem áudio">${ic(D.volOff, 14, '#fff', 2)}</span>` : st.m ? `<span class="vbd" title="Microfone silenciado">${ic(D.micOff, 14, '#fff', 2)}</span>` : ''}`;
    return `<div class="vt" data-vt="${esc(p.id)}"><span class="vav" style="background:${p.g}">${esc(p.ini)}</span>${st.v ? `<video class="vvid${st.s ? ' fit' : ''}" data-vs="${esc(p.id)}" autoplay playsinline muted></video>` : ''}<span class="vnm">${esc(mine ? 'Você' : p.name)}${badges}</span></div>`;
  };
  const cam = !!(VC && VC.cam), scr = !!(VC && VC.scr);
  const fx = A.vfxOpen ? fxMenuHTML() : '';
  if (isDesk()) {
    const alone = people.length <= 1, pk = A.pop ? A.pop.k : '';
    const card = `<div class="vcard"><div class="vart" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="vcb"><button type="button" class="mbtn ghost" data-act="vinvite">${ic(D.userPlus, 16, '#1D1D22', 1.8)}Convidar para voz</button><button type="button" class="mbtn ghost" data-act="toast-soon" data-msg="As atividades chegam em breve">${ic(D.apps, 16, '#1D1D22', 1.8)}Escolher atividade</button></div></div>`;
    const db = (act, icon, label, on, bad, extra = '') => `<button type="button" class="vdb${on ? ' sel' : ''}${bad ? ' off' : ''}" data-act="${act}" ${extra} aria-label="${label}" title="${label}">${ic(icon, 22, on ? '#fff' : bad ? '#B3261E' : '#1D1D22', 1.8)}</button>`;
    return `<div class="vp call desk"><header class="vph dk"><span class="vtitle">${ic(D.volume, 20, '#33333A', 1.8)}<b>${esc(g.name)}</b></span><span class="tsp"></span><button type="button" class="vib" data-act="vback" aria-label="Abrir o chat de texto" title="Chat de texto">${ic(D.bubble, 20, '#1D1D22', 1.8)}</button></header>
    <div class="vbody"><div class="vgrid n${Math.min(people.length, 10)}${alone ? ' withinv' : ''}">${people.map(tile).join('')}${alone ? card : ''}</div></div>
    <div class="vdockw dk">${fx}<button type="button" class="vcorner l" data-act="vinvite" aria-label="Convidar para voz" title="Convidar para voz">${ic(D.userPlus, 22, '#33333A', 1.8)}</button>
    <div class="vdock dk" role="toolbar" aria-label="Controles da chamada">
      <div class="vgp">${db('mute', off ? D.micOff : D.mic, off ? 'Ativar microfone' : 'Silenciar microfone', false, off, `aria-pressed="${off}"`)}<button type="button" class="vdb chev" data-act="pop" data-k="mic" aria-label="Opções do microfone" aria-expanded="${pk === 'mic'}">${ic(D.down, 12, '#33333A', 2.4)}</button>${db('vcam', cam ? D.camera : D.camOff, cam ? 'Desligar câmera' : 'Ligar câmera', cam, false, `aria-pressed="${cam}"`)}${db('vscr', D.screen, scr ? 'Parar de compartilhar a tela' : 'Compartilhar tela', scr, false, `aria-pressed="${scr}"`)}</div>
      <div class="vgp">${db('toast-soon', D.apps, 'Atividades', false, false, 'data-msg="As atividades chegam em breve"')}${db('vfx', D.party, 'Efeitos sonoros', !!A.vfxOpen, false, `aria-expanded="${!!A.vfxOpen}"`)}${db('toast-soon', D.dots, 'Mais opções', false, false, 'data-msg="Mais opções chegam em breve"')}</div>
      <button type="button" class="vdb hang" data-act="vhang" aria-label="Sair da chamada" title="Sair da chamada">${ic(D.hangup, 24, '#fff', 1.9)}</button></div>
    <span class="vcorner r"><button type="button" class="vib" data-act="toast-soon" data-msg="A janela separada chega em breve" aria-label="Abrir em outra janela" title="Abrir em outra janela">${ic(D.popout, 20, '#33333A', 1.8)}</button><button type="button" class="vib" data-act="vfull" aria-label="Tela cheia" title="Tela cheia">${ic(D.expand, 20, '#33333A', 1.8)}</button></span></div></div>`;
  }
  return `<div class="vp call"><div class="vsheet">${head}
  <div class="vbody"><div class="vgrid n${Math.min(people.length, 10)}">${people.map(tile).join('')}</div>
  ${people.length <= 1 ? `<button type="button" class="vinv" data-act="vinvite"><span class="vinvi">${ic(D.userPlus, 24, '#fff', 1.8)}</span><span class="tx"><b>Adicionar pessoas ao bate-papo em voz</b><small>Avise o grupo que você está aqui!</small></span>${ic(D.chevR, 18, '#55555F', 2.2)}</button>` : ''}</div>
  <div class="vdockw">${fx}<div class="vdock" role="toolbar" aria-label="Controles da chamada">
    <button type="button" class="vdb${cam ? ' sel' : ''}" data-act="vcam" aria-pressed="${cam}" aria-label="${cam ? 'Desligar câmera' : 'Ligar câmera'}">${ic(cam ? D.camera : D.camOff, 24, cam ? '#fff' : '#1D1D22', 1.8)}</button>
    <button type="button" class="vdb${off ? ' off' : ''}" data-act="mute" aria-pressed="${off}" aria-label="${off ? 'Ativar microfone' : 'Silenciar microfone'}">${ic(off ? D.micOff : D.mic, 24, off ? '#B3261E' : '#1D1D22', 1.9)}</button>
    <button type="button" class="vdb${scr ? ' sel' : ''}" data-act="vscr" aria-pressed="${scr}" aria-label="${scr ? 'Parar de compartilhar a tela' : 'Compartilhar tela'}">${ic(D.screen, 24, scr ? '#fff' : '#1D1D22', 1.8)}</button>
    <button type="button" class="vdb${A.vfxOpen ? ' sel' : ''}" data-act="vfx" aria-expanded="${!!A.vfxOpen}" aria-label="Efeitos sonoros">${ic(D.party, 24, A.vfxOpen ? '#fff' : '#1D1D22', 1.8)}</button>
    <button type="button" class="vdb hang" data-act="vhang" aria-label="Sair da chamada">${ic(D.hangup, 26, '#fff', 1.9)}</button></div></div></div></div>`;
}
function serverPageHTML() {
  const srv = curServer(), chObj = srv.text.find((c) => c.id === A.channel);
  if (A.vpage) { const vg = srv.voice.find((x) => x.id === A.vpage); if (vg) return voicePageHTML(srv, vg); A.vpage = null; }
  const ib = (act, icon, label, on, extra = '') => `<button type="button" class="hov sq${on ? ' sel' : ''}" data-act="${act}" ${extra} aria-label="${label}" title="${label}">${ic(icon, 20, '#33333A', 1.7)}</button>`;
  return `<header class="x-ph"><div class="pt">${ic(D.hash, 22, '#33333A', 1.7)}<h1>${esc(chObj ? chObj.name : 'Sem canal')}</h1></div><span class="tsp"></span>${ib('toast-soon', D.threads, 'Tópicos', false, 'data-msg="Os tópicos chegam em breve"')}${ib('toast-soon', D.bell, 'Configurações de notificação', false, 'data-msg="As notificações por canal chegam em breve"')}${ib('nav', D.pin, 'Mensagens fixadas', A.panel === 'pins', 'data-k="pins"')}${ib('nav', D.users, 'Lista de membros', A.showMembers, 'data-k="members"')}<button type="button" class="xsearch" data-act="nav" data-k="search" aria-label="Buscar mensagens"><span>Buscar ${esc(srv.name)}</span>${ic(D.search, 16, '#55555F', 1.8)}</button></header>
  <div class="x-pb"><div class="x-chat"><div class="msgs" id="msgs" role="log" aria-label="Mensagens" aria-live="polite">${serverMsgsHTML()}</div>${composerHTML(!!chObj, chObj ? 'Conversar em #' + chObj.name : 'Crie um canal de texto para conversar')}</div>
  ${A.showMembers ? `<aside class="x-mem" aria-label="Lista de membros">${srv.mine ? '<button type="button" class="lnk banlnk" data-act="bans">Ver banidos</button>' : ''}<div class="mlist" id="mlist">${membersListHTML()}</div></aside>` : ''}</div>`;
}
function welcomeHTML(srv, chObj) {
  if (!srv.mine) return `<div class="wlc"><h2>Bem-vindo(a) a ${esc(srv.name)}</h2><p>Este é o começo do canal #${esc(chObj ? chObj.name : '')}.</p></div>`;
  const card = (act, bg, icon, label, extra = '') => `<button type="button" class="wc" data-act="${act}" ${extra}><span class="wi" style="background:${bg}">${ic(icon, 18, '#fff', 1.8)}</span><b>${label}</b>${ic(D.chevR, 16, '#55555F', 2)}</button>`;
  return `<div class="wlc"><h2>Bem-vindo(a) a<br>${esc(srv.name)}</h2><p>Este é seu servidor, novinho em folha. Aqui vão algumas dicas para ajudar você a começar! Para mais informações, confira nosso <a href="#" data-act="soon" data-msg="O guia de como começar chega em breve">guia de como começar</a>.</p>
  <div class="wcs">${card('nav', '#9D8CCF', D.userPlus, 'Convide seus amigos', 'data-k="invite"')}${card('toast-soon', '#78BE9D', D.camera, 'Personalize seu servidor com um ícone', 'data-msg="Os ícones de servidor chegam em breve"')}${card('focus-msg', '#7DB8CF', D.send, 'Envie sua primeira mensagem')}${card('get-app', '#6CBF7E', D.download, 'Baixar o App Shiqi')}${card('toast-soon', '#E897AB', D.apps, 'Adicione seu primeiro app', 'data-msg="Os apps de servidor chegam em breve"')}${card('open-boost', '#C77DBA', D.spark, 'Desbloqueie vantagens para todos com impulsos')}</div></div>`;
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
    inner = `<h2>${first ? 'Crie seu primeiro servidor na Shiqi' : 'Criar seu servidor'}</h2><p class="sn-p">Seu servidor é onde você e seus amigos se reúnem. Crie o seu e comece a interagir.</p>
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
    <p class="sn-t">Ao criar um servidor, você concorda com as <a href="/termos" target="_blank" rel="noopener">diretrizes da comunidade</a> da Shiqi.</p>
    ${m.err ? `<div class="merr" role="alert">${esc(m.err)}</div>` : ''}
    <div class="sn-b"><button type="button" class="sn-back" data-act="sn-back">Voltar</button><button type="button" class="mbtn" data-act="modal-submit"${m.busy ? ' disabled' : ''}>${m.busy ? 'Aguarde…' : 'Criar'}</button></div>`;
  }
  const compact = step === 'start' && !first;
  return `<div class="mback" data-act="modal-bg"><div class="modal sn${compact ? ' compact' : ''}" role="dialog" aria-modal="true" aria-label="Criar servidor">${compact ? '' : `<div class="sn-art">${ILLUS}</div>`}<div class="sn-c">${x}${inner}</div></div></div>`;
}


/* ---- esqueletos (skeleton UI): blocos cinza com brilho enquanto carrega ---- */
const SKW = [[62, 88], [40, 74], [52, 92], [30, 60], [70, 84]];
const skRows = (n, av) => Array.from({ length: n }, (_, i) => `<div class="skrow"><i class="sk c" style="width:${av || 34}px;height:${av || 34}px"></i><span class="skcol"><i class="sk" style="height:11px;width:${SKW[i % 5][0]}%"></i><i class="sk" style="height:9px;width:${SKW[i % 5][1] * 0.6}%"></i></span></div>`).join('');
const skMsgs = (n) => Array.from({ length: n }, (_, i) => `<div class="skmsg"><i class="sk c" style="width:38px;height:38px"></i><span class="skcol"><i class="sk" style="height:11px;width:${24 + (i * 13) % 20}%"></i><i class="sk" style="height:10px;width:${SKW[i % 5][1]}%"></i>${i % 2 ? `<i class="sk" style="height:10px;width:${SKW[(i + 2) % 5][0]}%"></i>` : ''}</span></div>`).join('');
const skWrap = (inner, label) => `<div role="status" aria-busy="true" aria-label="${label || 'Carregando'}">${inner}</div>`;
const skMain = () => skWrap(`<div class="skmain"><div class="skhd"><i class="sk c" style="width:40px;height:40px"></i><i class="sk" style="height:14px;width:180px"></i></div><div class="skbd">${skMsgs(7)}</div></div>`, 'Carregando');

function appView() {
  if (window.SQ_SET && window.SQ_SET.def.in_vol === undefined) window.SQ_SET.def.in_vol = 100;
  const panel = A.panel ? PANELS[A.panel] : null;
  const reqRow = (p) => `<div class="it req"><button type="button" class="pf" data-act="profile" data-id="${p.id}" aria-label="Ver perfil de ${esc(p.name)}" style="background:${p.g}">${esc(p.ini)}</button><span class="tx"><b>${esc(p.name)}</b><span>Quer ser seu amigo${p.user ? ' · @' + esc(p.user) : ''}</span>${p.note ? `<span class="rnote">“${esc(p.note)}”</span>` : ''}</span><button type="button" class="mbtn sm ghost" data-act="fr-decline" data-id="${p.id}">Recusar</button><button type="button" class="mbtn sm" data-act="fr-accept" data-id="${p.id}">Aceitar</button></div>`;
  const panelHTML = panel ? `<div class="panel" role="dialog" aria-label="${panel.title}"><div class="ph"><span>${panel.title}</span><button type="button" class="hov sq" data-act="close-panel" aria-label="Fechar painel">${ic(D.close, 16, '#55555F', 1.8)}</button></div>
    ${A.panel === 'search' ? searchPanelHTML() : A.panel === 'mentions' ? mentionsPanelHTML() : A.panel === 'notif' ? (A.incoming.length ? A.incoming.map(reqRow).join('') : '<div class="it"><span>Nada por aqui ainda.</span></div>') + '<button type="button" class="it res" data-act="mentions-open"><b>Ver menções</b><span>Mensagens em que citaram você</span></button>' : panel.items.length ? panel.items.map((it) => `<div class="it"><b>${esc(it.t)}</b><span>${esc(it.s)}</span></div>`).join('') : '<div class="it"><span>Nada por aqui ainda.</span></div>'}</div>` : '';
  markCur();
  const ready = A.world === 'ready', v = A.view;
  let page;
  if (A.world === 'loading') page = skMain();
  else if (A.world === 'error') page = `<div class="x-load"><div class="hempty">${esc(A.werr)}</div><div class="hcta"><button type="button" class="mbtn" data-act="reload-world">Tentar de novo</button></div></div>`;
  else if (v === 'server' && SERVERS.length) page = serverPageHTML();
  else if (v === 'dm') page = dmPageHTML();
  else if (v === 'official') page = officialPageHTML();
  else if (v === 'shop' && window.SQ_SHOP) page = window.SQ_SHOP.shopHTML();
  else if (v === 'quests' && window.SQ_SHOP) page = window.SQ_SHOP.questsHTML();
  else if (v === 'plus' && window.SQ_SHOP) page = window.SQ_SHOP.plusHTML();
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
    case 'go-plus': return go('plus');
    case 'add-tab': A.ftab = 'add'; go('friends'); setTimeout(() => { const f = document.getElementById('af-user'); if (f) f.focus(); }, 0); return true;
    case 'ftab': A.ftab = el.dataset.k; go('friends'); if (A.ftab === 'add') setTimeout(() => { const f = document.getElementById('af-user'); if (f) f.focus(); }, 0); return true;
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
  // ações que só mexem no que já está na tela (assim as animações rodam sem recarregar tudo)
  switch (act) {
    case 'older': loadOlder(); return;
    case 'spam-show': { A.spamOk = A.spamOk || {}; A.spamOk[el.dataset.id] = 1; paintMsgs(true); return; }
    case 'fav-srv': { const l = favList(), i = l.indexOf(el.dataset.id); if (i >= 0) l.splice(i, 1); else l.push(el.dataset.id); try { localStorage.setItem('sq.favsrv.' + myId(), JSON.stringify(l)); } catch (e) { /* ok */ } toast(i >= 0 ? 'Removido dos favoritos.' : 'Servidor favoritado: fica no topo da lista.'); A.pop = null; render(); return; }
    case 'spoiler': el.classList.toggle('open'); return;
    case 'att-show': { const a = document.createElement('a'); a.className = 'att'; a.href = el.dataset.src; a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = '<img loading="lazy">'; a.firstChild.src = el.dataset.src; a.firstChild.alt = el.dataset.alt; el.replaceWith(a); return; }
    case 'copy-id': { const v = el.dataset.id || ''; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => toast('ID copiado.')).catch(() => toast('ID: ' + v)); return; }
    case 'retry-thread': { const k = curKey(); A.terr[k] = 0; ensureThread(k); paintMsgs(true); return; }
    case 'reload-world': A.world = 'loading'; render(); loadWorld(); return;
    default: break;
  }
  if (act !== 'emoji-toggle' && act !== 'emoji') A.emojiOpen = false;
  if (act !== 'sticker-toggle' && act !== 'sticker') A.stickerOpen = false;
  switch (act) {
    case 'chan': A.channel = el.dataset.id; A.draft = ''; A.vpage = null; break;
    case 'vjoin': {
      const vid = el.dataset.id; A.vfxOpen = false; A.panel = null;
      if (isDesk()) { if (A.voice === vid) A.vpage = vid; else { voiceJoin(vid); return; } }
      else { A.vpage = vid; A.drawer = false; }
      break;
    }
    case 'vfull': { const vp = document.querySelector('.vp'); try { if (document.fullscreenElement) document.exitFullscreen(); else if (vp && vp.requestFullscreen) vp.requestFullscreen(); } catch (e) { /* sem tela cheia */ } return; }
    case 'vconnect': if (A.vpage) voiceJoin(A.vpage); return;
    case 'vback': A.vpage = null; A.vfxOpen = false; break;
    case 'vopen': { const vs = SERVERS.find((x) => x.voice.some((g) => g.id === A.voice)); if (vs) { A.server = vs.id; A.view = 'server'; A.vpage = A.voice; A.panel = null; } break; }
    case 'vhang': voiceLeave(true); A.vpage = null; A.vfxOpen = false; if (window.SQ_SET) window.SQ_SET.fx('leave'); break;
    case 'vcam': voiceCam(); return;
    case 'vscr': voiceScreen(); return;
    case 'vfx': A.vfxOpen = !A.vfxOpen; break;
    case 'vsfx': voiceSfx(el.dataset.id); return;
    case 'vinvite': A.modal = { type: 'vinvite', err: '', busy: false }; break;
    case 'v-notify': { const vs = curServer(), vg = vs && vs.voice.find((x) => x.id === (A.voice || A.vpage)), tc = vs && (vs.text.find((c) => c.id === A.channel) || vs.text[0]); if (!vs || !vg || !tc) { toast('Não há um canal de texto para avisar.'); return; } sendTo(tc.id, '📞 ' + displayName() + ' está na chamada de voz «' + vg.name + '». Entre e converse com a gente!').then(() => { toast('Aviso enviado em #' + tc.name); }).catch((e) => toast(errText(e))); A.modal = null; break; }
    case 'vleave': voiceLeave(); return;
    case 'mute': A.muted = !A.muted; if (VC) voiceState(); voiceApply(); if (window.SQ_SET) window.SQ_SET.fx(A.muted ? 'mute' : 'unmute'); break;
    case 'deaf': A.deafened = !A.deafened; if (VC) voiceState(); voiceApply(); if (window.SQ_SET) window.SQ_SET.fx(A.deafened ? 'deaf' : 'undeaf'); break;
    case 'settings': if (window.SQ_SET) window.SQ_SET.open(); else toast('Não foi possível abrir as configurações.'); break;
    case 'nav': { const k = el.dataset.k; if (k === 'invite') { openInvite(); return; } if (k === 'members') A.showMembers = !A.showMembers; else { A.panel = A.panel === k ? null : k; if (A.panel === 'mentions') loadMentions(); if (A.panel === 'search') { A.sres = null; runSearch(); } } break; }
    case 'close-panel': A.panel = null; break;
    case 'otoggle': A.onlineOpen = !A.onlineOpen; break;
    case 'ftoggle': A.offlineOpen = !A.offlineOpen; break;
    case 'emoji-toggle': A.emojiOpen = !A.emojiOpen; A.stickerOpen = false; break;
    case 'sticker-toggle': A.stickerOpen = !A.stickerOpen; A.emojiOpen = false; break;
    case 'sticker': { A.stickerOpen = false; const key = A.channel; if (!key) return; render(); sendTo(key, '::sticker::' + el.dataset.ch).then(() => { if (curKey() === key) paintMsgs(true); }).catch((e) => toast(errText(e))); return; }
    case 'emoji': A.draft += el.dataset.ch; A.emojiOpen = false; render(); { const m = document.getElementById('msg'); if (m) m.focus(); } return;
    case 'send': doSend(); return;
    case 'srv-open': { selectServer(el.dataset.id); render({ scroll: true }); return; }
    case 'goto-msg': { const ch = el.dataset.ch, srv = serverOfChan(ch); A.panel = null; if (srv) { A.server = srv.id; A.channel = ch; A.view = 'server'; } else if (A.dmUser[ch]) { A.channel = ch; A.view = 'dm'; } render({ scroll: true }); return true; }
    case 'get-app': window.open('/baixar', '_blank', 'noopener'); return;
    case 'toast-soon': toast(el.dataset.msg || 'Isso chega em breve'); return;
    case 'attach': pickImage(); return;
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
    else if (t.dataset.appBind.startsWith('m:')) { if (A.modal) { A.modal[t.dataset.appBind.slice(2)] = t.value; if (A.modal.type === 'qs') { const r = document.getElementById('qsres'); if (r) r.innerHTML = qsResHTML(A.modal.q); } } }
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
  const t = e.target, b = t.dataset.bind;
  if (!b) return;
  if (t.type === 'checkbox') setPath(b, t.checked);
  else if (t.tagName === 'SELECT') { setPath(b, t.value); if (S.r.touched) render(); }
});
$root.addEventListener('keydown', (e) => {
  if (e.target.id === 'msg' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  if (e.target.id === 'af-user' && e.key === 'Enter') { e.preventDefault(); afSend(); }
  if (e.target.id === 'qs-in' && e.key === 'Enter') { e.preventDefault(); const b = document.querySelector('#qsres .qr'); if (b) b.click(); }
  if (e.target.matches && e.target.matches('.modal input[data-mf]') && e.key === 'Enter') { e.preventDefault(); modalSubmit(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.view === 'app' && A.modal) { closeModal(); return; }
  if (e.key === 'Escape' && S.view === 'app' && (A.panel || A.emojiOpen || A.pop || A.drawer)) { A.panel = null; A.emojiOpen = false; A.pop = null; A.drawer = false; render(); }
});
$root.addEventListener('submit', (e) => {
  e.preventDefault();
  const fn = { login: doLogin, logintotp: doLoginTotp, register: doRegister, verify: doVerify, forgot: doForgot, newpass: doReset }[e.target.dataset.form];
  if (fn) fn();
});
$root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (S.view === 'app') {
    if (el) { appAction(el.dataset.act, el, e); return; }
    if (A.emojiOpen || (A.pop && !e.target.closest('.pop'))) { A.emojiOpen = false; if (!e.target.closest('.pop')) A.pop = null; render(); }
    return;
  }
  if (!el) return;
  switch (el.dataset.act) {
    case 'login-rec': S.lRecUse = !S.lRecUse; S.lCode = ''; render(); break;
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
    case 'to-totp': S.lTotp = true; S.lCode = ''; S.lErr = ''; S.lTouched = false; S.lMfa = false; render(); break;
    case 'to-pw': S.lTotp = false; S.lCode = ''; S.lErr = ''; S.lTouched = false; render(); break;
    case 'to-forgot': S.f.err = ''; go('forgot'); break;
    case 'to-app': go('app'); break;
    case 'resend': doResend(); break;
    case 'resend-reset': doResendReset(); break;
    case 'manual-code': S.n = Object.assign(freshN(), { email: S.f.email, manual: true }); S.view = 'newPass'; history.replaceState(null, '', location.pathname + '#new-password'); render({ top: true }); setTimeout(() => { const f = document.querySelector('[data-autofocus]'); if (f) f.focus(); }, 0); break;
    case 'qr-new': qrStart(); break;
    case 'soon': e.preventDefault(); toast(el.dataset.msg || 'Em breve'); break;
    case 'get-app': e.preventDefault(); window.open('/baixar', '_blank', 'noopener'); break;
    case 'qr-approve': decideApprove('approve'); break;
    case 'qr-deny': decideApprove('deny'); break;
    default: break;
  }
});
addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.view === 'login' && S.qr && S.qr.state === 'ready') qrTick(); });

/* --------------------------------------------------------------- boot */
/* Apertar para Falar: segure Ctrl direito enquanto estiver numa sala de voz */
(function ptt() {
  const set = (v, e) => { if (!A || !!A.pttDown === v) return; A.pttDown = v; voiceApply(); const el = document.querySelector('.x-ptt'); if (el) el.classList.toggle('on', v); };
  window.addEventListener('keydown', (e) => { if (e.code === 'ControlRight') set(true); });
  window.addEventListener('keyup', (e) => { if (e.code === 'ControlRight') set(false); });
  window.addEventListener('blur', () => set(false));
})();
(async function boot() {
  S.session = store.get('sq.session'); S.profile = store.get('sq.profile');
  if (S.session) {
    const t = await freshToken();
    if (t && !S.profile) await loadProfile();
  }
  route();
})();
try { window.matchMedia('(min-width:901px)').addEventListener('change', () => { if (S.view === 'app' && A && (A.vpage || A.voice)) render(); }); } catch (e) { /* navegador antigo */ }
})();
