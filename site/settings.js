(() => {
'use strict';

/* =====================================================================
   Square. — Configurações (janela própria, fora do #root, para não ser
   apagada quando o painel se redesenha). As páginas ficam em settings-pages.js.
   Preferências: guardadas no navegador (por conta) e na conta (profiles.settings).
   ===================================================================== */

const SET = window.SQ_SET = { pages: [], def: {}, groups: [] };
const api = () => window.SQ_API || {};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
SET.esc = esc;

/* ------------------------------------------------------------ preferências */
let prefs = {};
let uid = '';
let saveT = null;
const lsKey = () => 'sq.prefs.' + (uid || 'anon');
const lsGet = () => { try { return JSON.parse(localStorage.getItem(lsKey()) || '{}') || {}; } catch (e) { return {}; } };
const lsSet = (o) => { try { localStorage.setItem(lsKey(), JSON.stringify(o)); } catch (e) { /* sem armazenamento */ } };
const P = SET.P = (k) => (prefs[k] !== undefined ? prefs[k] : SET.def[k]);

function persist() {
  prefs._t = Date.now();
  lsSet(prefs);
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const a = api();
    if (a.rpc && uid) a.rpc('save_my_settings', { p: prefs }).catch(() => { /* fica só no navegador */ });
  }, 900);
}
const setP = SET.setP = (k, v) => { if (k === 'theme' && !P('sync_theme')) { try { localStorage.setItem('sq.theme.local', v); } catch (e) { /* ok */ } } prefs[k] = v; persist(); applyAll(); syncControls(); };
SET.resetKeys = (keys) => { keys.forEach((k) => { delete prefs[k]; }); persist(); applyAll(); syncControls(); };

/* boot: chamado pelo app depois do login */
SET.boot = async (userId) => {
  if (!userId) return;
  if (uid !== userId) { uid = userId; prefs = lsGet(); applyAll(); }
  const a = api();
  if (!a.rpc) return;
  try {
    const remote = await a.rpc('get_my_settings');
    if (remote && typeof remote === 'object' && (remote._t || 0) > (prefs._t || 0)) { prefs = remote; lsSet(prefs); applyAll(); syncControls(); }
  } catch (e) { /* sem conexão: usa as do navegador */ }
};
SET.forget = () => { uid = ''; prefs = {}; applyAll(); };

