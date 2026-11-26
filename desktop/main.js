// Shiqi para computador — abre o site oficial dentro de uma janela própria.
const { app, BrowserWindow, Tray, Menu, session, shell, desktopCapturer, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const SITE = 'https://square-chat-silk.vercel.app/';
const HOST = new URL(SITE).host;
const isMac = process.platform === 'darwin';

let win = null, tray = null, quitting = false, pickerWin = null;

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => showWindow());
}

// ---------- lembrar tamanho e posição da janela ----------
const stateFile = () => path.join(app.getPath('userData'), 'janela.json');
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; }
}
function saveState() {
  if (!win || win.isDestroyed()) return;
  try {
    const maximized = win.isMaximized();
    const b = maximized ? (loadState().bounds || win.getNormalBounds()) : win.getBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ bounds: b, maximized }));
  } catch {}
}
function visibleBounds(b) {
  if (!b) return null;
  const ok = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y;
  });
  return ok ? b : null;
}

function showWindow() {
  if (!win) { createWindow(); return; }
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

function createWindow() {
  const st = loadState();
  const b = visibleBounds(st.bounds);
  win = new BrowserWindow({
    width: b ? b.width : 1280, height: b ? b.height : 800,
    x: b ? b.x : undefined, y: b ? b.y : undefined,
    minWidth: 480, minHeight: 600,
    backgroundColor: '#F4F4F6',
    title: 'Shiqi',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true
    }
  });
  win.removeMenu();
  if (st.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());

  win.loadURL(SITE);

  // falha de rede: mostra página de "sem internet" com botão de tentar de novo
  win.webContents.on('did-fail-load', (_e, code, _d, url, isMain) => {
    if (!isMain || code === -3) return; // -3 = cancelado
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { u: SITE } });
  });

  // links externos abrem no navegador; só o site da Shiqi fica na janela
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:')) return;
    let h = ''; try { h = new URL(url).host; } catch {}
    if (h !== HOST) { e.preventDefault(); openExternal(url); }
  });

  win.on('resize', saveState);
  win.on('move', saveState);
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });
  win.on('closed', () => { win = null; });
}

function openExternal(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') shell.openExternal(url);
  } catch {}
}

// ---------- permissões (só o site da Shiqi) ----------
function setupPermissions() {
  const ses = session.defaultSession;
  const allowed = new Set(['media', 'display-capture', 'notifications', 'clipboard-sanitized-write', 'fullscreen', 'audioCapture', 'videoCapture']);
  const fromSite = (wc, url) => {
    try { return new URL(url || wc.getURL()).host === HOST; } catch { return false; }
  };
  ses.setPermissionRequestHandler((wc, permission, cb, details) => cb(allowed.has(permission) && fromSite(wc, details && details.requestingUrl)));
  ses.setPermissionCheckHandler((wc, permission, origin) => allowed.has(permission) && fromSite(wc, origin));

  // compartilhar tela: abre o nosso seletor de telas e janelas
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: false });
      if (!sources.length) return callback({});
      const chosen = await pickSource(sources);
      if (!chosen) return callback({});
      const src = sources.find((s) => s.id === chosen);
      callback(src ? { video: src } : {});
    } catch { callback({}); }
  }, { useSystemPicker: false });
}

function pickSource(sources) {
  return new Promise((resolve) => {
    if (pickerWin && !pickerWin.isDestroyed()) pickerWin.close();
    pickerWin = new BrowserWindow({
      parent: win || undefined, modal: !!win, width: 640, height: 520, resizable: false, minimizable: false, maximizable: false,
      title: 'Compartilhar tela', backgroundColor: '#FFFFFF', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'picker-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    pickerWin.removeMenu();
    let done = false;
    const finish = (id) => { if (done) return; done = true; ipcMain.removeListener('picker:choose', onChoose); resolve(id); if (pickerWin && !pickerWin.isDestroyed()) pickerWin.close(); };
    const onChoose = (_e, id) => finish(id || null);
    ipcMain.on('picker:choose', onChoose);
    pickerWin.on('closed', () => { finish(null); pickerWin = null; });
    pickerWin.loadFile(path.join(__dirname, 'picker.html'));
    pickerWin.webContents.once('did-finish-load', () => {
      pickerWin.webContents.send('picker:sources', sources.map((s) => ({ id: s.id, name: s.name, kind: s.id.startsWith('screen') ? 'screen' : 'window', thumb: s.thumbnail.toDataURL() })));
    });
  });
}

// ---------- bandeja do sistema ----------
function createTray() {
  let img = nativeImage.createFromPath(path.join(__dirname, 'build', 'tray.png'));
  if (img.isEmpty()) img = nativeImage.createEmpty();
  tray = new Tray(img);
  tray.setToolTip('Shiqi.');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Shiqi.', click: showWindow },
    { type: 'separator' },
    { label: 'Sair', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', showWindow);
}

// ---------- atualização automática ----------
function setupUpdates() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', () => {});
    const check = () => autoUpdater.checkForUpdates().catch(() => {});
    check();
    setInterval(check, 4 * 60 * 60 * 1000);
  } catch {}
}

ipcMain.on('app:retry', (_e, url) => { if (win) win.loadURL(url && url.startsWith(SITE) ? url : SITE); });
ipcMain.on('app:badge', (_e, n) => {
  if (app.setBadgeCount) app.setBadgeCount(Number(n) || 0);
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (isMac) return; /* continua na bandeja */ });
app.on('activate', showWindow);

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('app.square.desktop');
  setupPermissions();
  createWindow();
  createTray();
  setupUpdates();
});
