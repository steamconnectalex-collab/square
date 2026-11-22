(() => {
'use strict';

/* =====================================================================
   Square. — Loja (Destaques, Navegar, Loja de Pontos), Missões e Square Plus.
   As páginas são desenhadas aqui e encaixadas no menu principal pelo app.js
   (window.SQ_SHOP.shopHTML / questsHTML / plusHTML). Ainda não existe pagamento:
   comprar, assinar e cumprir missões mostram um aviso "em breve".
   Os itens são de exemplo (arte feita só com CSS, nomes inventados).
   ===================================================================== */

const api = () => window.SQ_API || {};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (d, s = 18, c = '#33333A', w = 1.7) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  r: '<path d="m9 6 6 6-6 6"/>', l: '<path d="m15 6-6 6 6 6"/>', d: '<path d="m6 9 6 6 6-6"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="m12 7.5 1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  shop: '<path d="M4 9h16l-1-4H5z"/><path d="M5 9v10h14V9"/><path d="M9 19v-5h6v5"/>',
  check: '<path d="m5 12 5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M8 5v14l11-7z"/>', info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  quest: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v5l3 2"/>', gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M3 9h18M12 9c-3 0-4-4-1.5-4S12 9 12 9zm0 0c3 0 4-4 1.5-4S12 9 12 9z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>', pal: '<path d="M12 4a8 8 0 1 0 0 16c1.5 0 2-1 1.4-2-.6-1 0-2 1.2-2H17a3 3 0 0 0 3-3 8 8 0 0 0-8-9z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="8" r="1"/><circle cx="16" cy="11" r="1"/>'
};

/* ------------------------------------------------------------ catálogo */
const COLS = [
  { id: 'neo', n: 'Cidade Neon', a: ['#8F7BD8', '#E897AB', '#7DB8CF'], th: 'Ficção Científica', names: ['Sakura Néon', 'Pulso Elétrico', 'Garota do Metrô', 'Robô Gentil', 'Chuva Rosa', 'Ciberlua'] },
  { id: 'duelo', n: 'Duelo de Heróis', a: ['#D9697A', '#EBBA6C', '#33333A'], th: 'Jogos', names: ['Máscara Escarlate', 'Garra Dourada', 'Capa Rubra', 'Lâmina Gêmea', 'Escudo Solar', 'Herói Anônimo'] },
  { id: 'noite', n: 'Noite Sombria', a: ['#55555F', '#E8A06B', '#9D8CCF'], th: 'Fantasia', names: ['Lua Negra', 'Teias de Sangue', 'Corvos da Lua', 'A Entidade', 'Ganchos Rubros', 'Névoa de Outono'] },
  { id: 'festa', n: 'Festa das Flores', a: ['#E8A06B', '#E897AB', '#78BE9D'], th: 'Fofo e Aconchegante', names: ['Oferenda', 'Papel Picado', 'Caveirinha', 'Alebrije', 'Pétalas Douradas', 'Velas de Mel'] },
  { id: 'inverno', n: 'Lenda do Inverno', a: ['#7DB8CF', '#9D8CCF', '#F2F2F7'], th: 'Fantasia', names: ['Rei Abóbora', 'Poção da Sally', 'Guardião Fantasma', 'Cão de Neve', 'Lanterna Azul', 'Coroa de Gelo'] },
  { id: 'lofi', n: 'Vibes LoFi', a: ['#78BE9D', '#EBBA6C', '#7DB8CF'], th: 'Fofo e Aconchegante', names: ['Vibrações de Plantas', 'Chromawave', 'Gato Aconchegante', 'Oásis', 'Chá da Tarde', 'Vinil Sonolento'] }
];
const COLORS = [['Roxo', '#9D8CCF'], ['Azul', '#7DB8CF'], ['Verde', '#78BE9D'], ['Marrom', '#B58B6B'], ['Amarelo', '#EBBA6C'], ['Laranja', '#E8A06B'], ['Vermelho', '#D9697A'], ['Rosa', '#E897AB'], ['Branco', '#F2F2F7'], ['Preto', '#33333A']];
const THEMES = ['Anime', 'Jogos', 'Fofo e Aconchegante', 'Comida e Bebidas', 'Ficção Científica', 'Fantasia', 'Animais Selvagens e de Estimação'];
const TYPES = [['decor', 'Decorações de avatar'], ['plate', 'Placas de identificação'], ['effect', 'Efeitos de perfil'], ['frame', 'Molduras de perfil'], ['pack', 'Pacotes']];
const TLABEL = { decor: 'Decoração de avatar', plate: 'Placa de identificação', effect: 'Efeito de perfil', frame: 'Moldura de perfil', pack: 'Pacote', credit: 'Crédito', badge: 'Insígnia' };

const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 33 + c.charCodeAt(0)) >>> 0; return h; };
const CATALOG = [];
COLS.forEach((c, ci) => {
  c.names.forEach((nm, i) => {
    const a = [c.a[(i) % 3], c.a[(i + 1) % 3], c.a[(i + 2) % 3]], h = hash(c.id + nm);
    const base = { col: c.id, th: i % 4 === 3 ? THEMES[(h + 3) % THEMES.length] : c.th, cl: COLORS[(h >>> 3) % COLORS.length][0], a, o: ci * 100 + i };
    if (i < 4) { const k = [3, 4, 3, 2][i]; const p = [4999, 7290, 4999, 4099][(i + ci) % 4]; CATALOG.push(Object.assign({}, base, { id: c.id + '-k' + i, t: 'pack', n: k + 'x Pacote ' + nm, p, off: [43, 37, 30, 29, 41, 12][(i + ci) % 6] })); }
    CATALOG.push(Object.assign({}, base, { id: c.id + '-d' + i, t: 'decor', n: nm, p: 2899 }));
    CATALOG.push(Object.assign({}, base, { id: c.id + '-e' + i, t: 'effect', n: nm, p: 2899 }));
    CATALOG.push(Object.assign({}, base, { id: c.id + '-f' + i, t: 'frame', n: nm, p: 2899 }));
    CATALOG.push(Object.assign({}, base, { id: c.id + '-p' + i, t: 'plate', n: nm, p: 1900 }));
  });
});
const PONTOS = [
  ['credit', 'Crédito Square Plus de 3 dias', 1400, ['#9D8CCF', '#E897AB', '#7DB8CF'], 1], ['badge', 'Insígnia de Aprendiz dos Pontos', 120, ['#7DB8CF', '#9D8CCF', '#fff'], 1],
  ['pack', '3x Pacote Turbilhão Infinito', 8900, ['#9D8CCF', '#7DB8CF', '#E897AB'], 1, 15], ['plate', 'Névoas Mágicas', 3500, ['#7DB8CF', '#9D8CCF', '#E897AB'], 1],
  ['decor', 'Névoas Mágicas', 3500, ['#9D8CCF', '#7DB8CF', '#E897AB'], 1], ['plate', 'Turbilhão Infinito', 3500, ['#9D8CCF', '#E897AB', '#7DB8CF'], 1],
  ['decor', 'Turbilhão Infinito', 3500, ['#7DB8CF', '#9D8CCF', '#E897AB'], 1], ['effect', 'Névoas Mágicas', 3500, ['#9D8CCF', '#E897AB', '#7DB8CF'], 1],
  ['pack', '3x Pacote Brumas Mágicas', 8900, ['#7DB8CF', '#9D8CCF', '#78BE9D'], 1, 15], ['effect', 'Turbilhão Infinito', 3500, ['#7DB8CF', '#9D8CCF', '#E897AB'], 1],
  ['decor', 'Portal da Ponderação', 3500, ['#78BE9D', '#7DB8CF', '#9D8CCF'], 1],
  ['pack', '2x Pacote Furioso', 7600, ['#D9697A', '#EBBA6C', '#33333A'], 0, 7], ['decor', 'Sentindo-se Delicioso', 4100, ['#78BE9D', '#7DB8CF', '#EBBA6C'], 0],
  ['pack', '3x Pacote Folhagem de Outono', 11000, ['#E8A06B', '#EBBA6C', '#B58B6B'], 0, 11], ['decor', 'Rosas Sombrias', 4100, ['#9D8CCF', '#D9697A', '#33333A'], 0],
  ['pack', '2x Pacote Brilho Neon', 7600, ['#E897AB', '#9D8CCF', '#7DB8CF'], 0, 7], ['pack', '2x Pacote Aura Elétrica', 7600, ['#9A9AA7', '#7DB8CF', '#fff'], 0, 7],
  ['plate', 'Áries', 4100, ['#E8A06B', '#D9697A', '#EBBA6C'], 0], ['effect', 'Corações Mágicos', 4100, ['#E897AB', '#9D8CCF', '#D9697A'], 0],
  ['pack', '3x Pacote Cérbero', 11000, ['#9D8CCF', '#33333A', '#7DB8CF'], 0, 11], ['decor', 'Dossel e Chuva', 4100, ['#78BE9D', '#7DB8CF', '#fff'], 0],
  ['plate', 'Sol e Lua', 4100, ['#EBBA6C', '#7DB8CF', '#9D8CCF'], 0], ['effect', 'Portal para o Além', 4100, ['#E897AB', '#9D8CCF', '#7DB8CF'], 0]
].map((x, i) => ({ id: 'pt' + i, t: x[0], n: x[1], pts: x[2], a: x[3], excl: !!x[4], off: x[5] || 0, col: 'pontos', th: 'Fantasia', cl: 'Roxo', o: 900 + i }));
const ALL = CATALOG.concat(PONTOS);
const byId = (id) => ALL.find((x) => x.id === id);

