#!/usr/bin/env node
// Gera site/home.js a partir do protótipo design/Main.dc.html.
//
// O protótipo usa um mini-template (<sc-for>, <sc-if>, {{valor}}) que só funciona dentro do canvas.
// Este script "renderiza" o protótipo em HTML comum, ajusta os links para o site real e grava
// o resultado em site/home.js (window.SQ_HOME), que o app.js mostra na rota #home.
//
// Uso: node tools/build-home.js
// Rode de novo sempre que design/Main.dc.html mudar.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'design', 'Main.dc.html');
const OUT = path.join(ROOT, 'site', 'home.js');

const html = fs.readFileSync(SRC, 'utf8');

// 1) dados do protótipo (a classe Component do <script type="text/x-dc">)
const code = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const defaults = JSON.parse(html.match(/<script type="text\/x-dc"[^>]*data-props="([^"]*)"/)[1].replace(/&quot;/g, '"'));
class DCLogic { constructor() { this.props = {}; Object.keys(defaults).forEach((k) => { if (defaults[k] && 'default' in defaults[k]) this.props[k] = defaults[k].default; }); } }
const Component = new Function('DCLogic', code + '\nreturn Component;')(DCLogic);
const vals = new Component().renderVals();

// 2) trecho do template (sem <helmet> e sem comentários)
let tpl = html.match(/<x-dc>([\s\S]*)<\/x-dc>/)[1];
tpl = tpl.replace(/<helmet>[\s\S]*?<\/helmet>/, '').replace(/<!--[\s\S]*?-->/g, '');

// 3) mini-renderizador
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const get = (ctx, p) => p.trim().split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);

function findClose(s, from, tag) {
  const open = new RegExp('<' + tag + '[\\s>]', 'g');
  const close = '</' + tag + '>';
  let depth = 1, i = from;
  for (;;) {
    open.lastIndex = i;
    const o = open.exec(s);
    const c = s.indexOf(close, i);
    if (c < 0) throw new Error('falta fechar <' + tag + '>');
    if (o && o.index < c) { depth++; i = o.index + 1; } else { depth--; if (depth === 0) return c; i = c + close.length; }
  }
}

function render(s, ctx) {
  let out = '';
  const re = /<(sc-for|sc-if)\s([^>]*)>/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    out += subst(s.slice(last, m.index), ctx);
    const tag = m[1];
    const end = findClose(s, re.lastIndex, tag);
    const inner = s.slice(re.lastIndex, end);
    const attr = (n) => { const a = m[2].match(new RegExp('\\b' + n + '="\\{\\{([^}]*)\\}\\}"')); return a ? a[1] : null; };
    if (tag === 'sc-for') {
      const list = get(ctx, attr('list'));
      const as = m[2].match(/\bas="([^"]+)"/)[1];
      if (!Array.isArray(list)) throw new Error('lista inexistente: ' + attr('list'));
      list.forEach((item) => { out += render(inner, Object.assign({}, ctx, { [as]: item })); });
    } else if (get(ctx, attr('value'))) {
      out += render(inner, ctx);
    }
    last = end + ('</' + tag + '>').length;
    re.lastIndex = last;
  }
  return out + subst(s.slice(last), ctx);
}
function subst(s, ctx) {
  return s.replace(/\{\{([^}]+)\}\}/g, (_, p) => {
    const v = get(ctx, p);
    if (v === undefined) throw new Error('valor inexistente: {{' + p + '}}');
    return esc(v);
  });
}

let out = render(tpl, vals);

// 4) ajustes para o site real
out = out.replace(/\s*\n\s*/g, ' ').trim();                                   // compacta espaços
out = out.replace(/Shiqi\.\./g, 'Shiqi.');                                // "Shiqi.." (marca já termina em ponto)
out = out.replace(/^<div style="position: relative;/, '<div class="home" style="position: relative;');
out = out.replace(/<a href="Auth\.dc\.html"/g, '<a href="#login"');           // Entrar / Abrir no navegador
let first = true;
out = out.replace(/<a href="#"([^>]*)>([\s\S]*?)<\/a>/g, (all, attrs, inner) => {
  if (first) { first = false; return `<a href="#home"${attrs}>${inner}</a>`; }  // logo = voltar ao topo
  const msg = /Baixar para Windows/.test(inner) ? ' data-msg="O app para Windows chega em breve."' : '';
  return `<a href="#home" data-act="soon"${msg}${attrs}>${inner}</a>`;          // links ainda sem destino
});
if (/href="#"/.test(out) || /\.dc\.html/.test(out) || /\{\{|sc-for|sc-if/.test(out)) throw new Error('sobrou template ou link por converter');

const css = '<style>.home a:hover{color:#000}</style>';
const body = (css + out).replace(/> </g, '>\n<');   // uma etiqueta por linha (mais fácil de ler e versionar)
if (/[`\\]|\$\{/.test(body)) throw new Error('o HTML tem crase, barra invertida ou ${ — não cabe num template literal');
fs.writeFileSync(OUT, '// ARQUIVO GERADO por tools/build-home.js a partir de design/Main.dc.html. Não edite à mão.\nwindow.SQ_HOME = `\n' + body + '\n`;\n');
console.log('site/home.js gerado:', fs.statSync(OUT).size, 'bytes');