/* ---------------------------------------------------------- efeitos reais */
const root = document.documentElement;
try { if (localStorage.getItem('sq.theme.last') === 'dark') { root.dataset.theme = 'dark'; root.style.filter = 'invert(1) hue-rotate(180deg)'; } } catch (e) { /* ok */ }
const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const ICON_COLORS = [['#44444C', '#8A8AF0'], ['#1D1D22', '#FFFFFF'], ['#FFFFFF', '#1D1D22'], ['#5B5BD6', '#FFFFFF'], ['#D92D45', '#FFFFFF'], ['#1B6B47', '#FFFFFF'], ['#E8A33D', '#1D1D22'], ['#2A9FD6', '#FFFFFF'], ['#9B5DE5', '#FFFFFF'], ['#F15BB5', '#FFFFFF'], ['#00BBF9', '#1D1D22'], ['#8AC926', '#1D1D22'], ['#FF6B35', '#FFFFFF'], ['#3A0CA3', '#F72585'], ['#06D6A0', '#073B4C'], ['#EF476F', '#FFD166'], ['#264653', '#E9C46A'], ['#6D597A', '#E56B6F'], ['#0B132B', '#5BC0BE'], ['#FFE066', '#1D1D22']];
SET.ICON_COLORS = ICON_COLORS;
const iconSvg = (i) => { const c = ICON_COLORS[i] || ICON_COLORS[0]; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${c[0]}"/><rect x="18" y="18" width="28" height="28" rx="7" fill="${c[1]}"/></svg>`; };
SET.iconSvg = iconSvg;

/* tema: claro, escuro ou automático; se "Sincronizar tema" estiver desligado, a escolha vale só neste aparelho */
const themeChoice = () => { let t = P('theme'); if (!P('sync_theme')) { try { t = localStorage.getItem('sq.theme.local') || t; } catch (e) { /* ok */ } } return t === 'dark' || t === 'auto' ? t : 'light'; };
const themeIsDark = () => { const t = themeChoice(); return t === 'dark' || (t === 'auto' && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)); };
if (window.matchMedia) { const dq = window.matchMedia('(prefers-color-scheme: dark)'); (dq.addEventListener ? dq.addEventListener.bind(dq, 'change') : dq.addListener.bind(dq))(() => { if (themeChoice() === 'auto') applyAll(); }); }
function applyAll() {
  if (window.SQ_API && window.SQ_API.voiceApply) window.SQ_API.voiceApply();
  if (window.SQ_API && window.SQ_API.syncSend) window.SQ_API.syncSend();
  const reduce = !!P('reduce_motion') || (P('sync_motion') && mq && mq.matches);
  root.classList.toggle('pf-reduce', !!reduce);
  root.classList.toggle('pf-compact', P('chat_display') === 'compact');
  root.classList.toggle('pf-noav', !P('show_avatars'));
  root.classList.toggle('pf-noatt', !P('msg_attach'));
  root.classList.toggle('pf-noemoanim', P('play_emoji') === false);
  root.classList.toggle('pf-nostream-inv', false);
  root.classList.toggle('pf-streamer', !!P('streamer'));
  root.classList.toggle('pf-hide-inv', !!P('streamer') && !!P('s_hide_invite'));
  root.classList.toggle('pf-hide-personal', !!P('streamer') && !!P('s_hide_personal'));
  root.style.setProperty('--chatfs', (Number(P('chat_fs')) || 14.5) + 'px');
  root.style.setProperty('--msgap', (Number(P('group_gap')) || 0) + 'px');
  const sat = Number(P('saturation')); const dark = themeIsDark(); root.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('sq.theme.last', dark ? 'dark' : 'light'); } catch (e) { /* sem armazenamento */ }
  const tm = document.querySelector('meta[name="theme-color"]'); if (tm) tm.content = dark ? '#0B0B0F' : '#F4F4F8';
  root.style.filter = [dark ? 'invert(1) hue-rotate(180deg)' : '', sat && sat < 100 ? 'saturate(' + sat / 100 + ')' : ''].filter(Boolean).join(' ');
  const z = Number(P('zoom')); const r = document.getElementById('root'); if (r) r.style.zoom = z && z !== 100 ? String(z / 100) : '';
  root.dataset.side = P('side_density');
  const fav = document.querySelector('link[rel="icon"]');
  if (fav) { const n = Number(P('app_icon')) || 0; fav.type = n ? 'image/svg+xml' : 'image/svg+xml'; fav.href = n ? 'data:image/svg+xml,' + encodeURIComponent(iconSvg(n)) : '/favicon.svg'; }
}

