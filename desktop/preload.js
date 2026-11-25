const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('squareDesktop', {
  isDesktop: true,
  platform: process.platform,
  setBadge: (n) => ipcRenderer.send('app:badge', n)
});
