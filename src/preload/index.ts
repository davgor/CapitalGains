import { contextBridge, ipcRenderer } from 'electron'
import type { AutoUpdateState } from '../shared/autoUpdate/types'
import type { DashboardApi } from '../shared/engine/dashboardApi'
import type { AppSettingsPublic, Factory } from '../shared/engine/types'

const autoUpdate = {
  getState: (): Promise<AutoUpdateState> => ipcRenderer.invoke('autoUpdate:getState'),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('autoUpdate:checkForUpdates'),
  quitAndInstall: (): Promise<void> => ipcRenderer.invoke('autoUpdate:quitAndInstall'),
  onEvent: (listener: (state: AutoUpdateState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: AutoUpdateState): void => {
      listener(state)
    }
    ipcRenderer.on('autoUpdate:event', handler)
    return () => ipcRenderer.removeListener('autoUpdate:event', handler)
  }
}

const appInfo = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
}

const dashboard: DashboardApi = {
  getSnapshot: () => ipcRenderer.invoke('dashboard:getSnapshot'),
  setDailyLimit: (dailyLimitUsd: number) =>
    ipcRenderer.invoke('dashboard:setDailyLimit', dailyLimitUsd),
  getSettings: () => ipcRenderer.invoke('dashboard:getSettings'),
  saveSettings: (patch) => ipcRenderer.invoke('dashboard:saveSettings', patch),
  addFactory: (name: string): Promise<Factory> =>
    ipcRenderer.invoke('dashboard:addFactory', name),
  renameFactory: (id: string, name: string): Promise<Factory> =>
    ipcRenderer.invoke('dashboard:renameFactory', id, name),
  openStageModal: (factoryId, stage) =>
    ipcRenderer.invoke('dashboard:openStageModal', factoryId, stage),
  confirmPromoteAction: (factoryId, action) =>
    ipcRenderer.invoke('dashboard:confirmPromoteAction', factoryId, action)
}

contextBridge.exposeInMainWorld('autoUpdate', autoUpdate)
contextBridge.exposeInMainWorld('appInfo', appInfo)
contextBridge.exposeInMainWorld('dashboard', dashboard)

export type AutoUpdateApi = typeof autoUpdate
export type AppInfoApi = typeof appInfo
export type { DashboardApi, AppSettingsPublic }
