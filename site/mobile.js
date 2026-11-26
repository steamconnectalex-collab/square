/* Shiqi. — aviso quando o celular/tablet está no modo "Site para computador" (o navegador ignora o ajuste à tela). */
(() => {
  'use strict';
  try {
    const side = Math.min(screen.width, screen.height);
    const coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    if (!coarse || side > 900 || window.innerWidth < side * 1.5) return;
    if (sessionStorage.getItem('sq.desk-hint')) return;
    const b = document.createElement('div');
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:999;display:flex;align-items:center;gap:12px;padding:14px 18px;background:#1D1D22;color:#fff;font:600 ' + Math.round(window.innerWidth / side * 14) + 'px/1.35 Inter,system-ui,sans-serif';
    b.innerHTML = '<span style="flex:1">Seu navegador está em “Site para computador”, por isso o Shiqi aparece pequeno. Toque nos três pontinhos (⋮) e desmarque “Site para computador”.</span><button type="button" style="flex:none;border:0;border-radius:8px;background:#fff;color:#1D1D22;font:inherit;padding:8px 14px">OK</button>';
    b.querySelector('button').onclick = () => { b.remove(); try { sessionStorage.setItem('sq.desk-hint', '1'); } catch (e) { /* sem armazenamento */ } };
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(b));
    if (document.body) document.body.appendChild(b);
  } catch (e) { /* sem aviso */ }
})();
