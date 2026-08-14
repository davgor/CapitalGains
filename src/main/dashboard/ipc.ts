import { ipcMain } from 'electron'
import type { DashboardService } from './service'

export function registerDashboardHandlers(service: DashboardService): void {
  ipcMain.handle('dashboard:getSnapshot', () => service.getSnapshot())
  ipcMain.handle('dashboard:setDailyLimit', (_e, dailyLimitUsd: number) =>
    service.setDailyLimit(dailyLimitUsd)
  )
  ipcMain.handle('dashboard:getSettings', () => service.getSettings())
  ipcMain.handle('dashboard:saveSettings', (_e, patch: Parameters<DashboardService['saveSettings']>[0]) =>
    service.saveSettings(patch)
  )
  ipcMain.handle('dashboard:addFactory', (_e, name: string) => service.addFactory(name))
  ipcMain.handle('dashboard:renameFactory', (_e, id: string, name: string) =>
    service.renameFactory(id, name)
  )
  ipcMain.handle(
    'dashboard:openStageModal',
    (_e, factoryId: string, stage: Parameters<DashboardService['openStageModal']>[1]) =>
      service.openStageModal(factoryId, stage)
  )
  ipcMain.handle(
    'dashboard:confirmPromoteAction',
    (_e, factoryId: string, action: 'promote' | 'kill' | 'clone') =>
      service.confirmPromoteAction(factoryId, action)
  )
}
