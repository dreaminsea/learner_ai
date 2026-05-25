import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { getDbPath, initDb, closeDb } from './persistence/database'
import { runMigrations } from './persistence/migrate'
import { getSettings, setSettings } from './persistence/repositories/settingsRepository'
import { registerPlanIpcHandlers } from './ipc/plan.ipc'

const ALLOWED_URL_SCHEMES = ['https:', 'http:']

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const parsed = new URL(details.url)
      if (ALLOWED_URL_SCHEMES.includes(parsed.protocol)) {
        shell.openExternal(details.url)
      }
    } catch {
      // ignore unparseable URLs
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function registerIpcHandlers(): void {
  ipcMain.handle('app:getVersion', () => '0.1.0')

  ipcMain.handle('app:getSettings', () => {
    return getSettings()
  })

  ipcMain.handle('app:setSettings', (_event, partial) => {
    return setSettings(partial)
  })

  ipcMain.handle('app:getDbPath', () => getDbPath())

  registerPlanIpcHandlers()
}

app.whenReady().then(async () => {
  try {
    await initDb()
    await runMigrations()
    console.log('[app] Database ready at:', getDbPath())
  } catch (err) {
    console.error('[app] Database init failed:', err)
  }

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
