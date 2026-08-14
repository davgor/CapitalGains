import { saveAppSettingsPatch } from '../../shared/engine/appSettings'
import type { DashboardSnapshot, StageModalPayload } from '../../shared/engine/dashboardApi'
import type { AppSettingsPublic, Factory } from '../../shared/engine/types'
import type { EngineStore } from '../engine/db/store'
import type { SecureSecretsStore } from '../secrets/secureStore'
import { addFactory, renameFactory } from './serviceFactoryActions'
import { confirmPromoteAction as runPromoteAction } from './servicePromote'
import { buildDashboardSnapshot, readSettings } from './serviceSnapshot'
import { openStageModalForFactory } from './serviceStageModal'

export interface DashboardService {
  getSnapshot(): DashboardSnapshot
  setDailyLimit(dailyLimitUsd: number): DashboardSnapshot
  getSettings(): AppSettingsPublic
  saveSettings(patch: {
    friction?: AppSettingsPublic['friction']
    risk?: AppSettingsPublic['risk']
    promoteThresholds?: AppSettingsPublic['promoteThresholds']
    controlFloorWeight?: number
    explorationAllotmentUsd?: number
    dailyLimitUsd?: number
    cursorApiKey?: string
    marketDataKey?: string
  }): AppSettingsPublic
  addFactory(name: string): Factory
  renameFactory(id: string, name: string): Factory
  openStageModal(factoryId: string, stage: StageModalPayload['stage']): StageModalPayload
  confirmPromoteAction(
    factoryId: string,
    action: 'promote' | 'kill' | 'clone'
  ): DashboardSnapshot
}

export function createDashboardService(opts: {
  store: EngineStore
  secrets: SecureSecretsStore
  now?: () => Date
}): DashboardService {
  const now = opts.now ?? (() => new Date())
  const snapshot = (): DashboardSnapshot =>
    buildDashboardSnapshot(opts.store, opts.secrets, now)

  return {
    getSnapshot: snapshot,
    setDailyLimit(dailyLimitUsd) {
      saveAppSettingsPatch(opts.store, { dailyLimitUsd })
      return snapshot()
    },
    getSettings: () => readSettings(opts.store, opts.secrets),
    saveSettings(patch) {
      const { cursorApiKey, marketDataKey, ...configPatch } = patch
      saveAppSettingsPatch(opts.store, configPatch)
      if (cursorApiKey !== undefined && cursorApiKey.length > 0) {
        opts.secrets.set('cursorApiKey', cursorApiKey)
      }
      if (marketDataKey !== undefined && marketDataKey.length > 0) {
        opts.secrets.set('marketDataKey', marketDataKey)
      }
      return readSettings(opts.store, opts.secrets)
    },
    addFactory: (name) => addFactory(opts.store, now, name),
    renameFactory: (id, name) => renameFactory(opts.store, id, name),
    openStageModal: (factoryId, stage) =>
      openStageModalForFactory(opts.store, now, factoryId, stage),
    confirmPromoteAction: (factoryId, action) =>
      runPromoteAction({ store: opts.store, secrets: opts.secrets, now, factoryId, action })
  }
}