/* hora das mensagens (Idioma e Horário) */
SET.hm = (d) => {
  const f = P('time_fmt'), h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  if (f === '12' || (f === 'auto' && /[ap]m/i.test(new Date(2020, 0, 1, 15).toLocaleTimeString([], {})) && false)) { const hh = h % 12 || 12; return hh + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM'); }
  return String(h).padStart(2, '0') + ':' + m;
};

/* ----------------------------------------------------------------- sons */
let actx = null;
const TONES = { none: null, bell: [880, 1320], drop: [660, 440], pulse: [520, 520, 780] };
function tone(seq, vol) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    let t = actx.currentTime;
    seq.forEach((f) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.25 * vol), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.2); t += 0.12;
    });
  } catch (e) { /* sem áudio */ }
}
const FX = { mute: [440, 330], unmute: [330, 440], deaf: [440, 260], undeaf: [260, 440], join: [523, 784], leave: [784, 523], cam_on: [600, 800], cam_off: [800, 600], disconnect: [400, 300, 200], message: [740, 988] };
SET.fxList = FX;
SET.fx = (name, force) => {
  if (!force && (P('n_mute_all') || (P('streamer') && P('s_mute_sfx')))) return;
  const seq = FX[name]; if (!seq) return;
  if (!force && P('fx_' + name) === false) return;
  tone(seq, (Number(P('fx_vol')) || 100) / 100);
};
SET.entrySound = (sid) => { if (P('join_server') && P('join_server') !== 'all' && sid && P('join_server') !== sid) return; const s = TONES[P('join_sound')]; if (s) tone(s, (Number(P('fx_vol')) || 100) / 100); };
SET.tones = TONES;
SET.notify = (kind, title, body) => {
  if (P('n_mute_all') === false || true) { /* sons ficam em SET.fx */ }
  if (kind === 'message' && !P('n_mute_all') && !(P('streamer') && P('s_mute_sfx'))) tone(FX.message, (Number(P('fx_vol')) || 100) / 100);
  if (P('n_desktop') && document.hidden && !(P('streamer') && P('s_mute_notif')) && 'Notification' in window && Notification.permission === 'granted') {
    const show = () => { if (!document.hidden) return; try { new Notification(title, { body: P('n_preview') ? body : 'Nova mensagem', icon: '/favicon.svg', silent: true }); } catch (e) { /* ok */ } };
    const dl = Number(P('n_delay')) || 0;
    if (dl) setTimeout(show, dl * 60000); else show();
  }
};
SET.audioConstraints = () => {
  const pr = P('input_profile');
  const base = pr === 'isolation' ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : pr === 'studio' ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : { echoCancellation: !!P('echo'), noiseSuppression: P('noise') !== 'off', autoGainControl: !!P('auto_gain') };
  const dev = P('in_device'); if (dev && dev !== 'default') base.deviceId = { ideal: dev };
  return base;
};
SET.outputVolume = () => Math.max(0, Math.min(1, (Number(P('out_vol')) || 100) / 100));
SET.outputDevice = () => P('out_device') || 'default';

/* título com bolinha de não lidas (Notificações > Insígnias) */
setInterval(() => {
  const a = api(); if (!a.unread) return;
  const n = a.unread(); const base = 'Square.';
  document.title = n && P('n_badge') ? '(•) ' + base : base;
}, 2000);

/* -------------------------------------------------------------- janela */
let el = null, state = { page: 'account', sub: '', mobilePage: false, q: '', open: false, modal: null, ret: null };
SET.state = state;
const pageById = (id) => SET.pages.find((p) => p.id === id);

function ensureRoot() {
  if (el) return el;
  el = document.createElement('div'); el.id = 'setroot'; el.hidden = true;
  document.body.appendChild(el);
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  el.addEventListener('change', onChange);
  return el;
}

SET.open = (pageId) => {
  ensureRoot();
  state.ret = document.activeElement;
  state.open = true; state.q = ''; state.modal = null;
  if (pageId && pageById(pageId)) { state.page = pageId; state.mobilePage = true; } else state.mobilePage = false;
  state.sub = '';
  el.hidden = false; document.body.classList.add('set-open');
  draw();
  const c = el.querySelector('.scontent'); if (c) c.scrollTop = 0;
  const f = el.querySelector('.sclose'); if (f) f.focus();
};
SET.close = () => {
  if (!el || !state.open) return;
  state.open = false; if (window.SQ_PERFIL && window.SQ_PERFIL.isOpen()) window.SQ_PERFIL.close(); el.hidden = true; el.innerHTML = ''; document.body.classList.remove('set-open');
  if (state.ret && state.ret.focus && document.contains(state.ret)) { try { state.ret.focus(); } catch (e) { /* ok */ } }
};
SET.isOpen = () => !!state.open;

