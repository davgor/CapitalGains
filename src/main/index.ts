import { app, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { join } from 'node:path'
import { initAutoUpdate, registerAutoUpdateHandlers } from './autoUpdate'
import { registerDashboardHandlers } from './dashboard/ipc'
import { createDashboardService } from './dashboard/service'
import { openEngineStore } from './engine/db/store'
import { setupGlobalErrorLogging } from './logger'
import { createSecureSecretsStore, defaultSecretsPath } from './secrets/secureStore'

setupGlobalErrorLogging()

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

function registerAppVersionHandler(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
}

function bootDashboard(): void {
  const dbPath = join(app.getPath('userData'), 'engine.sqlite')
  const store = openEngineStore(dbPath)
  const secrets = createSecureSecretsStore({
    filePath: defaultSecretsPath(app.getPath('userData')),
    crypto: {
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      encryptString: (plain) => safeStorage.encryptString(plain),
      decryptString: (blob) => safeStorage.decryptString(blob)
    }
  })
  const service = createDashboardService({ store, secrets })
  registerDashboardHandlers(service)

  app.on('will-quit', () => {
    store.close()
  })
}

app.whenReady().then(() => {
  registerAppVersionHandler()
  registerAutoUpdateHandlers()
  bootDashboard()
  initAutoUpdate()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
