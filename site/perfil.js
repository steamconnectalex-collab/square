(() => {
'use strict';

/* =====================================================================
   Shiqi. — Perfil do usuário (editor). Abre por "Editar perfil" (window.SQ_PERFIL.open()).
   Grava no banco: nome exibido, status, bio, cor da faixa e foto.
   Guardado só neste navegador (por conta): pronomes, "última música", nota, widgets e fotos recentes.
   Decorações, efeitos, molduras e placas são itens da Loja; como ainda não há compra, ficam bloqueados.
   ===================================================================== */

const api = () => window.SQ_API || {};
const shop = () => window.SQ_SHOP || null;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (d, s = 18, c = '#33333A', w = 1.7) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  x: '<path d="M6 6l12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  none: '<circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/>', shop: '<path d="M4 9h16l-1-4H5z"/><path d="M5 9v10h14V9"/><path d="M9 19v-5h6v5"/>',
  d: '<path d="m6 9 6 6 6-6"/>', ll: '<path d="m11 6-6 6 6 6M18 6l-6 6 6 6"/>', rr: '<path d="m13 6 6 6-6 6M6 6l6 6-6 6"/>',
  chat: '<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>', gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M3 9h18"/><path d="M12 9c-3 0-4-4-1.5-4S12 9 12 9zm0 0c3 0 4-4 1.5-4S12 9 12 9z"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>', coin: '<circle cx="12" cy="12" r="8.5"/><path d="m12 7.5 1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>', imgs: '<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M7 20h12a2 2 0 0 0 2-2V8"/>',
  rot: '<path d="M4 12a8 8 0 1 1 3 6.2M4 12V6m0 6h6"/>', eye: '<path d="m4 20 6-6M14 6l4 4-8 8H6v-4zM16 4l4 4"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  pen: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>', music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>', user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>', heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'
};

const me = () => (api().me && api().me()) || {};
const uid = () => me().id || 'anon';
const lsKey = () => 'sq.perfil.' + uid();
const getX = () => { try { return JSON.parse(localStorage.getItem(lsKey()) || '{}') || {}; } catch (e) { return {}; } };
const setX = (o) => { try { localStorage.setItem(lsKey(), JSON.stringify(o)); } catch (e) { /* sem armazenamento */ } };
const toast = (m) => { const t = api().toast; if (t) t(m); };

const WIDGETS = [['w1', 'Jogo favorito'], ['w2', 'Jogos que eu gosto'], ['w3', 'Jogo da semana'], ['w4', 'Jogos em rotação'], ['w5', 'Quero jogar'], ['w6', 'Jogo em destaque']];
const MONTHS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const PRESETS = ['#9D8CCF', '#D6D8FF', '#78BE9D', '#EBBA6C', '#E897AB'];

let P = null; /* estado da janela (null = fechada) */
let root = null;

/* ------------------------------------------------------------ cores */
const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgb2hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
function rgb2hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx]; }
function hsv2rgb(h, s, v) { const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c; let r = 0, g = 0, b = 0; if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }
const isHex = (v) => /^#[0-9A-Fa-f]{6}$/.test(v);

