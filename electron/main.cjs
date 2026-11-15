const { app, BrowserWindow, session, shell, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const devServerUrl = process.env.VITE_DEV_SERVER_URL

const iconFile = path.join(__dirname, '..', 'build', 'icon.png')
const windowIcon = fs.existsSync(iconFile) ? iconFile : undefined

// Ensure consistent application name for window managers and desktop compositors
app.setName('Eva')

// Enable auto ozone platform for modern Wayland/X11 compatibility on Linux
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
}

function applyCsp() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; font-src 'self' data:; media-src 'self'",
        ],
      },
    })
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 880,
    minHeight: 600,
    transparent: false,
    backgroundColor: '#09090b',
    title: 'Eva - Advanced AI Chatbot',
    icon: windowIcon,
    show: false,
    frame: false,
    hasShadow: true,
    roundedCorners: true,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    // Only open safe external http/https links
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url)
      }
    } catch {
      // invalid url
    }
    return { action: 'deny' }
  })

  if (devServerUrl) {
    win.loadURL(devServerUrl)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// IPC Handlers for frameless blended window controls with sender validation
function getTargetWindow(event) {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return null
  return win
}

ipcMain.on('window-minimize', (event) => {
  const win = getTargetWindow(event)
  if (win) win.minimize()
})

ipcMain.on('window-maximize', (event) => {
  const win = getTargetWindow(event)
  if (win) {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  }
})

ipcMain.on('window-close', (event) => {
  const win = getTargetWindow(event)
  if (win) win.close()
})

ipcMain.handle('window-is-maximized', (event) => {
  const win = getTargetWindow(event)
  return win ? win.isMaximized() : false
})

app.whenReady().then(() => {
  if (!devServerUrl) applyCsp()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