/* ------------------------------------------------------------ arte (só CSS) */
function art(it, big) {
  const st = `--a:${it.a[0]};--b:${it.a[1]};--c:${it.a[2] || it.a[0]}`;
  const k = big ? ' big' : '';
  switch (it.t) {
    case 'decor': return `<span class="ja d${k}" style="${st}"><i class="av"></i><i class="rg"></i><i class="sp s1"></i><i class="sp s2"></i></span>`;
    case 'plate': return `<span class="ja p${k}" style="${st}"><i class="av"></i><i class="ln"></i><i class="gl"></i></span>`;
    case 'effect': return `<span class="ja e${k}" style="${st}"><i class="cd"></i><i class="gl"></i><i class="sp s1"></i><i class="sp s2"></i></span>`;
    case 'frame': return `<span class="ja f${k}" style="${st}"><i class="cd"></i><i class="br"></i></span>`;
    case 'credit': return `<span class="ja c${k}" style="${st}"><i class="cn"></i><i class="cn c2"></i></span>`;
    case 'badge': return `<span class="ja b${k}" style="${st}"><i class="gm"></i></span>`;
    default: return `<span class="ja k${k}" style="${st}"><i class="cd"></i><i class="br"></i><i class="av"></i><i class="rg"></i><i class="ln"></i></span>`;
  }
}
const money = (c) => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');
const priceHTML = (it) => (it.pts
  ? `<span class="jpr">${ic(I.coin, 13, '#55555F', 1.8)}${it.pts}${it.off ? ` <em>(-${it.off}%)</em>` : ''}</span>`
  : `<span class="jpr">${money(it.p)}${it.off ? ` <em>(-${it.off}%)</em>` : ''}</span>`);

/* ------------------------------------------------------------ estado */
const ST = { tab: 'feat', sort: 'foryou', seed: 1, types: [], theme: '', color: '', pts: false, hide: false, page: 1, q: '', dd: null, item: null, col: '', plan: 'year', qtab: 'all', qdone: {}, wishOpen: false };
const uid = () => (api().me && api().me() && api().me().id) || 'anon';
const wishKey = () => 'sq.wish.' + uid();
let wish = null;
const getWish = () => { if (!wish) { try { wish = JSON.parse(localStorage.getItem(wishKey()) || '[]') || []; } catch (e) { wish = []; } } return wish; };
const toggleWish = (id) => { const w = getWish(), i = w.indexOf(id); if (i >= 0) w.splice(i, 1); else w.push(id); try { localStorage.setItem(wishKey(), JSON.stringify(w)); } catch (e) { /* sem armazenamento */ } };
const soon = (msg) => { const t = api().toast; if (t) t(msg || 'Isso chega em breve'); };