const NAV_ICONS = {
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  privacy: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M12 8v5M12 16v.5"/>',
  msgs: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8"/>',
  notif: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  boost: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 8l3 1.7v3.6L12 15l-3-1.7V9.7z"/>',
  subs: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v2M12 16v2"/>',
  gifts: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 6h18v3H3zM12 6v14M12 6c-1-3-5-3-4-1M12 6c1-3 5-3 4-1"/>',
  billing: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>',
  voice: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  look: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2.2-.5-1.2.2-2.3 1.5-2.3H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  access: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="7.5" r="1.3"/><path d="M7.5 10.5l4.5 1 4.5-1M12 11.5v3l-2 4M12 14.5l2 4"/>',
  system: '<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M7 11h.01M10 11h.01M13 11h.01M16 11h.01M8 15h8"/>',
  lang: '<path d="M4 6h9M8.5 4v2M6 6c.5 3 3 5.5 6 6.5M12 6c-.5 3-3 5.5-6 6.5"/><path d="M12 20l4.5-10L21 20M13.5 17h6"/>',
  activity: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5"/><path d="M17 11l1.2 2.3 2.3.4-1.7 1.7.4 2.4-2.2-1.2-2.2 1.2.4-2.4-1.7-1.7 2.3-.4z"/>',
  apps: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
  dev: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'
};
SET.navIcon = (id, s = 20, c = '#55555F') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAV_ICONS[id] || ''}</svg>`;

function navHTML() {
  const q = state.q.trim().toLowerCase();
  const match = (p) => !q || (p.label + ' ' + (p.subs || []).map((s) => s.label).join(' ') + ' ' + (p.kw || '')).toLowerCase().indexOf(q) !== -1;
  let out = '', any = false;
  SET.groups.forEach((g) => {
    const items = g.pages.map(pageById).filter(Boolean).filter(match);
    if (!items.length) return;
    any = true;
    out += `<div class="sgroup">${g.title ? `<div class="sgt">${esc(g.title)}</div>` : ''}${items.map((p) => {
      const on = state.page === p.id && !(state.mobilePage === false && window.innerWidth <= 760 && false);
      const subs = on && p.subs && !q ? `<div class="ssubs" role="group">${p.subs.map((s) => `<button type="button" class="ssub${state.sub === s.id ? ' on' : ''}" data-sa="sub" data-id="${s.id}">${esc(s.label)}</button>`).join('')}</div>` : '';
      return `<button type="button" class="snavb${on ? ' on' : ''}" data-sa="page" data-id="${p.id}" aria-current="${on}">${SET.navIcon(p.icon || p.id, 20, on ? '#1D1D22' : '#62626D')}<span>${esc(p.label)}</span></button>${subs}`;
    }).join('')}</div>`;
  });
  return any ? out : '<p class="snone">Nenhuma configuração encontrada.</p>';
}

function profileHeadHTML() {
  const a = api(), me = (a.me && a.me()) || {}, name = me.name || (a.displayName && a.displayName()) || 'Você';
  const av = `<span class="spic" style="background:${esc(me.g || '#C9B8F0')};${me.avatar ? 'background-size:cover' : ''}">${me.avatar ? '' : esc((name.charAt(0) || '?').toUpperCase())}</span>`;
  return `<div class="sprof">${av}<div class="spt"><b>${esc(name)}</b><button type="button" class="sedit" data-sa="edit-profile">Editar perfis <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/></svg></button></div><button type="button" class="sclose mclose" data-sa="close" aria-label="Fechar configurações"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#33333A" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
}

function draw() {
  if (!el || !state.open) return;
  const p = pageById(state.page) || SET.pages[0];
  el.innerHTML = `<div class="sback" data-sa="close-bg"><div class="set${state.mobilePage ? ' pg' : ''}" role="dialog" aria-modal="true" aria-label="Configurações">
<aside class="snav" aria-label="Menu de configurações">
${profileHeadHTML()}
<label class="ssearch"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#62626D" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg><input id="sset-q" type="search" placeholder="Buscar" value="${esc(state.q)}" autocomplete="off" aria-label="Buscar nas configurações"></label>
<nav class="snavl" id="snavl">${navHTML()}
<div class="sgroup"><button type="button" class="snavb out" data-sa="logout"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D92D45" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9"/></svg><span>Sair</span></button></div>
</nav>
<div class="sver"><span>Square · versão 1.0</span><span><a href="/privacidade" target="_blank" rel="noopener">Política de privacidade</a> • <a href="/termos" target="_blank" rel="noopener">Termos de serviço</a></span></div>
</aside>
<section class="smain"><header class="shead"><button type="button" class="sback" data-sa="mback" aria-label="Voltar ao menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D1D22" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><h1 id="sttl">${esc(p.title || p.label)}</h1><button type="button" class="sclose" data-sa="close" aria-label="Fechar configurações"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#33333A" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
<div class="scontent" id="scontent" tabindex="-1"><div class="sinner" id="sinner">${typeof p.render === 'function' ? p.render() : ''}</div></div></section>
</div>${state.modal ? modalHTML() : ''}</div>`;
  syncControls();
  watchScroll();
  if (typeof p.after === 'function') p.after(el);
}

