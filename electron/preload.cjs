const { contextBridge, ipcRenderer } = require('electron')

const desktopApi = {
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
}

// Expose modern evaDesktop and legacy nexusDesktop for backwards compatibility
contextBridge.exposeInMainWorld('evaDesktop', desktopApi)
contextBridge.exposeInMainWorld('nexusDesktop', desktopApi)
