const { app, BrowserWindow, session, shell, ipcMain, safeStorage, nativeTheme } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')

const devServerUrl = process.env.VITE_DEV_SERVER_URL

const iconDark = path.join(__dirname, 'icons', 'icon-dark.png')
const iconLight = path.join(__dirname, 'icons', 'icon-light.png')
const defaultIcon = path.join(__dirname, '..', 'build', 'icon.png')

function getThemeIconPath(theme) {
  if (theme === 'light') {
    if (fs.existsSync(iconLight)) return iconLight
  } else {
    if (fs.existsSync(iconDark)) return iconDark
  }
  return fs.existsSync(defaultIcon) ? defaultIcon : undefined
}

// Ensure consistent application name for window managers and desktop compositors
app.setName('Eva')

// Safe one-time data directory migration from legacy Nexus storage to Eva
function migrateLegacyUserDataIfNeeded() {
  try {
    const appData = app.getPath('appData')
    const currentPath = app.getPath('userData')
    const legacyPath = path.join(appData, 'nexus')

    if (currentPath !== legacyPath && fs.existsSync(legacyPath)) {
      const currentLocalStorage = path.join(currentPath, 'Local Storage')
      const legacyLocalStorage = path.join(legacyPath, 'Local Storage')

      if (!fs.existsSync(currentLocalStorage) && fs.existsSync(legacyLocalStorage)) {
        fs.mkdirSync(currentPath, { recursive: true })
        fs.cpSync(legacyLocalStorage, currentLocalStorage, { recursive: true, errorOnExist: false })
      }
    }
  } catch {
    // Non-fatal: do not block startup if migration fails
  }
}

// Credentials storage using safeStorage (OS Keychain / Secret Service / DPAPI)
function getCredentialsFile() {
  return path.join(app.getPath('userData'), 'eva-credentials.enc.json')
}

function loadEncryptedCredentials() {
  try {
    const file = getCredentialsFile()
    if (!fs.existsSync(file)) return {}
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

function saveEncryptedCredentials(data) {
  try {
    const file = getCredentialsFile()
    fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 })
  } catch {
    // Failed to write credentials file
  }
}

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
  const isDark = nativeTheme.shouldUseDarkColors
  const initialIcon = getThemeIconPath(isDark ? 'dark' : 'light')

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 880,
    minHeight: 600,
    transparent: false,
    backgroundColor: isDark ? '#12100E' : '#FAFAFA',
    title: 'Eva - Advanced AI Chatbot',
    icon: initialIcon,
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

function validateIpcSender(event) {
  const url = event.senderFrame ? event.senderFrame.url : null
  if (!url) return true
  if (url.startsWith('file://') || url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:')) {
    return true
  }
  throw new Error(`Unauthorized IPC call from origin: ${url}`)
}

// Secure Storage IPC Handlers
ipcMain.handle('secure-storage-is-available', (event) => {
  validateIpcSender(event)
  return !!(safeStorage && safeStorage.isEncryptionAvailable())
})

ipcMain.handle('secure-storage-get', (event, key) => {
  validateIpcSender(event)
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) return null
  const creds = loadEncryptedCredentials()
  const encBase64 = creds[key]
  if (!encBase64) return null
  try {
    return safeStorage.decryptString(Buffer.from(encBase64, 'base64'))
  } catch {
    return null
  }
})

ipcMain.handle('secure-storage-set', (event, key, plainText) => {
  validateIpcSender(event)
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) return false
  const creds = loadEncryptedCredentials()
  try {
    const encBuffer = safeStorage.encryptString(plainText)
    creds[key] = encBuffer.toString('base64')
    saveEncryptedCredentials(creds)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('secure-storage-delete', (event, key) => {
  validateIpcSender(event)
  const creds = loadEncryptedCredentials()
  if (key in creds) {
    delete creds[key]
    saveEncryptedCredentials(creds)
    return true
  }
  return false
})

// Desktop OAuth Loopback Server for Google PKCE
ipcMain.handle('oauth-google-start', async (event, authUrl, port = 54321) => {
  validateIpcSender(event)
  return new Promise((resolve, reject) => {
    let server = null
    const timeout = setTimeout(() => {
      if (server) {
        try { server.close() } catch {}
      }
      reject(new Error('OAuth authentication timed out after 5 minutes.'))
    }, 5 * 60 * 1000)

    server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url, `http://127.0.0.1:${port}`)
        if (parsedUrl.pathname === '/oauth2callback' || parsedUrl.pathname === '/') {
          const code = parsedUrl.searchParams.get('code')
          const state = parsedUrl.searchParams.get('state')
          const error = parsedUrl.searchParams.get('error')

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          if (error) {
            res.end(`<html><body style="font-family:system-ui;background:#18181b;color:#f87171;text-align:center;padding:60px 20px;"><h2>Authentication Failed</h2><p style="color:#a1a1aa;">${error}</p></body></html>`)
            clearTimeout(timeout)
            try { server.close() } catch {}
            reject(new Error(error))
            return
          }

          res.end(`<html><body style="font-family:system-ui;background:#18181b;color:#fff;text-align:center;padding:60px 20px;"><div style="max-width:400px;margin:0 auto;background:#27272a;padding:32px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.5);"><h2 style="color:#60a5fa;margin-top:0;">Authentication Successful</h2><p style="color:#a1a1aa;font-size:14px;">Google Drive connected to Eva. You may close this tab and return to the application.</p></div></body></html>`)
          clearTimeout(timeout)
          try { server.close() } catch {}
          resolve({ code, state })
        }
      } catch {
        // ignore invalid request
      }
    })

    server.listen(port, '127.0.0.1', () => {
      shell.openExternal(authUrl)
    })

    server.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Failed to start OAuth callback listener on port ${port}: ${err.message}`))
    })
  })
})

// Dynamic Theme Icon Switching: updates window taskbar/titlebar and dock icons
ipcMain.on('theme-icon-change', (event, theme) => {
  validateIpcSender(event)
  const icon = getThemeIconPath(theme)
  const win = getTargetWindow(event)
  if (win && !win.isDestroyed() && icon) {
    try { win.setIcon(icon) } catch {}
  }
  if (process.platform === 'darwin' && app.dock && icon) {
    try { app.dock.setIcon(icon) } catch {}
  }
})

// Listen to OS theme change and synchronize windows
nativeTheme.on('updated', () => {
  const currentTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  const icon = getThemeIconPath(currentTheme)
  if (icon) {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        try { win.setIcon(icon) } catch {}
      }
    }
    if (process.platform === 'darwin' && app.dock) {
      try { app.dock.setIcon(icon) } catch {}
    }
  }
})

app.whenReady().then(() => {
  migrateLegacyUserDataIfNeeded()
  if (!devServerUrl) applyCsp()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
