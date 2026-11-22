// Isolated Chromium host: never opens EVA's real user data or credentials.
const { app, BrowserWindow } = require('electron')
if (!process.env.EVA_TEST_DATA_DIR || !process.env.EVA_TEST_URL) throw new Error('Missing isolated test configuration')
app.setPath('userData', process.env.EVA_TEST_DATA_DIR)
app.whenReady().then(() => {
  const window = new BrowserWindow({ width: 1440, height: 1000, show: true, webPreferences: { contextIsolation: true, backgroundThrottling: false } })
  window.loadURL(process.env.EVA_TEST_URL)
})
app.on('window-all-closed', () => app.quit())
