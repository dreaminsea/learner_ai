import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { getDbPath, getDb, closeDb } from './persistence/database'
import { runMigrations } from './persistence/migrate'

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
    shell.openExternal(details.url)
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
    return {
      deepseekApiKey: '',
      model: 'deepseek-chat',
      dailyMinutes: 60,
      reminderTime: '09:00'
    }
  })

  ipcMain.handle('app:setSettings', (_event, settings) => {
    return { ...settings }
  })

  ipcMain.handle('app:getDbPath', () => getDbPath())
}

app.whenReady().then(() => {
  registerIpcHandlers()

  try {
    runMigrations()
    console.log('[app] Database ready at:', getDbPath())
  } catch (err) {
    console.error('[app] Database init failed:', err)
  }

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