function drawMain(keepScroll) {
  if (!el || !state.open) return;
  const p = pageById(state.page) || SET.pages[0];
  const c = document.getElementById('scontent'), top = c ? c.scrollTop : 0;
  const inner = document.getElementById('sinner'); if (inner) inner.innerHTML = typeof p.render === 'function' ? p.render() : '';
  const t = document.getElementById('sttl'); if (t) t.textContent = p.title || p.label;
  const nav = document.getElementById('snavl'); if (nav) { const keep = nav.scrollTop; nav.innerHTML = navHTML() + navTail(); nav.scrollTop = keep; }
  el.querySelector('.set').classList.toggle('pg', !!state.mobilePage);
  if (c) c.scrollTop = keepScroll ? top : 0;
  syncControls(); watchScroll();
  if (typeof p.after === 'function') p.after(el);
}
const navTail = () => '<div class="sgroup"><button type="button" class="snavb out" data-sa="logout"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D92D45" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9"/></svg><span>Sair</span></button></div>';

SET.redraw = () => drawMain(true);
SET.modal = (m) => { state.modal = m; const old = el && el.querySelector('.smback'); if (old) old.remove(); if (m && el) { const w = el.querySelector('.sback'); if (w) w.insertAdjacentHTML('beforeend', modalHTML()); const f = el.querySelector('.smodal input,.smodal button'); if (f) f.focus(); } };
function modalHTML() {
  const m = state.modal; if (!m) return '';
  return `<div class="smback" data-sa="modal-bg"><div class="smodal" role="dialog" aria-modal="true" aria-label="${esc(m.title)}"><h2>${esc(m.title)}</h2><div class="smbody" id="smbody">${m.body || ''}</div><div class="smfoot">${(m.actions || []).map((b) => `<button type="button" class="sbtn ${b.cls || ''}" data-sa="${esc(b.act)}"${b.id ? ` data-id="${esc(b.id)}"` : ''}>${esc(b.label)}</button>`).join('')}</div></div></div>`;
}

/* ------------------------------------------------ sincroniza controles */
function syncControls() {
  if (!el || !state.open) return;
  el.querySelectorAll('[data-k]').forEach((n) => {
    const k = n.dataset.k, v = P(k);
    if (n.classList.contains('stg')) { n.setAttribute('aria-checked', String(!!v)); n.classList.toggle('on', !!v); }
    else if (n.classList.contains('sradio')) { const on = String(v) === n.dataset.v; n.setAttribute('aria-checked', String(on)); n.classList.toggle('on', on); }
    else if (n.tagName === 'SELECT') { if (String(n.value) !== String(v)) n.value = String(v); }
    else if (n.type === 'range') { if (document.activeElement !== n) n.value = String(v); const o = n.parentElement.querySelector('output'); if (o) o.textContent = n.dataset.fmt ? SET.fmt[n.dataset.fmt](Number(v)) : String(v); paintRange(n); }
    else if (n.classList.contains('sicon')) { const on = Number(v) === Number(n.dataset.v); n.classList.toggle('on', on); n.setAttribute('aria-pressed', String(on)); }
    else if (n.classList.contains('stab')) { n.classList.toggle('on', n.dataset.v === String(state['tab_' + k] || n.dataset.def)); }
  });
}
SET.fmt = { pct: (v) => v + '%', px: (v) => v + 'px', x: (v) => 'x' + Number(v).toFixed(1), plain: (v) => String(v) };
function paintRange(n) { const mn = Number(n.min || 0), mx = Number(n.max || 100), v = Number(n.value); n.style.setProperty('--pc', ((v - mn) / (mx - mn)) * 100 + '%'); }