/* ------------------------------------------------------------ peças */
function tile(it) {
  const on = getWish().includes(it.id);
  return `<div class="jt" role="button" tabindex="0" data-lj="item" data-id="${it.id}" aria-label="${esc(it.n)}">${it.excl ? `<span class="jx">${ic(I.coin, 11, '#1D1D22', 2)}EXCLUSIVO PARA PONTOS</span>` : ''}<button type="button" class="jh${on ? ' on' : ''}" data-lj="wish" data-id="${it.id}" aria-pressed="${on}" aria-label="Lista de desejos">${ic(I.heart, 15, on ? '#fff' : '#33333A', 2)}</button><span class="jart">${art(it)}</span><span class="jn">${esc(it.n)}</span>${priceHTML(it)}</div>`;
}
const grid = (list, cls) => `<div class="jg${cls ? ' ' + cls : ''}">${list.map(tile).join('')}</div>`;
function sortList(list) {
  const l = list.slice();
  if (ST.sort === 'low') l.sort((a, b) => (a.p || a.pts) - (b.p || b.pts));
  else if (ST.sort === 'high') l.sort((a, b) => (b.p || b.pts) - (a.p || a.pts));
  else if (ST.sort === 'name') l.sort((a, b) => a.n.localeCompare(b.n));
  else if (ST.sort === 'new') l.sort((a, b) => b.o - a.o);
  else if (ST.sort === 'pop') l.sort((a, b) => hash(a.id + 'p' + ST.seed) - hash(b.id + 'p' + ST.seed));
  else l.sort((a, b) => hash(a.id + ST.seed) - hash(b.id + ST.seed));
  return l;
}
const SORTS = [['foryou', 'Para você'], ['new', 'Adicionados recentemente'], ['low', 'Menor preço'], ['high', 'Maior preço'], ['name', 'Nome (A–Z)']];
const sel = (key, val, opts) => `<select class="jsel" data-lj-sel="${key}" aria-label="Ordenar por">${opts.map((o) => `<option value="${o[0]}"${o[0] === val ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
const banner = (c, label, cta, act, extra) => `<div class="jb" style="--a:${c.a[0]};--b:${c.a[1]};--c:${c.a[2]}"><div class="jbt"><b>${esc(c.n)}</b><small>${esc(label || '')}</small></div>${cta ? `<button type="button" class="jcta" data-lj="${act || 'soon'}" ${extra || ''}>${esc(cta)}</button>` : ''}<i class="jbs s1"></i><i class="jbs s2"></i><i class="jbs s3"></i></div>`;
const carousel = (id, list) => `<div class="jc"><div class="jtrack" id="${id}">${list.map(tile).join('')}</div><button type="button" class="jarr" data-lj="scroll" data-t="${id}" aria-label="Ver mais">${ic(I.r, 16, '#1D1D22', 2.2)}</button></div>`;

/* ------------------------------------------------------------ cabeçalho */
function head(title, icon, tabs) {
  return `<header class="x-ph lj-h"><div class="pt">${ic(icon, 22, '#33333A', 1.6)}</div>${tabs}</header>`;
}
function shopHead() {
  const t = (k, l, dd) => `<span class="jdd${dd ? ' has' : ''}"><button type="button" class="ftab${ST.tab === k ? ' on' : ''}" data-lj="${dd ? 'dd' : 'tab'}" data-k="${k}" aria-pressed="${ST.tab === k}"${dd ? ` aria-haspopup="true" aria-expanded="${ST.dd === k}"` : ''}>${l}${dd ? ic(I.d, 13, 'currentColor', 2.2) : ''}</button>${dd && ST.dd === k ? ddMenu(k) : ''}</span>`;
  return `<header class="x-ph lj-h"><div class="pt">${ic(I.shop, 22, '#33333A', 1.6)}</div><i class="dotsep" aria-hidden="true"></i>
  ${t('feat', 'Destaques')}${t('browse', 'Navegar', true)}${t('points', 'Loja de Pontos')}${t('games', 'Lojas do jogo', true)}
  <span class="tsp"></span><label class="jsearch">${ic(I.search, 15, '#55555F', 1.9)}<input id="lj-q" type="search" placeholder="Buscar na loja" value="${esc(ST.q)}" autocomplete="off" aria-label="Buscar na loja"></label>
  <button type="button" class="hov sq${ST.tab === 'wish' ? ' sel' : ''}" data-lj="wishtab" aria-label="Lista de desejos" title="Lista de desejos">${ic(I.heart, 18, '#33333A', 1.8)}</button>
  <span class="jpts" title="Seus Pontos">${ic(I.coin, 17, '#33333A', 1.7)}0</span></header>`;
}
function ddMenu(k) {
  if (k === 'games') return `<div class="pop jmenu" role="menu"><button type="button" class="pi" data-lj="soon" data-msg="As lojas de jogos chegam em breve"><span class="tx"><b>Em breve</b><small>Lojas de jogos parceiros</small></span></button></div>`;
  return `<div class="pop jmenu" role="menu"><button type="button" class="pi" data-lj="browse" data-type=""><span class="tx"><b>Tudo</b></span></button>${TYPES.map((x) => `<button type="button" class="pi" data-lj="browse" data-type="${x[0]}"><span class="tx"><b>${x[1]}</b></span></button>`).join('')}</div>`;
}

/* ------------------------------------------------------------ abas */
function featBody() {
  const hero = COLS[0], fl = sortList(CATALOG.filter((x) => x.t === 'pack' && x.col === 'neo')).slice(0, 4);
  const mid = CATALOG.filter((x) => x.col === 'lofi' && x.t !== 'plate').slice(0, 8);
  const style = sortList(CATALOG).slice(0, 40);
  return `<section class="jhero" style="--a:${hero.a[0]};--b:${hero.a[1]};--c:${hero.a[2]}"><div class="jht"><b>${esc(hero.n)}</b><small>Luzes, chuva e muito brilho</small></div><button type="button" class="jcta" data-lj="soon" data-msg="A compra de coleções chega em breve">Compre a Coleção</button><i class="jbs s1"></i><i class="jbs s2"></i><i class="jbs s3"></i></section>
  ${carousel('jc1', fl.concat(CATALOG.filter((x) => x.col === 'neo' && x.t === 'decor').slice(0, 3)))}
  <div class="jpair">${banner(COLS[1], 'Chegou a coleção', 'Bora lá!', 'soon', 'data-msg="A compra de coleções chega em breve"')}${banner(COLS[2], 'Para as noites longas', 'Bora lá!', 'soon', 'data-msg="A compra de coleções chega em breve"')}</div>
  <div class="jsec"><h2>Vibes LoFi</h2><button type="button" class="mbtn ghost sm" data-lj="col" data-c="lofi">Página da loja - Vibes LoFi</button></div>
  ${carousel('jc2', mid)}
  <div class="jsec"><h2>Encontre seu estilo ${ic(I.info, 15, '#62626D', 1.8)}</h2><span class="jctl"><label>Ordenar por</label>${sel('sort', ST.sort, SORTS)}<button type="button" class="mbtn ghost sm" data-lj="shuffle">Embaralhar!</button></span></div>
  ${grid(style)}
  <div class="jmore"><b>Tem muito mais</b><button type="button" class="mbtn" data-lj="browse" data-type="">Página da loja</button></div>
  <div class="jstrip" aria-hidden="true">${CATALOG.filter((x) => x.t === 'decor').slice(0, 12).map((x) => art(x, true)).join('')}</div>`;
}
function matches(it) {
  if (ST.types.length && !ST.types.includes(it.t)) return false;
  if (ST.theme && it.th !== ST.theme) return false;
  if (ST.color && it.cl !== ST.color) return false;
  if (ST.pts && !it.pts) return false;
  if (ST.col && it.col !== ST.col) return false;
  return true;
}
function browseBody() {
  const per = 40, list = sortList(CATALOG.filter(matches));
  const pages = Math.max(1, Math.ceil(list.length / per)); if (ST.page > pages) ST.page = pages;
  const cut = list.slice((ST.page - 1) * per, ST.page * per);
  const groups = COLS.map((c) => [c, cut.filter((x) => x.col === c.id)]).filter((g) => g[1].length);
  const side = `<aside class="jside" aria-label="Filtros"><h3>Tipo de item</h3>${TYPES.map((x) => `<label class="jck"><input type="checkbox" data-lj-ck="${x[0]}"${ST.types.includes(x[0]) ? ' checked' : ''}><span></span>${x[1]}</label>`).join('')}
  <h3>Exibir apenas</h3><label class="jck"><input type="checkbox" data-lj-ck="pts"${ST.pts ? ' checked' : ''}><span></span>Disponíveis com Pontos</label><label class="jck"><input type="checkbox" data-lj-ck="part"><span></span>Parcerias</label>
  <h3>Cor</h3><div class="jcol">${COLORS.map((c) => `<button type="button" class="jsw${ST.color === c[0] ? ' on' : ''}" data-lj="color" data-c="${c[0]}" style="background:${c[1]}" aria-label="${c[0]}" aria-pressed="${ST.color === c[0]}"></button>`).join('')}</div>
  <h3>Tema</h3>${THEMES.map((t) => `<button type="button" class="jth${ST.theme === t ? ' on' : ''}" data-lj="theme" data-t="${esc(t)}" aria-pressed="${ST.theme === t}">${ic(I.pal, 14, '#33333A', 1.7)}${esc(t)}</button>`).join('')}</aside>`;
  const main = groups.length ? groups.map(([c, items]) => `<section class="jcolg">${banner(c, '', '', '')}${grid(items)}</section>`).join('') : '<div class="jempty">Nenhum item encontrado com esses filtros.</div>';
  const pg = Array.from({ length: pages }, (_, i) => `<button type="button" class="jpg${ST.page === i + 1 ? ' on' : ''}" data-lj="page" data-n="${i + 1}" aria-current="${ST.page === i + 1}">${i + 1}</button>`).join('');
  return `<div class="jbar"><span class="jctl"><label>Ordenar por</label>${sel('sort', ST.sort, SORTS)}</span><button type="button" class="mbtn ghost sm" data-lj="hide">${ST.hide ? 'Mostrar filtros' : 'Ocultar filtros'} ${ic(I.sliders, 15, '#1D1D22', 1.8)}</button></div>
  <div class="jwrap${ST.hide ? ' nof' : ''}"><div class="jmain">${main}</div>${ST.hide ? '' : side}</div>
  <nav class="jpag" aria-label="Páginas"><button type="button" class="jpn" data-lj="page" data-n="${Math.max(1, ST.page - 1)}"${ST.page === 1 ? ' disabled' : ''}>${ic(I.l, 13, 'currentColor', 2.2)} Anterior</button>${pg}<button type="button" class="jpn" data-lj="page" data-n="${Math.min(pages, ST.page + 1)}"${ST.page === pages ? ' disabled' : ''}>Próximo ${ic(I.r, 13, 'currentColor', 2.2)}</button></nav>`;
}
function pointsBody() {
  const ex = PONTOS.filter((x) => x.excl), pop = sortList(PONTOS.filter((x) => !x.excl));
  return `<section class="jpt-hero"><div><h1>Apresentando os Pontos da Square</h1><p>Recompense seu jogo. Ganhe em missões. Gaste na loja.</p></div><button type="button" class="jcta" data-lj="goquests">Ir para a página das missões</button><span class="jgem" aria-hidden="true"></span></section>
  ${grid(ex)}
  <section class="jwhat"><div><h2>O que posso conseguir com Pontos?</h2><p>Gaste Pontos em decorações exclusivas ou pegue suas favoritas na loja principal. <a href="#" data-lj="soon" data-msg="Em breve: guia dos Pontos">Saiba mais.</a></p></div><span class="jgem sm" aria-hidden="true"></span></section>
  <div class="jsec"><h2>Escolhas Populares para Pontos</h2><span class="jctl"><label>Ordenar por</label>${sel('sort', ST.sort === 'foryou' ? 'pop' : ST.sort, [['pop', 'Em alta'], ['low', 'Menor preço'], ['high', 'Maior preço'], ['name', 'Nome (A–Z)']])}<button type="button" class="mbtn ghost sm" data-lj="shuffle">Embaralhar!</button></span></div>
  ${grid(pop)}`;
}
function searchBody() {
  const q = ST.q.trim().toLowerCase();
  const list = ALL.filter((x) => x.n.toLowerCase().includes(q) || (TLABEL[x.t] || '').toLowerCase().includes(q) || x.th.toLowerCase().includes(q));
  return `<div class="jsec"><h2>Resultados para “${esc(ST.q.trim())}” <small>${list.length} ${list.length === 1 ? 'item' : 'itens'}</small></h2></div>${list.length ? grid(list.slice(0, 80)) : '<div class="jempty">Nada encontrado. Tente outra palavra.</div>'}`;
}
function wishBody() {
  const l = getWish().map(byId).filter(Boolean);
  return `<div class="jsec"><h2>Lista de desejos <small>${l.length}</small></h2></div>${l.length ? grid(l) : '<div class="jempty">Sua lista de desejos está vazia. Toque no coração de um item para guardá-lo aqui.</div>'}`;
}
function gamesBody() { return '<div class="jempty">As lojas de jogos chegam em breve.</div>'; }
function bodyHTML() {
  if (ST.q.trim()) return searchBody();
  return ({ feat: featBody, browse: browseBody, points: pointsBody, wish: wishBody, games: gamesBody }[ST.tab] || featBody)();
}
function itemModal() {
  const it = byId(ST.item); if (!it) return '';
  const on = getWish().includes(it.id);
  return `<div class="jmod" data-lj="closeitem"><div class="jmb" role="dialog" aria-modal="true" aria-label="${esc(it.n)}"><button type="button" class="hov sq jx2" data-lj="closeitem" aria-label="Fechar">${ic(I.x, 16, '#55555F', 1.8)}</button>
  <div class="jpv">${art(it, true)}</div><div class="jinf"><small>${TLABEL[it.t]}${it.excl ? ' · exclusivo para Pontos' : ''}</small><h2>${esc(it.n)}</h2><div class="jpp">${priceHTML(it)}</div><p>Visual de exemplo da coleção ${esc((COLS.find((c) => c.id === it.col) || { n: 'Pontos' }).n)}. A compra de itens ainda não está disponível.</p>
  <div class="jact"><button type="button" class="mbtn" data-lj="soon" data-msg="A compra de itens chega em breve">${it.pts ? 'Resgatar com Pontos' : 'Comprar'}</button><button type="button" class="mbtn ghost" data-lj="wish" data-id="${it.id}">${ic(I.heart, 15, '#1D1D22', 1.9)} ${on ? 'Na lista de desejos' : 'Lista de desejos'}</button></div></div></div></div>`;
}
function shopHTML() {
  return `${shopHead()}<div class="x-pb"><div class="lj" id="lj"><div id="lj-body">${bodyHTML()}</div></div></div>${itemModal()}`;
}

/* ------------------------------------------------------------ missões */
const QG = [
  ['Crônicas de Vale', 'Estúdio Horizonte', '20/11', 'Projeto de arma exclusivo', 'Jogue Crônicas de Vale durante 15 minutos e ganhe um item exclusivo.', 'item', 'Jogar agora', 'Aceitar missão', ['#8F7BD8', '#7DB8CF']],
  ['Exoplaneta', 'Rádio Estrela', '20/11', '700 Pontos', 'Ouça a transmissão inteira e junte 700 Pontos.', 700, 'Ouvir', 'Executar missão', ['#7DB8CF', '#78BE9D']],
  ['Onde os Ventos Se Encontram', 'Estúdio Brisa', '21/11', '200 Pontos', 'Assista ao vídeo para ganhar 200 Pontos!', 200, 'Jogar agora', 'Assistir 2m', ['#E897AB', '#9D8CCF']],
  ['Cavalo Selvagem Nove', 'Luz de Vela Filmes', '22/11', '700 Pontos', 'Encontre 9 fitas escondidas para ganhar 700 Pontos.', 700, 'Adquira seu ingresso', 'Executar missão', ['#E8A06B', '#EBBA6C']],
  ['Carta e Estrela', 'Mesa Redonda Jogos', '23/11', '200 Pontos', 'Assista ao vídeo para ganhar 200 Pontos!', 200, 'Entrar no servidor', 'Assistir 2m', ['#33333A', '#9D8CCF']],
  ['Onde os Ventos Se Encontram', 'Estúdio Brisa', '23/11', '700 Pontos', 'Jogue durante 15 minutos e ganhe 700 Pontos.', 700, 'Jogar agora', 'Aceitar missão', ['#E897AB', '#7DB8CF']],
  ['Fim da Linha', 'Estúdio Grifo', '25/11', '700 Pontos', 'Jogue Fim da Linha durante 15 minutos e ganhe 700 Pontos.', 700, 'Jogar agora', 'Aceitar missão', ['#9A9AA7', '#E8A06B']],
  ['Arena 27', 'Liga Quadra', '25/11', 'Medalha de Especialista', 'Assista ao vídeo para desbloquear uma medalha de avatar.', 'item', 'Mais detalhes', 'Assistir 1m', ['#D9697A', '#EBBA6C']],
  ['Futebol de Bolso', 'Blocos & Cia', '25/11', '700 Pontos', 'Jogue durante 15 minutos com o Square aberto e ganhe 700 Pontos.', 700, 'Jogar agora', 'Aceitar missão', ['#78BE9D', '#7DB8CF']],
  ['Duna Dourada', 'Areia Pictures', '27/11', '200 Pontos', 'Assista ao vídeo para ganhar 200 Pontos!', 200, 'Entrar no servidor', 'Assistir 3m', ['#EBBA6C', '#E8A06B']],
  ['Raposa Azul', 'Fogueira Software', '29/11', '200 Pontos', 'Assista ao vídeo para ganhar 200 Pontos!', 200, 'Baixe aqui', 'Assistir 59s', ['#E8A06B', '#9D8CCF']],
  ['Square', 'Square', '30/11', '200 Pontos', 'Assista ao vídeo para ganhar 200 Pontos!', 200, 'Mais detalhes', 'Assistir 50s', ['#9D8CCF', '#E897AB']],
  ['Estrela Trilho', 'Cosmos Jogos', '01/12', 'Pacote de Missão da V4.7', 'Jogue durante 15 minutos e ganhe o Pacote de Missão da V4.7.', 'item', 'Jogar agora', 'Aceitar missão', ['#9D8CCF', '#D9697A']],
  ['Caçadores de Monstros', 'Estúdio Garra', '04/12', 'Decoração de avatar', 'Assista ao vídeo para desbloquear uma decoração de avatar.', 'item', 'Jogar agora', 'Assistir 2m', ['#78BE9D', '#B58B6B']],
  ['Costa Neon', 'Estúdio Maré', '07/12', 'Avatar Costa Neon', 'Assista ao vídeo para desbloquear o avatar Costa Neon.', 'item', 'Comprar agora', 'Assistir 29s', ['#E897AB', '#7DB8CF']],
  ['Exterminadores', 'Nível Infinito', '16/12', '200 Pontos', 'Assista ao trailer para ganhar 200 Pontos!', 200, 'Adicione à lista de desejos', 'Assistir 2m', ['#9A9AA7', '#E8A06B']]
];
function questCard(q, i) {
  const done = ST.qdone[i];
  const rew = typeof q[5] === 'number' ? `${ic(I.coin, 14, '#33333A', 1.8)} ${q[5]} Pontos` : q[3];
  return `<article class="jq"><div class="jqb" style="--a:${q[8][0]};--b:${q[8][1]}"><span class="jqn">${esc(q[0])}</span><button type="button" class="jqd" data-lj="soon" data-msg="Mais opções chegam em breve" aria-label="Mais opções">${ic(I.dots, 16, '#fff', 2)}</button><small>Promovido por <i class="jv">${ic(I.check, 9, '#fff', 3.4)}</i> ${esc(q[1])}<em>Termina em ${q[2]}</em></small></div>
  <div class="jqm"><span class="jqi">${typeof q[5] === 'number' ? ic(I.coin, 26, '#fff', 1.6) : ic(I.gift, 26, '#fff', 1.6)}</span><div class="jqt"><small>MISSÃO: ${esc(q[0].toUpperCase())}</small><b>Reivindique ${rew}</b>${typeof q[5] === 'number' ? '<span class="jqc">Desbloqueie 1,2x</span>' : ''}<p>${esc(q[4])}</p></div></div>
  <div class="jqa"><button type="button" class="mbtn ghost" data-lj="soon" data-msg="Esta ação chega em breve">${esc(q[6])}</button><button type="button" class="mbtn${done ? ' ghost' : ''}" data-lj="quest" data-i="${i}">${done ? ic(I.check, 15, '#1B6B47', 2.4) + ' Aceita' : esc(q[7])}</button></div></article>`;
}
function questsHTML() {
  const head2 = `<header class="x-ph lj-h"><div class="pt">${ic(I.quest, 22, '#33333A', 1.6)}</div><i class="dotsep" aria-hidden="true"></i><button type="button" class="ftab${ST.qtab === 'all' ? ' on' : ''}" data-lj="qtab" data-k="all">Todas as Missões</button><button type="button" class="ftab${ST.qtab === 'done' ? ' on' : ''}" data-lj="qtab" data-k="done">Missões Resgatadas</button><span class="tsp"></span><span class="jpts" title="Seus Pontos">${ic(I.coin, 17, '#33333A', 1.7)}0</span></header>`;
  if (ST.qtab === 'done') return `${head2}<div class="x-pb"><div class="lj" id="lj"><div class="jempty">Você ainda não resgatou nenhuma missão. Aceite uma missão para começar a juntar Pontos.</div></div></div>`;
  return `${head2}<div class="x-pb"><div class="lj" id="lj">
  <section class="jqh" style="--a:#8F7BD8;--b:#E897AB;--c:#7DB8CF"><span class="jtag">Patrocinado</span><div class="jqht"><span class="jlogo">COSTA<br>NEON</span><h1>COSTA NEON II</h1><p>A cidade nunca dorme. Jade e Rafa sempre souberam que as cartas estavam contra eles. Mas quando um golpe fácil dá errado, os dois se veem no lado mais sombrio da metrópole, obrigados a confiar um no outro mais do que nunca quiseram.</p><button type="button" class="jcta wh" data-lj="soon" data-msg="Isto é um exemplo: não há compra aqui">Comprar agora</button></div></section>
  <div class="jqrow"><section class="jpromo"><div class="jpa"><span class="jpad"></span></div><div class="jpb"><h2>Dê à Square um novo visual no estilo Costa Neon</h2><p>Deixe a Square com a cara de Costa Neon por tempo limitado, durante o evento de lançamento. Fica disponível para todos até 13/12/2026 e, para quem tem Square Plus, até 20/02/2027.</p><ul><li>${ic(I.pal, 14, '#33333A', 1.8)} Tema colorido</li><li><b>Aa</b> Estilo do nome exibido</li><li>${ic(I.user, 14, '#33333A', 1.8)} Ícone do aplicativo</li></ul><button type="button" class="mbtn" data-lj="soon" data-msg="Pré-visualização de temas chega em breve">Pré-visualizar tema</button></div></section>
  <section class="jdeco"><small class="jdt"><b>DECORAÇÃO DE AVATAR</b><em>${ic(I.quest, 11, '#33333A', 2)} 16D 13H</em></small><div class="jdc">${art({ t: 'decor', a: ['#E897AB', '#9D8CCF', '#7DB8CF'] }, true)}</div><b>Avatar Costa Neon</b><small>${ic(I.check, 11, '#1B6B47', 2.6)} Estúdio Maré · 0%</small></section></div>
  <div class="jsec"><h2>Missões disponíveis</h2><span class="jctl"><button type="button" class="mbtn ghost sm" data-lj="soon" data-msg="Ordenação de missões chega em breve">Sugestões ${ic(I.d, 13, '#1D1D22', 2.2)}</button><button type="button" class="mbtn ghost sm" data-lj="soon" data-msg="Filtros de missões chegam em breve">Filtros ${ic(I.sliders, 14, '#1D1D22', 1.8)}</button></span></div>
  <div class="jqg">${QG.map(questCard).join('')}</div>
  <section class="jqf"><span class="jlogo big">COSTA<br>NEON</span></section></div></div>`;
}

/* ------------------------------------------------------------ Square Plus */
const PLUS_ROWS = [
  ['Exiba o seu estilo', [['Insígnia de perfil Plus', 1, 1], ['Perfis personalizados por servidores', 0, 1], ['Sons de entrada personalizados', 0, 1], ['Estilos de nome exibido', 0, 1]]],
  ['Torne este lugar o seu espaço', [['Emojis animados e personalizados em qualquer lugar', 1, 1], ['Figurinhas personalizadas em qualquer lugar', 1, 1], ['Ícones personalizados do aplicativo', 1, 1], ['Sons de efeitos sonoros personalizados em qualquer lugar', 0, 1], ['+ de 20 temas coloridos do aplicativo', 0, 1]]],
  ['Sem limites, pura diversão', [['Envio de arquivos maiores', '50 MB', '1 GB'], ['Vídeos de fundo personalizados', 1, 1], ['Super-reações', 1, 1], ['Mantenha as recompensas de decoração de avatar de missão por mais tempo', 0, 1], ['Transmissões em HD', 0, 1], ['2 impulsos + 30% de desconto em impulsos adicionais', 0, 1], ['3 Passes de amigo Plus', 0, 1], ['Preços para membros da loja e itens exclusivos', 0, 1], ['Acesso antecipado', 0, 1], ['Mensagens mais longas, de até 4000 caracteres', 0, 1], ['Entre em até 200 servidores', 0, 1]]]
];
const cell = (v) => (typeof v === 'string' ? v : v ? ic(I.check, 14, '#1B6B47', 2.6) : ic(I.x, 13, '#9A9AA7', 2.2));
function plusHTML() {
  const yr = ST.plan === 'year', pl = (k, nm, ya, ma, sub, feats, pop) => `<div class="jplan${pop ? ' pop' : ''}"><h3>${nm}</h3><ul>${feats.map((f) => `<li>${ic(I.check, 13, '#1B6B47', 2.6)}${f}</li>`).join('')}</ul>
    <label class="jrad${pop && yr || !pop && ST.planb !== 'month' ? ' on' : ''}"><input type="radio" name="p-${k}" data-lj-plan="${k}:year"${(pop ? yr : ST.planb !== 'month') ? ' checked' : ''}><span></span><b>Anual</b>${sub ? `<small>${sub}</small>` : ''}<em>${ya}</em></label>
    <label class="jrad${(pop ? !yr : ST.planb === 'month') ? ' on' : ''}"><input type="radio" name="p-${k}" data-lj-plan="${k}:month"${(pop ? !yr : ST.planb === 'month') ? ' checked' : ''}><span></span><b>Mensal</b><em>${ma}</em></label>
    <button type="button" class="jcta${pop ? ' wh' : ' ghost'}" data-lj="subscribe">${ic(I.coin, 14, 'currentColor', 1.8)} Inscrever-se</button></div>`;
  return `<header class="x-ph lj-h"><div class="pt">${ic(I.coin, 22, '#33333A', 1.6)}</div><i class="dotsep" aria-hidden="true"></i>${[['top', 'Início'], ['news', 'Novidades'], ['best', 'Melhor do Plus'], ['plans', 'Planos'], ['cmp', 'Comparar']].map((x) => `<button type="button" class="ftab" data-lj="goto" data-t="jp-${x[0]}">${x[1]}</button>`).join('')}<span class="tsp"></span><button type="button" class="hov sq" data-lj="soon" data-msg="Sua lista de desejos do Plus chega em breve" aria-label="Lista de desejos">${ic(I.heart, 18, '#33333A', 1.8)}</button><button type="button" class="mbtn ghost sm" data-lj="soon" data-msg="Presentear chega em breve">${ic(I.gift, 15, '#1D1D22', 1.8)} Presentear Plus</button></header>
  <div class="x-pb"><div class="lj plus" id="lj">
  <section class="jp-hero" id="jp-top"><h1>DESBLOQUEIE UM MUNDO DE VANTAGENS COM SQUARE PLUS</h1><div class="jp-b"><button type="button" class="jcta wh" data-lj="subscribe">${ic(I.coin, 14, 'currentColor', 1.8)} Inscrever-se</button><button type="button" class="jcta ghost" data-lj="soon" data-msg="Presentear chega em breve">${ic(I.gift, 14, 'currentColor', 1.8)} Presentear Plus</button></div><small>O Square Plus é uma assinatura automática. Você pode cancelar a qualquer momento nas configurações.</small><span class="jgem" aria-hidden="true"></span></section>
  <h2 class="jp-h" id="jp-news">NOVIDADES</h2>
  <div class="jp-card wide"><div><span class="jlogo sm">COSTA<br>NEON</span><h3>Carregue junto com o seu equipamento</h3><p>Obtenha um projeto exclusivo para assinantes do Square Plus.</p><button type="button" class="mbtn ghost sm" data-lj="soon" data-msg="Ofertas chegam em breve">Desbloquear oferta</button></div><span class="jp-art a1" aria-hidden="true"></span></div>
  <div class="jp-two"><div class="jp-card"><span class="jp-art a2" aria-hidden="true"></span><h3>Dê à Square um novo visual no estilo Costa Neon</h3><p>Assinantes do Plus mantêm o tema por mais tempo. Disponível para todos até 13 de dezembro e para membros Plus até 20 de fevereiro.</p><button type="button" class="mbtn ghost sm" data-lj="soon" data-msg="Temas chegam em breve">Experimentar</button></div>
  <div class="jp-card"><span class="jp-art a3" aria-hidden="true"></span><h3>Ganhe mais Pontos com o Plus</h3><p>Transforme vitórias em megavitórias com recompensas de 1,2x ao assinar o Plus. Cancele a qualquer momento.</p><button type="button" class="mbtn ghost sm" data-lj="soon" data-msg="Em breve">Bora lá!</button></div></div>
  <h2 class="jp-h" id="jp-best">MELHOR DO PLUS</h2>
  <div class="jp-card wide"><div><h3>Exiba o seu estilo</h3><p>Adicione um avatar animado, tema de perfil, imagem de faixa e muito mais.</p><button type="button" class="mbtn ghost sm" data-lj="soon" data-msg="Em breve">Bora lá!</button></div><span class="jp-art a4" aria-hidden="true"></span></div>
  <div class="jp-card wide rev"><span class="jp-art a5" aria-hidden="true"></span><div><h3>Torne este lugar o seu espaço</h3><p>Escolha entre mais de 20 temas de cores e ícones de aplicativo personalizados.</p><button type="button" class="mbtn ghost sm" data-lj="soon" data-msg="Em breve">Bora lá!</button></div></div>
  <div class="jp-two"><div class="jp-card"><span class="jp-art a6" aria-hidden="true"></span><h3>Melhore seu jogo de emojis</h3><p>Empolgue, zoe e mande memes com emojis personalizados em qualquer lugar.</p></div><div class="jp-card"><span class="jp-art a7" aria-hidden="true"></span><h3>Sem limites, pura diversão</h3><p>Envie arquivos maiores e transmita em HD até 4K e 60FPS.</p></div></div>
  <h2 class="jp-h" id="jp-plans">ESCOLHA SEU PLANO</h2>
  <div class="jp-two plans">${pl('b', 'SQUARE PLUS BÁSICO', 'R$ 89,90', 'R$ 8,90', '', ['50 MB de uploads', 'Emoji personalizado em qualquer lugar', 'Super-reações ilimitadas', 'Insígnia Plus especial no seu perfil'], false)}${pl('p', 'SQUARE PLUS', 'R$ 249,99', 'R$ 24,99', 'R$ 20,83/mês cobrado anualmente', ['Tudo que está incluso no Básico, além de', '1 GB de uploads', 'Emoji personalizado em qualquer lugar', 'Super-reações ilimitadas', 'Transmissão de vídeo em HD', '2 impulsos de servidor', 'Perfis personalizados e muito mais!'], true)}</div>
  <h2 class="jp-h" id="jp-cmp">COMPARE NOSSOS PLANOS</h2>
  <div class="jtab" role="table"><div class="jtr jth2" role="row"><span>Preços e funcionalidades</span><span><b>Básico</b><small>R$ 8,90</small></span><span class="pop"><i>POPULAR</i><b>Plus</b><small>R$ 24,99</small></span></div>
  ${PLUS_ROWS.map((g) => `<div class="jtg">${g[0]}</div>${g[1].map((r) => `<div class="jtr" role="row"><span>${r[0]}</span><span>${cell(r[1])}</span><span class="pop">${cell(r[2])}</span></div>`).join('')}`).join('')}</div>
  <section class="jp-end"><h2>O QUE VOCÊ ESTÁ ESPERANDO?</h2><div class="jp-b"><button type="button" class="jcta wh" data-lj="subscribe">${ic(I.coin, 14, 'currentColor', 1.8)} Inscrever-se</button><button type="button" class="jcta ghost" data-lj="soon" data-msg="Presentear chega em breve">${ic(I.gift, 14, 'currentColor', 1.8)} Presentear Plus</button></div></section></div></div>`;
}

/* ------------------------------------------------------------ eventos */
const paint = () => { const b = document.getElementById('lj-body'); if (b) b.innerHTML = bodyHTML(); };
const full = () => { if (api().render) api().render(); };
const top = () => { const l = document.getElementById('lj'); if (l) l.scrollTop = 0; };
const resetFilters = () => { ST.types = []; ST.theme = ''; ST.color = ''; ST.pts = false; ST.col = ''; ST.page = 1; };

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-lj]');
  if (ST.dd && !(el && el.dataset.lj === 'dd') && !e.target.closest('.jmenu')) { ST.dd = null; if (!el) { full(); return; } }
  if (!el) return;
  const k = el.dataset.lj;
  if (k === 'soon') { e.preventDefault(); soon(el.dataset.msg); return; }
  if (k === 'wish') { e.stopPropagation(); toggleWish(el.dataset.id); if (ST.item) full(); else paint(); return; }
  if (k === 'item') { ST.item = el.dataset.id; full(); return; }
  if (k === 'closeitem') { if (e.target === el || el.classList.contains('jx2') || e.target.closest('.jx2')) { ST.item = null; full(); } return; }
  if (k === 'tab') { ST.tab = el.dataset.k; ST.q = ''; ST.dd = null; ST.item = null; if (ST.tab === 'browse') resetFilters(); full(); return; }
  if (k === 'dd') { ST.dd = ST.dd === el.dataset.k ? null : el.dataset.k; full(); return; }
  if (k === 'browse') { ST.tab = 'browse'; ST.q = ''; ST.dd = null; resetFilters(); if (el.dataset.type) ST.types = [el.dataset.type]; full(); top(); return; }
  if (k === 'col') { ST.tab = 'browse'; ST.q = ''; resetFilters(); ST.col = el.dataset.c; full(); top(); return; }
  if (k === 'wishtab') { ST.tab = ST.tab === 'wish' ? 'feat' : 'wish'; ST.q = ''; full(); return; }
  if (k === 'goquests') { if (api().go) api().go('quests'); return; }
  if (k === 'shuffle') { ST.seed++; if (ST.sort !== 'pop') ST.sort = 'foryou'; paint(); return; }
  if (k === 'scroll') { const t = document.getElementById(el.dataset.t); if (t) t.scrollBy({ left: Math.max(180, t.clientWidth * 0.8), behavior: 'smooth' }); return; }
  if (k === 'hide') { ST.hide = !ST.hide; paint(); return; }
  if (k === 'color') { ST.color = ST.color === el.dataset.c ? '' : el.dataset.c; ST.page = 1; paint(); return; }
  if (k === 'theme') { ST.theme = ST.theme === el.dataset.t ? '' : el.dataset.t; ST.page = 1; paint(); return; }
  if (k === 'page') { ST.page = Number(el.dataset.n) || 1; paint(); top(); return; }
  if (k === 'qtab') { ST.qtab = el.dataset.k; full(); return; }
  if (k === 'quest') { const i = el.dataset.i; ST.qdone[i] = !ST.qdone[i]; full(); soon(ST.qdone[i] ? 'Missão aceita. As recompensas chegam junto com os Pontos.' : 'Missão cancelada'); return; }
  if (k === 'goto') { const t = document.getElementById(el.dataset.t), l = document.getElementById('lj'); if (t && l) l.scrollTo({ top: t.offsetTop - 8, behavior: 'smooth' }); return; }
  if (k === 'subscribe') soon('Os pagamentos do Square Plus ainda não existem. Chega em breve!');
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.jt[data-lj="item"]')) { e.preventDefault(); ST.item = e.target.dataset.id; full(); }
  if (e.key === 'Escape' && ST.item) { ST.item = null; full(); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.ljSel) { ST.sort = t.value; ST.page = 1; paint(); return; }
  if (t.dataset && t.dataset.ljCk) {
    const k = t.dataset.ljCk;
    if (k === 'pts') ST.pts = t.checked; else if (k !== 'part') ST.types = t.checked ? ST.types.concat(k) : ST.types.filter((x) => x !== k);
    ST.page = 1; paint(); return;
  }
  if (t.dataset && t.dataset.ljPlan) { const [w, v] = t.dataset.ljPlan.split(':'); if (w === 'p') ST.plan = v; else ST.planb = v; full(); }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'lj-q') { ST.q = e.target.value; paint(); }
});

window.SQ_SHOP = { shopHTML, questsHTML, plusHTML, catalog: ALL, art, byId, TLABEL, money, priceHTML };
})();
