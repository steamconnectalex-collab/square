/* Shiqi — página de download: descobre o sistema e começa o download do instalador mais recente. */
(function () {
  var BASE = 'https://github.com/steamconnectalex-collab/shiqi-downloads/releases/latest/download/';
  var FILES = { win: ['Shiqi-Setup.exe', 'Windows'], linux: ['Shiqi.AppImage', 'Linux'] };
  var ua = navigator.userAgent || '', os = null;
  if (/Android|iPhone|iPad|iPod/i.test(ua)) os = 'mobile';
  else if (/Windows/i.test(ua)) os = 'win';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'mac';
  else if (/Linux|X11/i.test(ua)) os = 'linux';
  var $ = function (id) { return document.getElementById(id); };
  function btn(label, file) { var a = document.createElement('a'); a.className = 'b'; a.href = BASE + file; a.textContent = label; return a; }
  var box = $('b');
  if (FILES[os]) {
    var f = FILES[os];
    $('t').textContent = 'Baixando o Shiqi para ' + f[1];
    $('m').textContent = 'O download começa sozinho. Se não começar, use o botão abaixo.';
    box.appendChild(btn('Baixar para ' + f[1], f[0]));
    if (os === 'win') $('n').textContent = 'Se o Windows mostrar "Windows protegeu seu PC", toque em "Mais informações" e depois em "Executar assim mesmo". O aviso aparece porque o programa é novo.';
    setTimeout(function () { location.href = BASE + f[0]; }, 600);
  } else {
    $('t').textContent = os === 'mac' ? 'Em breve para Mac' : os === 'mobile' ? 'O programa é para computador' : 'Baixar o Shiqi';
    $('m').textContent = os === 'mobile' ? 'No celular, use o site direto no navegador: shiqi.com.br.' : 'Ainda não temos instalador para o seu sistema. Enquanto isso, use o site no navegador.';
    Object.keys(FILES).forEach(function (k) { box.appendChild(btn(FILES[k][1], FILES[k][0])); });
  }
})();