/* rolagem: marca o subitem visível */
let scrollEl = null, scrollFn = null;
function watchScroll() {
  if (scrollEl && scrollFn) scrollEl.removeEventListener('scroll', scrollFn);
  scrollEl = document.getElementById('scontent'); if (!scrollEl) return;
  const p = pageById(state.page);
  if (!p || !p.subs || !p.subs.length) { state.sub = ''; return; }
  scrollFn = () => {
    const top = scrollEl.getBoundingClientRect().top + 40;
    let cur = p.subs[0].id;
    p.subs.forEach((s) => { const n = document.getElementById('ss-' + s.id); if (n && n.getBoundingClientRect().top <= top) cur = s.id; });
    if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 4) cur = p.subs[p.subs.length - 1].id;
    if (cur !== state.sub) { state.sub = cur; el.querySelectorAll('.ssub').forEach((b) => b.classList.toggle('on', b.dataset.id === cur)); }
  };
  scrollEl.addEventListener('scroll', scrollFn, { passive: true });
  scrollFn();
}

/* ------------------------------------------------------------ eventos */
SET.acts = {};
function onClick(ev) {
  const t = ev.target.closest('[data-sa],[data-k]');
  if (!t) return;
  const k = t.dataset.k;
  if (k && t.classList.contains('stg')) { if (t.disabled) return; const v = !P(k); setP(k, v); if (SET.onToggle) SET.onToggle(k, v); return; }
  if (k && t.classList.contains('sradio')) { if (t.disabled) return; setP(k, t.dataset.v); return; }
  if (k && t.classList.contains('sicon')) { if (t.dataset.lock === '1') { api().toast && api().toast('Mais ícones chegam com o Square Plus (pagamentos ainda não existem).'); return; } setP(k, Number(t.dataset.v)); return; }
  if (k && t.classList.contains('stab')) { state['tab_' + k] = t.dataset.v; drawMain(true); return; }
  const a = t.dataset.sa; if (!a) return;
  if (a === 'close-bg') { if (ev.target === t) SET.close(); return; }
  if (a === 'modal-bg') { if (ev.target === t) SET.modal(null); return; }
  if (a === 'close') { SET.close(); return; }
  if (a === 'page') { state.page = t.dataset.id; state.sub = ''; state.mobilePage = true; drawMain(false); return; }
  if (a === 'mback') { state.mobilePage = false; drawMain(true); return; }
  if (a === 'sub') { const n = document.getElementById('ss-' + t.dataset.id); state.sub = t.dataset.id; el.querySelectorAll('.ssub').forEach((b) => b.classList.toggle('on', b.dataset.id === state.sub)); if (n) n.scrollIntoView({ behavior: P('reduce_motion') ? 'auto' : 'smooth', block: 'start' }); return; }
  if (a === 'goto') { state.page = t.dataset.id; state.sub = ''; state.mobilePage = true; drawMain(false); return; }
  if (a === 'logout') { SET.close(); const f = api().logout; if (f) f(); return; }
  if (a === 'edit-profile') { SET.close(); const f = api().editProfile; if (f) f(); return; }
  if (a === 'modal-close') { SET.modal(null); return; }
  if (a === 'toggle-open') { const id = t.dataset.id; state['open_' + id] = !state['open_' + id]; drawMain(true); return; }
  if (SET.acts[a]) SET.acts[a](t, ev);
}
function onInput(ev) {
  const t = ev.target;
  if (t.id === 'sset-q') { state.q = t.value; const nav = document.getElementById('snavl'); if (nav) nav.innerHTML = navHTML() + navTail(); return; }
  if (t.type === 'range' && t.dataset.k) { const v = Number(t.value); prefs[t.dataset.k] = v; paintRange(t); const o = t.parentElement.querySelector('output'); if (o) o.textContent = t.dataset.fmt ? SET.fmt[t.dataset.fmt](v) : String(v); applyAll(); clearTimeout(t._d); t._d = setTimeout(persist, 250); return; }
  if (SET.onInput) SET.onInput(t, ev);
}
function onChange(ev) {
  const t = ev.target;
  if (t.tagName === 'SELECT' && t.dataset.k) { setP(t.dataset.k, t.value); if (SET.onToggle) SET.onToggle(t.dataset.k, t.value); }
}
document.addEventListener('keydown', (ev) => {
  if (!state.open) return;
  if (ev.key === 'Escape') { ev.stopPropagation(); if (state.modal) SET.modal(null); else if (SET.langOpen) { SET.langOpen = false; drawMain(true); } else SET.close(); }
}, true);