/* ------------------------------------------------------------ peças */
function avatarBox(size, cls) {
  const m = me(), bg = P.pendingAvatar ? `url('${P.pendingAvatar}') center/cover no-repeat` : (m.g || '#9D8CCF');
  return `<span class="pav ${cls || ''}" style="width:${size}px;height:${size}px;background:${bg};font-size:${Math.round(size * 0.42)}px">${P.pendingAvatar || m.avatar ? '' : esc(m.ini || (m.name || '?').charAt(0).toUpperCase())}</span>`;
}
function since() {
  const d = new Date(me().since || Date.now());
  return isNaN(d) ? '' : `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}
const dirty = () => { const m = me(); return P.name.trim() !== (m.name || '') || P.status !== (m.status || '') || P.bio !== (m.bio || '') || P.accent.toLowerCase() !== (m.accent || '#9D8CCF').toLowerCase() || !!P.pendingBlob || P.removeAvatar; };

function leftHTML() {
  const slot = (act, inner, cls, msg) => `<button type="button" class="pslot ${cls || ''}" data-pf="${act}"${msg ? ` data-msg="${esc(msg)}"` : ''}>${inner}</button>`;
  return `<aside class="pf-left" aria-label="Editar perfil">
  <div class="pf-lh"><button type="button" class="pf-prof" data-pf="profmenu" aria-haspopup="true" aria-expanded="${!!P.profMenu}">Perfil principal ${ic(I.d, 14, 'currentColor', 2.2)}</button><button type="button" class="hov sq pf-col" data-pf="collapse" aria-label="${P.collapsed ? 'Mostrar' : 'Recolher'} editor" title="${P.collapsed ? 'Mostrar' : 'Recolher'}">${ic(P.collapsed ? I.rr : I.ll, 17, '#55555F', 2)}</button>
  ${P.profMenu ? `<div class="pop pf-pm" role="menu"><button type="button" class="pi" data-pf="profmenu"><span class="tx"><b>Perfil principal</b></span></button><button type="button" class="pi" data-pf="soon" data-msg="Perfis por servidor chegam em breve, junto com o Shiqi Plus"><span class="tx"><b>Perfis por servidor</b><small>Shiqi Plus</small></span></button></div>` : ''}</div>
  <div class="pf-ls">
  <button type="button" class="pf-prev${P.pv ? ' on' : ''}" data-pf="${P.pv ? 'pvoff' : 'pvon'}">${ic(I.coin, 15, '#fff', 1.8)} ${P.pv ? 'Sair da prévia' : 'Prévia do Shiqi Plus'}</button>
  <h4>Placa de identificação</h4>${slot('plate', `<span class="pplate"><i class="pdot"></i><i class="pbar"></i><span class="padd">${ic(I.plus, 13, '#1D1D22', 2.4)}</span></span>`, 'wide')}
  <h4>Avatar e decorações</h4><div class="pf-two">${slot('img', `<span class="pcell">${decAv(64)}</span>`)}${slot('decor', `<span class="pcell dash">${avatarBox(56, 'dim')}<span class="padd c">${ic(I.plus, 13, '#1D1D22', 2.4)}</span></span>`)}</div>
  <h4>Cor da faixa</h4><div class="pf-colwrap"><button type="button" class="pcolor" data-pf="picker" style="background:${esc(P.accent)}" aria-label="Escolher a cor da faixa" aria-expanded="${!!P.picker}"></button>${P.picker ? pickerHTML() : ''}</div>
  <h4>Efeitos de perfil e molduras</h4><div class="pf-two">${slot('effect', `<span class="pcell card">${ic(I.plus, 13, '#1D1D22', 2.4)}</span>`)}${slot('frame', `<span class="pcell card">${ic(I.plus, 13, '#1D1D22', 2.4)}</span>`)}</div>
  <h4>Estilo do nome exibido <em class="pnew">NOVO</em></h4><small class="phint">Experimente a fonte de um jogo de aventura</small>
  ${slot('soon', `<span class="pstyle">${esc(P.name || 'nome')}</span>`, 'wide', 'Os estilos de nome chegam com o Shiqi Plus')}
  <div class="pf-lock">${ic(I.lock, 16, '#1D1D22', 2)}<h5>Eleve seu visual, somente com o Shiqi Plus</h5>
    <h4>Tema de perfil</h4><span class="pthemeb"><i></i><i></i></span><h4>Faixa do perfil</h4><span class="pbanner"></span><h4>Avatar animado</h4><span class="panim">${avatarBox(56, 'dim')}</span>
    <button type="button" class="pf-plus" data-pf="plus">${ic(I.coin, 15, 'currentColor', 1.8)} Obter o Shiqi Plus</button></div>
  </div></aside>`;
}

function pickerHTML() {
  const [r, g, b] = hex2rgb(isHex(P.accent) ? P.accent : '#9D8CCF'), [h] = rgb2hsv(r, g, b);
  return `<div class="pop pf-pick" role="dialog" aria-label="Seletor de cor"><div class="psv" id="psv" style="background:linear-gradient(0deg,#000,transparent),linear-gradient(90deg,#fff,hsl(${Math.round(h)},100%,50%))"><i id="psvk"></i></div>
  <div class="phue" id="phue"><i id="phk"></i></div>
  <label class="phex"><span>#</span><input id="phexi" value="${esc(P.accent.slice(1))}" maxlength="6" spellcheck="false" aria-label="Código da cor"><button type="button" class="hov sq" data-pf="eyedrop" aria-label="Conta-gotas" title="Conta-gotas">${ic(I.eye, 17, '#55555F', 1.8)}</button></label>
  <div class="ppre">${PRESETS.map((c) => `<button type="button" class="psw" data-pf="color" data-c="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}</div></div>`;
}

function cardHTML() {
  const x = P.x, m = me();
  return `<section class="pf-mid" aria-label="Prévia do perfil"><div class="pcard${P.pv && P.ap.frame ? ' pvframe' : ''}"><div class="pbn" style="background:${esc(P.accent)}"></div>${P.pv && P.ap.effect && shop() ? `<span class="mpfx pvfx">${shop().art(findItem(P.ap.effect), true)}</span>` : ''}${P.pv && P.ap.frame && shop() ? `<span class="pvfr">${shop().art(findItem(P.ap.frame), true)}</span>` : ''}
  <div class="pcav">${decAv(92, 'ring')}<i class="pon" aria-hidden="true"></i><label class="pmus"><span>${ic(I.plus, 12, '#fff', 2.4)}</span><input id="pf-music" value="${esc(x.music || '')}" maxlength="40" placeholder="Última música que não sai da sua cabeça?" aria-label="Última música"></label></div>
  <div class="pbody"><input class="pname" id="pf-name" value="${esc(P.name)}" maxlength="32" aria-label="Nome exibido" placeholder="Nome exibido">${P.pv && P.ap.plate && shop() ? `<span class="pvpl">${shop().art(findItem(P.ap.plate))}</span>` : ''}
  <div class="pun"><span>${esc(m.user || '')}</span><i>•</i><input id="pf-pron" value="${esc(x.pron || '')}" maxlength="20" placeholder="Adicionar pronomes" aria-label="Pronomes"></div>
  <button type="button" class="pchip" data-pf="soon" data-msg="As insígnias chegam em breve">${ic(I.plus, 12, '#1D1D22', 2.4)} Insígnias</button>
  <div class="pbtns"><span class="pmsg">${ic(I.chat, 15, '#fff', 1.9)} Mensagem</span><span class="psq">${ic(I.gift, 16, '#fff', 1.8)}</span><span class="psq">${ic(I.dots, 16, '#fff', 1.8)}</span></div>
  <label class="pl">Status</label><input class="pin" id="pf-status" value="${esc(P.status)}" maxlength="60" placeholder="O que você está fazendo?" aria-label="Status">
  <label class="pl">Bio</label><textarea class="pin" id="pf-bio" rows="2" maxlength="190" placeholder="Descreva-se em um haiku" aria-label="Bio">${esc(P.bio)}</textarea>
  <label class="pl">Membro desde</label><b class="pv">${esc(since())}</b>
  <label class="pl">Conexões</label><button type="button" class="padl" data-pf="soon" data-msg="As conexões com outros apps chegam em breve">${ic(I.plus, 12, '#3B3B96', 2.4)} Adicionar conexão</button>
  <label class="pl">Nota <small>(visível apenas para você)</small></label><textarea class="pin" id="pf-note" rows="2" maxlength="256" placeholder="Clique para adicionar uma nota" aria-label="Nota">${esc(x.note || '')}</textarea></div></div></section>`;
}

function rightHTML() {
  const x = P.x, t = P.tab, tab = (k, l) => `<button type="button" class="ptab${t === k ? ' on' : ''}" data-pf="tab" data-k="${k}" role="tab" aria-selected="${t === k}">${l}</button>`;
  let body = '';
  if (t === 'mural') {
    const w = x.w || {};
    body = `<h3>Personalize seu perfil com widgets</h3><p>Explore nossa biblioteca de widgets para compartilhar mais sobre você e seus interesses</p>
    <div class="pwg">${WIDGETS.map((k) => `<button type="button" class="pw${w[k[0]] ? ' has' : ''}" data-pf="widget" data-k="${k[0]}"><span class="pwa">${w[k[0]] ? '' : ic(I.plus, 14, '#1D1D22', 2.4)}</span><b>${esc(w[k[0]] || k[1])}</b>${w[k[0]] ? `<small>${esc(k[1])}</small>` : ''}</button>`).join('')}</div>
    <button type="button" class="mbtn ghost sm" data-pf="soon" data-msg="A biblioteca completa de widgets chega em breve">Ver todos os widgets</button>`;
  } else if (t === 'act') {
    body = `<h3>Você não tem nenhuma atividade aqui</h3><p>Conecte suas contas para compartilhar seu status e atividade no jogo. Você está no controle do que compartilhar.</p>
    <div class="pplat" aria-hidden="true">${['#9D8CCF', '#7DB8CF', '#78BE9D', '#EBBA6C', '#E897AB', '#E8A06B', '#9A9AA7', '#D9697A'].map((c) => `<i style="background:${c}"></i>`).join('')}</div>
    <div class="pbt2"><button type="button" class="mbtn ghost sm" data-pf="soon" data-msg="As conexões com outros apps chegam em breve">Conectar contas</button><button type="button" class="mbtn ghost sm" data-pf="soon" data-msg="Adicionar jogos chega em breve">Adicionar jogo</button></div>`;
  } else {
    const S = shop(), ids = (() => { try { return JSON.parse(localStorage.getItem('sq.wish.' + uid()) || '[]') || []; } catch (e) { return []; } })();
    const items = S ? ids.map(S.byId).filter(Boolean) : [];
    body = items.length ? `<div class="pwish">${items.map((it) => `<div class="pwi"><span class="jart">${S.art(it)}</span><b>${esc(it.n)}</b>${S.priceHTML(it)}</div>`).join('')}</div>`
      : `<h3>Sua lista de desejos está vazia</h3><p>Toque no coração de um item da Loja para guardá-lo aqui.</p><button type="button" class="mbtn ghost sm" data-pf="shop">Ir para a Loja</button>`;
  }
  return `<section class="pf-right" aria-label="Mural, atividade e desejos"><div class="ptabs" role="tablist">${tab('mural', 'Mural')}${tab('act', 'Atividade')}${tab('wish', 'Lista de desejos')}</div><div class="pbody2">${body}</div></section>`;
}

/* ------------------------------------------------------------ janelas */
const CAT = { decor: ['Mudar decoração de avatar', 'Suas decorações', 'Veja o que há na Loja'], effect: ['Alterar o efeito de perfil', 'Seus efeitos', 'Veja o que há na Loja'], frame: ['Alterar moldura de perfil', 'Suas molduras', 'Veja o que há na Loja'], plate: ['Alterar placa de identificação', 'Suas placas de identificação', 'Veja o que há na Loja'] };
const PLUS_EXTRA = [{ id: 'px1', n: 'Fones Neon', t: 'decor', a: ['#7DB8CF', '#9D8CCF', '#fff'] }, { id: 'px2', n: 'Painel 23', t: 'decor', a: ['#E897AB', '#9D8CCF', '#7DB8CF'] }, { id: 'px3', n: 'Anel Verde', t: 'decor', a: ['#78BE9D', '#EBBA6C', '#fff'] }];
const PLUS_FX = [{ id: 'fx1', n: 'Cubo Neon', t: 'effect', a: ['#9D8CCF', '#E897AB', '#7DB8CF'] }, { id: 'fx2', n: 'Planeta Verde', t: 'effect', a: ['#78BE9D', '#EBBA6C', '#7DB8CF'] }];

const findItem = (id) => (!id ? null : String(id).startsWith('plus:') ? [...PLUS_EXTRA, ...PLUS_FX].find((x) => 'plus:' + x.id === id) : (shop() && shop().byId(id)));
const hasAp = () => !!(P.pv && P.ap && Object.keys(P.ap).some((k) => P.ap[k]));
function decAv(px, cls) {
  const it = P.pv && P.ap.decor ? findItem(P.ap.decor) : null, S = shop();
  if (!it || !S) return avatarBox(px, cls);
  const o = Math.round(px * 1.28);
  return `<span class="mpd" style="width:${o}px;height:${o}px;--bw:${Math.max(2, Math.round(px * 0.075))}px;--sp:${Math.max(5, Math.round(px * 0.09))}px">${avatarBox(px, cls)}${S.art(it, 'ov')}</span>`;
}
function shopItems(kind) { const S = shop(); if (!S) return []; return S.catalog.filter((x) => x.t === kind).slice(0, kind === 'frame' ? 18 : 12); }
function previewOf(kind, it) {
  const S = shop();
  if (kind === 'decor') {
    const dec = (px) => { const o = Math.round(px * 1.28); return `<span class="mpd" style="width:${o}px;height:${o}px;--bw:${Math.max(2, Math.round(px * 0.075))}px;--sp:${Math.max(5, Math.round(px * 0.09))}px">${avatarBox(px)}${it ? S.art(it, 'ov') : ''}</span>`; };
    return `<div class="mpv big">${dec(112)}</div><div class="mpsm">${[44, 36, 44, 36].map((s, i) => `<span class="mps">${dec(s)}${i > 1 ? '<i class="pon"></i>' : ''}</span>`).join('')}</div>`;
  }
  if (kind === 'plate') return `<div class="mplist">${['', '', 'me', '', ''].map((v) => (v ? `<div class="mprow me">${avatarBox(26)}<b>${esc(P.name || 'você')}</b>${it ? `<span class="mpl">${S.art(it)}</span>` : ''}</div>` : '<div class="mprow"><i></i><i class="b"></i></div>')).join('')}</div>`;
  return `<div class="mpcard"><div class="mpbn" style="background:${esc(P.accent)}"></div>${avatarBox(64, 'ring')}<b>${esc(P.name || 'você')}</b><small>${esc(me().user || '')}</small><span class="mpb">Botão exemplo</span>${it ? `<span class="mpfx">${S.art(it, true)}</span>` : ''}</div>`;
}
function itemsModal(kind) {
  const S = shop(), c = CAT[kind], m = P.modal, sel = m.sel ? findItem(m.sel) : null;
  const tile = (it, plus) => `<button type="button" class="mit${m.sel === (plus ? 'plus:' : '') + it.id ? ' on' : ''}" data-pf="msel" data-id="${plus ? 'plus:' : ''}${it.id}" aria-label="${esc(it.n)}" aria-pressed="${m.sel === (plus ? 'plus:' : '') + it.id}"><span class="jart">${S ? S.art(it) : ''}</span><i class="mlk">${ic(plus ? I.coin : I.lock, 11, '#fff', 2)}</i></button>`;
  const extra = kind === 'decor' ? PLUS_EXTRA : kind === 'effect' ? PLUS_FX : [];
  const none = `<button type="button" class="mit pick${!m.sel ? ' on' : ''}" data-pf="msel" data-id="" aria-pressed="${!m.sel}">${ic(I.none, 24, '#1D1D22', 1.8)}<b>Nenhum</b></button><button type="button" class="mit pick" data-pf="shop">${ic(I.shop, 24, '#1D1D22', 1.8)}<b>Loja</b></button>`;
  const locked = !!sel && !P.pv, isPlus = m.sel && m.sel.startsWith('plus:');
  return `<div class="pm wide" role="dialog" aria-modal="true" aria-label="${c[0]}"><div class="pmh"><h2>${c[0]}</h2><button type="button" class="hov sq" data-pf="mclose" aria-label="Fechar">${ic(I.x, 18, '#55555F', 2)}</button></div>
  <div class="pmc"><div class="pml"><h3>${c[1]}</h3><div class="mgrid">${none}</div>
  ${extra.length ? `<h3>Exclusivo do Shiqi Plus</h3><div class="mgrid">${extra.map((x) => tile(x, true)).join('')}</div>` : ''}
  <h3>${c[2]}</h3><div class="mgrid sc">${shopItems(kind).map((x) => tile(x)).join('')}</div></div>
  <div class="pmr">${previewOf(kind, sel)}${sel ? `<div class="mdesc"><b>${esc(sel.n)}</b><span>${P.pv ? 'Modo prévia: só você vê, nada disso é salvo.' : isPlus ? 'Exclusivo do Shiqi Plus. Assine para usar este item.' : 'Acesse a Loja para comprar e coletar este item.'}</span></div>` : ''}</div></div>
  <div class="pmf"><button type="button" class="mbtn ghost" data-pf="mclose">Cancelar</button>${locked ? `<button type="button" class="mbtn" data-pf="${isPlus ? 'plus' : 'shop'}">${isPlus ? 'Obter o Shiqi Plus' : 'Ir para a Loja'}</button>` : `<button type="button" class="mbtn" data-pf="${P.pv ? 'mapply' : 'mclose'}">Aplicar</button>`}</div></div>`;
}
function imgModal() {
  const rec = P.x.recents || [];
  return `<div class="pm" role="dialog" aria-modal="true" aria-label="Selecione uma imagem"><div class="pmh"><h2>Selecione uma imagem</h2><button type="button" class="hov sq" data-pf="mclose" aria-label="Fechar">${ic(I.x, 18, '#55555F', 2)}</button></div>
  <div class="pmc one"><div class="pimg"><label class="pup" tabindex="0" id="pf-uplab">${ic(I.imgs, 26, '#1D1D22', 1.7)}<b>Enviar imagem</b><input type="file" id="pf-file" accept="image/jpeg,image/png,image/webp" hidden></label>
  <button type="button" class="pgif" data-pf="plusgif"><span class="pgc"><i></i><i></i><i></i><i></i></span><b>${ic(I.coin, 13, '#fff', 1.8)} Escolher GIF</b></button></div>
  ${P.err ? `<p class="perr" role="alert">${esc(P.err)}</p>` : ''}
  <h3>Avatares Recentes</h3><small class="phint">Acesse seus envios de Avatar mais recentes 6.</small>
  <div class="prec">${Array.from({ length: 6 }, (_, i) => (rec[i] ? `<button type="button" class="prc" data-pf="recent" data-i="${i}" aria-label="Usar avatar recente ${i + 1}"><img src="${esc(rec[i])}" alt=""></button>` : `<span class="prc empty">${ic(I.user, 30, '#9A9AA7', 1.6)}</span>`)).join('')}</div>
  ${(me().avatar || P.pendingAvatar) ? '<button type="button" class="mbtn ghost sm" data-pf="rmavatar">Remover foto</button>' : ''}
  <div class="pplus">Anime seu avatar com <a href="#" data-pf="plus">Shiqi Plus</a><button type="button" class="pf-plus wh" data-pf="plus">${ic(I.coin, 14, 'currentColor', 1.8)} Obter o Shiqi Plus</button></div></div></div>`;
}
function cropModal() {
  const c = P.crop;
  return `<div class="pm" role="dialog" aria-modal="true" aria-label="Editar imagem"><div class="pmh"><h2>Editar imagem</h2><button type="button" class="hov sq" data-pf="mclose" aria-label="Fechar">${ic(I.x, 18, '#55555F', 2)}</button></div>
  <div class="pmc one"><div class="pcrop"><canvas id="pf-cv" width="340" height="280" aria-label="Arraste para posicionar a imagem"></canvas></div>
  <div class="pzoom">${ic(I.img, 13, '#55555F', 1.8)}<input type="range" id="pf-zoom" min="100" max="400" value="${Math.round(c.z * 100)}" aria-label="Zoom">${ic(I.img, 19, '#55555F', 1.8)}<button type="button" class="hov sq" data-pf="rot" aria-label="Girar" title="Girar">${ic(I.rot, 17, '#55555F', 1.9)}</button></div>
  <div class="pplus">Anime seu avatar com <a href="#" data-pf="plus">Shiqi Plus</a><button type="button" class="pf-plus wh" data-pf="plus">${ic(I.coin, 14, 'currentColor', 1.8)} Obter o Shiqi Plus</button></div></div>
  <div class="pmf split"><button type="button" class="plnk" data-pf="creset">Redefinir</button><span class="tsp"></span><button type="button" class="mbtn ghost" data-pf="mclose">Cancelar</button><button type="button" class="mbtn" data-pf="capply">Aplicar</button></div></div>`;
}
function widgetModal() {
  const k = P.wid, nm = (WIDGETS.find((w) => w[0] === k) || [0, ''])[1], v = (P.x.w || {})[k] || '';
  return `<div class="pm" role="dialog" aria-modal="true" aria-label="${esc(nm)}"><div class="pmh"><h2>${esc(nm)}</h2><button type="button" class="hov sq" data-pf="mclose" aria-label="Fechar">${ic(I.x, 18, '#55555F', 2)}</button></div>
  <div class="pmc one"><p class="phint">Escreva o nome do jogo ou do que quiser mostrar neste widget.</p><input class="pin" id="pf-wg" value="${esc(v)}" maxlength="40" placeholder="Ex.: meu jogo favorito" aria-label="${esc(nm)}"></div>
  <div class="pmf split">${v ? '<button type="button" class="plnk" data-pf="wgdel">Remover</button>' : ''}<span class="tsp"></span><button type="button" class="mbtn ghost" data-pf="mclose">Cancelar</button><button type="button" class="mbtn" data-pf="wgsave">Salvar</button></div></div>`;
}
function modalHTML() {
  const m = P.modal; if (!m) return '';
  const inner = m.k === 'img' ? imgModal() : m.k === 'crop' ? cropModal() : m.k === 'widget' ? widgetModal() : itemsModal(m.k);
  return `<div class="pmback" data-pf="mback">${inner}</div>`;
}

function warnHTML() {
  if (!P.warn) return '';
  return `<div class="pmback"><div class="pm" role="alertdialog" aria-modal="true" aria-label="Itens do modo prévia"><div class="pmh"><h2>Não dá para salvar com a prévia</h2></div><div class="pmc one"><p>Você está usando itens do Shiqi Plus só para visualizar. Para salvar o perfil com eles, assine o Shiqi Plus. Ou saia do modo prévia para salvar o resto.</p></div><div class="pmf"><button type="button" class="mbtn ghost" data-pf="pvoff">Sair do modo prévia</button><button type="button" class="mbtn" data-pf="plus">Assinar o Shiqi Plus</button></div></div></div>`;
}
function saveBar() {
  if (!dirty() && !hasAp()) return '';
  return `<div class="pf-save" role="status"><span>Cuidado — você tem alterações não salvas!</span><button type="button" class="plnk" data-pf="reset">Redefinir</button><button type="button" class="mbtn" data-pf="save"${P.busy ? ' disabled' : ''}>${P.busy ? 'Salvando…' : 'Salvar alterações'}</button></div>`;
}

function paint() {
  if (!root) return;
  const keep = {}, ae = document.activeElement;
  const act = ae && ae.id && root.contains(ae) ? { id: ae.id, s: typeof ae.selectionStart === 'number' ? [ae.selectionStart, ae.selectionEnd] : null } : null;
  ['pf-scroll', 'pf-lscroll'].forEach((id) => { const e = document.getElementById(id); if (e) keep[id] = e.scrollTop; });
  root.innerHTML = `<div class="pback"><div class="pwin${P.collapsed ? ' col' : ''}" role="dialog" aria-modal="true" aria-label="Editar perfil"><button type="button" class="pclose" data-pf="close" aria-label="Fechar">${ic(I.x, 18, '#55555F', 2)}</button>
  ${P.pv ? '<div class="pf-pvbar" role="status"><span>Modo prévia do Shiqi Plus: só você vê, nada é salvo.</span><button type="button" class="plnk" data-pf="pvoff">Sair da prévia</button></div>' : ''}<div class="pcols" id="pf-scroll">${leftHTML()}<div class="pf-rest">${cardHTML()}${rightHTML()}</div></div>${saveBar()}</div>${modalHTML()}${warnHTML()}</div>`;
  Object.keys(keep).forEach((id) => { const e = document.getElementById(id); if (e) e.scrollTop = keep[id]; });
  if (act) { const e = document.getElementById(act.id); if (e) { e.focus(); if (act.s && e.setSelectionRange) { try { e.setSelectionRange(act.s[0], act.s[1]); } catch (er) { /* tipo sem seleção */ } } } }
  if (P.modal && P.modal.k === 'crop') drawCrop();
}

/* ------------------------------------------------------------ recorte da foto */
function loadFile(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { P.err = 'Use uma imagem JPG, PNG ou WebP.'; paint(); return; }
  if (file.size > 10 * 1024 * 1024) { P.err = 'A imagem é muito grande (máximo 10 MB).'; paint(); return; }
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); startCrop(img); };
  img.onerror = () => { URL.revokeObjectURL(url); P.err = 'Não foi possível abrir essa imagem.'; paint(); };
  img.src = url;
}
function startCrop(img) { P.err = ''; P.crop = { img, z: 1, rot: 0, ox: 0, oy: 0 }; P.modal = { k: 'crop' }; paint(); }
const CV = { W: 340, H: 280, R: 125 };
function paintCrop(ctx, W, H, R, f) {
  const c = P.crop, im = c.img, rad = c.rot * Math.PI / 2, sw = c.rot % 2 ? im.height : im.width, sh = c.rot % 2 ? im.width : im.height;
  const base = (2 * CV.R) / Math.min(sw, sh), s = base * c.z * f;
  ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2 + c.ox * f, H / 2 + c.oy * f); ctx.rotate(rad); ctx.scale(s, s); ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore();
}
function clampCrop() {
  const c = P.crop, sw = c.rot % 2 ? c.img.height : c.img.width, sh = c.rot % 2 ? c.img.width : c.img.height, s = (2 * CV.R) / Math.min(sw, sh) * c.z;
  const mx = Math.max(0, (sw * s) / 2 - CV.R), my = Math.max(0, (sh * s) / 2 - CV.R);
  c.ox = Math.max(-mx, Math.min(mx, c.ox)); c.oy = Math.max(-my, Math.min(my, c.oy));
}
function drawCrop() {
  const cv = document.getElementById('pf-cv'); if (!cv || !P.crop) return;
  clampCrop();
  const ctx = cv.getContext('2d'); paintCrop(ctx, CV.W, CV.H, CV.R, 1);
  ctx.save(); ctx.fillStyle = 'rgba(29,29,34,.5)'; ctx.beginPath(); ctx.rect(0, 0, CV.W, CV.H); ctx.arc(CV.W / 2, CV.H / 2, CV.R, 0, Math.PI * 2, true); ctx.fill('evenodd');
  ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(CV.W / 2, CV.H / 2, CV.R, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function applyCrop() {
  const out = document.createElement('canvas'); out.width = out.height = 256;
  const o = out.getContext('2d'), f = 256 / (2 * CV.R);
  const tmp = document.createElement('canvas'); tmp.width = CV.W * f; tmp.height = CV.H * f;
  paintCrop(tmp.getContext('2d'), tmp.width, tmp.height, CV.R * f, f);
  o.drawImage(tmp, (CV.W / 2 - CV.R) * f, (CV.H / 2 - CV.R) * f, 256, 256, 0, 0, 256, 256);
  out.toBlob((b) => {
    if (!b) { P.err = 'Não foi possível preparar a imagem.'; P.modal = { k: 'img' }; paint(); return; }
    if (P.pendingAvatar && P.pendingAvatar.startsWith('blob:')) URL.revokeObjectURL(P.pendingAvatar);
    P.pendingBlob = b; P.pendingAvatar = URL.createObjectURL(b); P.removeAvatar = false; P.thumb = null;
    const t = document.createElement('canvas'); t.width = t.height = 96; t.getContext('2d').drawImage(out, 0, 0, 96, 96); P.thumb = t.toDataURL('image/jpeg', 0.7);
    P.modal = null; P.crop = null; paint();
  }, 'image/jpeg', 0.86);
}

/* ------------------------------------------------------------ ações */
async function save() {
  if (P.busy) return;
  if (hasAp()) { P.warn = true; paint(); return; }
  const name = P.name.trim();
  if (!name) { toast('Informe um nome exibido.'); return; }
  if (!isHex(P.accent)) { toast('A cor precisa ter 6 letras ou números, como 9D8CCF.'); return; }
  P.busy = true; paint();
  try {
    const a = api();
    if (P.pendingBlob) { await a.uploadAvatar(P.pendingBlob); const x = P.x; x.recents = [P.thumb].concat((x.recents || []).filter((r) => r !== P.thumb)).slice(0, 6); setX(x); }
    else if (P.removeAvatar) await a.removeAvatar();
    await a.saveProfile({ display_name: name, status_text: P.status.trim(), bio: P.bio.trim(), accent: P.accent });
    toast('Perfil atualizado');
    if (P.pendingAvatar && P.pendingAvatar.startsWith('blob:')) URL.revokeObjectURL(P.pendingAvatar);
    P.pendingAvatar = null; P.pendingBlob = null; P.removeAvatar = false; P.busy = false; fromMe(); paint();
  } catch (e) { P.busy = false; toast('Não foi possível salvar. Tente de novo.'); paint(); }
}
function fromMe() { const m = me(); P.name = m.name || ''; P.status = m.status || ''; P.bio = m.bio || ''; P.accent = m.accent || '#9D8CCF'; }
function goTo(v) { close(); if (api().go) api().go(v); }

function onClick(e) {
  const el = e.target.closest('[data-pf]'); if (!P) return;
  if (P.picker && !e.target.closest('.pf-colwrap')) { P.picker = false; paint(); }
  if (P.profMenu && !e.target.closest('.pf-lh')) { P.profMenu = false; paint(); }
  if (!el) return;
  const k = el.dataset.pf;
  if (k === 'mback') { if (e.target === el && P.modal) { P.modal = null; P.crop = null; paint(); } return; }
  e.preventDefault();
  switch (k) {
    case 'close': close(); break;
    case 'soon': toast(el.dataset.msg || 'Isso chega em breve'); break;
    case 'plus': goTo('plus'); break;
    case 'shop': goTo('shop'); break;
    case 'plusgif': toast('Escolher GIF faz parte do Shiqi Plus'); break;
    case 'profmenu': P.profMenu = !P.profMenu; paint(); break;
    case 'collapse': P.collapsed = !P.collapsed; paint(); break;
    case 'tab': P.tab = el.dataset.k; paint(); break;
    case 'picker': P.picker = !P.picker; paint(); break;
    case 'color': P.accent = el.dataset.c; paint(); break;
    case 'eyedrop': if (window.EyeDropper) { new window.EyeDropper().open().then((r) => { P.accent = r.sRGBHex; paint(); }).catch(() => {}); } else toast('Seu navegador não tem conta-gotas.'); break;
    case 'img': P.modal = { k: 'img' }; P.err = ''; P.picker = false; paint(); break;
    case 'decor': case 'effect': case 'frame': case 'plate': P.modal = { k, sel: (P.pv && P.ap[k]) || '' }; P.picker = false; paint(); break;
    case 'pvon': P.pv = true; P.ap = {}; toast('Modo prévia: os itens da Loja estão liberados só para você ver. Nada é salvo.'); paint(); break;
    case 'pvoff': P.pv = false; P.ap = {}; P.warn = false; paint(); break;
    case 'mapply': P.ap[P.modal.k] = P.modal.sel || null; P.modal = null; paint(); break;
    case 'warnx': P.warn = false; paint(); break;
    case 'msel': P.modal.sel = el.dataset.id; paint(); break;
    case 'mclose': P.modal = null; P.crop = null; paint(); break;
    case 'recent': { const src = (P.x.recents || [])[Number(el.dataset.i)]; if (src) { const im = new Image(); im.onload = () => startCrop(im); im.src = src; } break; }
    case 'rmavatar': if (P.pendingAvatar && P.pendingAvatar.startsWith('blob:')) URL.revokeObjectURL(P.pendingAvatar); P.pendingAvatar = null; P.pendingBlob = null; P.removeAvatar = !!me().avatar; P.modal = null; paint(); break;
    case 'rot': P.crop.rot = (P.crop.rot + 1) % 4; P.crop.ox = P.crop.oy = 0; drawCrop(); break;
    case 'creset': P.crop.z = 1; P.crop.rot = 0; P.crop.ox = P.crop.oy = 0; { const z = document.getElementById('pf-zoom'); if (z) z.value = 100; } drawCrop(); break;
    case 'capply': applyCrop(); break;
    case 'widget': P.modal = { k: 'widget' }; P.wid = el.dataset.k; paint(); setTimeout(() => { const i = document.getElementById('pf-wg'); if (i) i.focus(); }, 0); break;
    case 'wgsave': case 'wgdel': { const x = P.x; x.w = x.w || {}; if (k === 'wgdel') delete x.w[P.wid]; else { const v = (document.getElementById('pf-wg').value || '').trim(); if (v) x.w[P.wid] = v; else delete x.w[P.wid]; } setX(x); P.modal = null; paint(); break; }
    case 'reset': if (P.pendingAvatar && P.pendingAvatar.startsWith('blob:')) URL.revokeObjectURL(P.pendingAvatar); P.pendingAvatar = null; P.pendingBlob = null; P.removeAvatar = false; fromMe(); paint(); break;
    case 'save': save(); break;
    default: break;
  }
}
function onInput(e) {
  if (!P) return; const t = e.target, id = t.id;
  if (id === 'pf-name') P.name = t.value; else if (id === 'pf-status') P.status = t.value; else if (id === 'pf-bio') P.bio = t.value;
  else if (id === 'pf-pron' || id === 'pf-music' || id === 'pf-note') { const x = P.x; x[{ 'pf-pron': 'pron', 'pf-music': 'music', 'pf-note': 'note' }[id]] = t.value; setX(x); return; }
  else if (id === 'phexi') { const v = '#' + t.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6); if (isHex(v)) { P.accent = v; syncPick(); } return; }
  else if (id === 'pf-zoom') { P.crop.z = Number(t.value) / 100; drawCrop(); return; }
  else return;
  refreshBar();
}
function onChange(e) { if (P && e.target.id === 'pf-file') { const f = e.target.files && e.target.files[0]; e.target.value = ''; loadFile(f); } }
function refreshBar() {
  const w = root.querySelector('.pwin'); if (!w) return;
  const old = w.querySelector('.pf-save'), has = dirty();
  if (old && !has) old.remove(); else if (!old && has) w.insertAdjacentHTML('beforeend', saveBar());
  const bn = root.querySelector('.pbn'); if (bn) bn.style.background = P.accent;
  const st = root.querySelector('.pstyle'); if (st) st.textContent = P.name || 'nome';
}
function syncPick() {
  const bn = root.querySelector('.pbn'); if (bn) bn.style.background = P.accent;
  const c = root.querySelector('.pcolor'); if (c) c.style.background = P.accent;
  const [r, g, b] = hex2rgb(P.accent), [h, s, v] = rgb2hsv(r, g, b), sv = document.getElementById('psv');
  if (sv) { sv.style.background = `linear-gradient(0deg,#000,transparent),linear-gradient(90deg,#fff,hsl(${Math.round(h)},100%,50%))`; document.getElementById('psvk').style.cssText = `left:${s * 100}%;top:${(1 - v) * 100}%`; document.getElementById('phk').style.left = (h / 360 * 100) + '%'; }
  refreshBar();
}
function dragStart(e) {
  if (!P) return;
  const cv = e.target.closest && e.target.closest('#pf-cv');
  if (cv && P.crop) {
    const c = P.crop, sx = e.clientX, sy = e.clientY, ox = c.ox, oy = c.oy, k = cv.width / cv.getBoundingClientRect().width;
    const mv = (ev) => { c.ox = ox + (ev.clientX - sx) * k; c.oy = oy + (ev.clientY - sy) * k; drawCrop(); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); e.preventDefault(); return;
  }
  const sv = e.target.closest && (e.target.closest('#psv') || e.target.closest('#phue'));
  if (sv) {
    const isSv = sv.id === 'psv';
    const mv = (ev) => {
      const r = sv.getBoundingClientRect(), x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
      const [rr, gg, bb] = hex2rgb(isHex(P.accent) ? P.accent : '#9D8CCF'); let [h, s, v] = rgb2hsv(rr, gg, bb);
      if (isSv) { s = x; v = 1 - y; } else h = x * 360;
      if (!s && !isSv) s = 0.01;
      P.accent = rgb2hex(...hsv2rgb(h, s, v)); const inp = document.getElementById('phexi'); if (inp) inp.value = P.accent.slice(1); syncPick();
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); mv(e); e.preventDefault();
  }
}
function onKey(e) {
  if (!P) return;
  if (e.key === 'Escape') { e.stopPropagation(); if (P.picker) { P.picker = false; paint(); } else if (P.modal) { P.modal = null; P.crop = null; paint(); } else close(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'pf-uplab') { e.preventDefault(); const f = document.getElementById('pf-file'); if (f) f.click(); }
  if (e.key === 'Enter' && e.target.id === 'pf-wg') { e.preventDefault(); const b = root.querySelector('[data-pf="wgsave"]'); if (b) b.click(); }
}

/* ------------------------------------------------------------ abrir e fechar */
function open() {
  if (P) return;
  if (!me().id) { toast('Entre na sua conta para editar o perfil.'); return; }
  root = document.getElementById('perfroot');
  if (!root) { root = document.createElement('div'); root.id = 'perfroot'; document.body.appendChild(root); root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange); root.addEventListener('pointerdown', dragStart); root.addEventListener('keydown', onKey); }
  P = { tab: 'mural', collapsed: false, modal: null, picker: false, profMenu: false, busy: false, err: '', pendingAvatar: null, pendingBlob: null, removeAvatar: false, crop: null, pv: false, ap: {}, warn: false, x: getX() };
  fromMe(); document.body.classList.add('perfil-open'); root.hidden = false; paint();
  const c = root.querySelector('.pclose'); if (c) c.focus();
}
function close() {
  if (!P) return;
  if (P.pendingAvatar && P.pendingAvatar.startsWith('blob:')) URL.revokeObjectURL(P.pendingAvatar);
  P = null; document.body.classList.remove('perfil-open'); if (root) { root.innerHTML = ''; root.hidden = true; }
}
window.SQ_PERFIL = { open, close, isOpen: () => !!P };
})();
