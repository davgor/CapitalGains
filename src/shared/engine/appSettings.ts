import { DEFAULT_PROMOTE_THRESHOLDS, type PromoteThresholds } from './promote'
import {
  CONFIG_KEYS,
  DEFAULT_CONTROL_FLOOR_WEIGHT,
  DEFAULT_DAILY_LIMIT_USD,
  DEFAULT_EXPLORATION_ALLOTMENT_USD,
  DEFAULT_FRICTION,
  DEFAULT_RISK_LIMITS,
  type AppSettingsPublic,
  type FrictionConfig,
  type RiskLimits
} from './types'

export { DEFAULT_PROMOTE_THRESHOLDS }

export interface SettingsStore {
  getConfig<T>(key: string): T | undefined
  setConfig(key: string, value: unknown): unknown
}

export function loadAppSettings(
  store: SettingsStore,
  secrets: { hasCursorApiKey: boolean; hasMarketDataKey: boolean }
): AppSettingsPublic {
  return {
    friction: store.getConfig<FrictionConfig>(CONFIG_KEYS.friction) ?? DEFAULT_FRICTION,
    risk: store.getConfig<RiskLimits>(CONFIG_KEYS.risk) ?? DEFAULT_RISK_LIMITS,
    promoteThresholds:
      store.getConfig<PromoteThresholds>(CONFIG_KEYS.promoteThresholds) ??
      DEFAULT_PROMOTE_THRESHOLDS,
    controlFloorWeight:
      store.getConfig<number>(CONFIG_KEYS.controlFloorWeight) ?? DEFAULT_CONTROL_FLOOR_WEIGHT,
    explorationAllotmentUsd:
      store.getConfig<number>(CONFIG_KEYS.explorationAllotmentUsd) ??
      DEFAULT_EXPLORATION_ALLOTMENT_USD,
    dailyLimitUsd:
      store.getConfig<number>(CONFIG_KEYS.dailyLimitUsd) ?? DEFAULT_DAILY_LIMIT_USD,
    hasCursorApiKey: secrets.hasCursorApiKey,
    hasMarketDataKey: secrets.hasMarketDataKey
  }
}

export function saveAppSettingsPatch(
  store: SettingsStore,
  patch: Partial<{
    friction: FrictionConfig
    risk: RiskLimits
    promoteThresholds: PromoteThresholds
    controlFloorWeight: number
    explorationAllotmentUsd: number
    dailyLimitUsd: number
  }>
): void {
  if (patch.friction !== undefined) {
    store.setConfig(CONFIG_KEYS.friction, patch.friction)
  }
  if (patch.risk !== undefined) {
    store.setConfig(CONFIG_KEYS.risk, patch.risk)
  }
  if (patch.promoteThresholds !== undefined) {
    store.setConfig(CONFIG_KEYS.promoteThresholds, patch.promoteThresholds)
  }
  if (patch.controlFloorWeight !== undefined) {
    store.setConfig(CONFIG_KEYS.controlFloorWeight, patch.controlFloorWeight)
  }
  if (patch.explorationAllotmentUsd !== undefined) {
    store.setConfig(CONFIG_KEYS.explorationAllotmentUsd, patch.explorationAllotmentUsd)
  }
  if (patch.dailyLimitUsd !== undefined) {
    store.setConfig(CONFIG_KEYS.dailyLimitUsd, patch.dailyLimitUsd)
  }
}