/* ----------------------------------------------- blocos de construção */
SET.h2 = (id, title, desc) => `<h2 class="sh2" id="ss-${id}">${esc(title)}</h2>${desc ? `<p class="sdesc">${desc}</p>` : ''}`;
SET.hr = () => '<hr class="shr">';
SET.tg = (k, label, desc, o = {}) => `<div class="srow${o.sub ? ' sub' : ''}"><div class="stx"><b>${esc(label)}</b>${desc ? `<small>${desc}</small>` : ''}</div><button type="button" class="stg" role="switch" data-k="${k}" aria-checked="false" aria-label="${esc(label)}"${o.dis ? ' disabled' : ''}><i></i></button></div>`;
SET.rd = (k, label, desc, opts, o = {}) => `<div class="sgrp" role="radiogroup" aria-label="${esc(label || k)}">${label ? `<b class="sgl">${esc(label)}</b>` : ''}${desc ? `<small class="sgd">${desc}</small>` : ''}${opts.map((x) => `<button type="button" class="sradio" role="radio" data-k="${k}" data-v="${esc(x[0])}" aria-checked="false"><i></i><span>${esc(x[1])}${x[2] ? `<small>${x[2]}</small>` : ''}</span></button>`).join('')}</div>`;
SET.sel = (k, label, desc, opts, o = {}) => `<div class="sgrp">${label ? `<label class="sgl" for="sel-${k}">${esc(label)}</label>` : ''}${desc ? `<small class="sgd">${desc}</small>` : ''}<select id="sel-${k}" class="ssel" data-k="${k}"${o.dis ? ' disabled' : ''}>${opts.map((x) => `<option value="${esc(x[0])}">${esc(x[1])}</option>`).join('')}</select></div>`;
SET.range = (k, label, desc, o) => `<div class="sgrp">${label ? `<label class="sgl" for="rg-${k}">${esc(label)}</label>` : ''}${desc ? `<small class="sgd">${desc}</small>` : ''}<div class="srange${o.cls ? ' ' + o.cls : ''}"><input id="rg-${k}" type="range" min="${o.min}" max="${o.max}" step="${o.step || 1}" data-k="${k}"${o.fmt ? ` data-fmt="${o.fmt}"` : ''}>${o.ticks ? `<div class="sticks">${o.ticks.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}<output class="sout">${''}</output></div></div>`;
SET.btnRow = (title, desc, label, act, cls, id) => `<div class="srow"><div class="stx"><b>${title}</b>${desc ? `<small>${desc}</small>` : ''}</div><button type="button" class="sbtn ${cls || ''}" data-sa="${act}"${id ? ` data-id="${id}"` : ''}>${esc(label)}</button></div>`;
SET.link = (title, desc, icon, page) => `<button type="button" class="slink" data-sa="goto" data-id="${page}"><span class="sli">${SET.navIcon(icon, 22, '#33333A')}</span><span class="stx"><b>${esc(title)}</b><small>${desc}</small></span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#55555F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>`;
SET.info = (text, btn, act) => `<div class="sinfo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B3B96" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg><span>${text}</span>${btn ? `<button type="button" class="sbtn" data-sa="${act}">${esc(btn)}</button>` : ''}</div>`;
SET.expand = (id, label, desc, inner) => `<div class="sexp"><button type="button" class="sexph" data-sa="toggle-open" data-id="${id}" aria-expanded="${!!state['open_' + id]}"><span class="stx"><b>${esc(label)}</b>${desc ? `<small>${esc(desc)}</small>` : ''}</span><svg class="chev${state['open_' + id] ? ' up' : ''}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#33333A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>${state['open_' + id] ? `<div class="sexpb">${inner}</div>` : ''}</div>`;
SET.isOpenSec = (id) => !!state['open_' + id];
SET.setState = (k, v) => { state[k] = v; };
SET.getState = (k) => state[k];
SET.apply = applyAll;
SET.sync = syncControls;
SET.toast = (t) => { const a = api(); if (a.toast) a.toast(t); };
})();
