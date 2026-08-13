import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROMOTE_THRESHOLDS,
  loadAppSettings,
  saveAppSettingsPatch,
  type SettingsStore
} from './appSettings'
import {
  CONFIG_KEYS,
  DEFAULT_DAILY_LIMIT_USD,
  DEFAULT_FRICTION,
  DEFAULT_RISK_LIMITS
} from './types'

function memoryStore(seed: Record<string, unknown> = {}): SettingsStore & {
  data: Record<string, unknown>
} {
  const data = { ...seed }
  return {
    data,
    getConfig<T>(key: string): T | undefined {
      return data[key] as T | undefined
    },
    setConfig(key: string, value: unknown) {
      data[key] = value
      return { id: key, key, valueJson: JSON.stringify(value) }
    }
  }
}

describe('appSettings config layer', () => {
  it('loads defaults when config empty', () => {
    const settings = loadAppSettings(memoryStore(), {
      hasCursorApiKey: false,
      hasMarketDataKey: false
    })
    expect(settings.dailyLimitUsd).toBe(DEFAULT_DAILY_LIMIT_USD)
    expect(settings.friction).toEqual(DEFAULT_FRICTION)
    expect(settings.risk).toEqual(DEFAULT_RISK_LIMITS)
    expect(settings.promoteThresholds).toEqual(DEFAULT_PROMOTE_THRESHOLDS)
    expect(settings.hasCursorApiKey).toBe(false)
  })

  it('persists friction/risk so subsequent sessions read new values', () => {
    const store = memoryStore()
    saveAppSettingsPatch(store, {
      friction: { ...DEFAULT_FRICTION, spreadBps: 12 },
      risk: { ...DEFAULT_RISK_LIMITS, dailyLossHaltPercent: 5 }
    })
    expect(store.getConfig(CONFIG_KEYS.friction)).toEqual({
      ...DEFAULT_FRICTION,
      spreadBps: 12
    })
    expect(store.getConfig(CONFIG_KEYS.risk)).toEqual({
      ...DEFAULT_RISK_LIMITS,
      dailyLossHaltPercent: 5
    })
    const loaded = loadAppSettings(store, {
      hasCursorApiKey: true,
      hasMarketDataKey: false
    })
    expect(loaded.friction.spreadBps).toBe(12)
    expect(loaded.risk.dailyLossHaltPercent).toBe(5)
    expect(loaded.hasCursorApiKey).toBe(true)
  })

  it('persists daily limit for next allocation cycle', () => {
    const store = memoryStore()
    saveAppSettingsPatch(store, { dailyLimitUsd: 25_000 })
    expect(loadAppSettings(store, { hasCursorApiKey: false, hasMarketDataKey: false }).dailyLimitUsd).toBe(
      25_000
    )
  })

  it('persists every remaining setting including numeric zero', () => {
    const store = memoryStore()
    const promoteThresholds = {
      minSessionsExInfra: 8,
      minNetExcessVsSpy: 0.03,
      minNetExcessVsControl: 0.02,
      maxDrawdown: 0.12
    }

    saveAppSettingsPatch(store, {
      promoteThresholds,
      controlFloorWeight: 0,
      explorationAllotmentUsd: 0
    })

    expect(store.data).toMatchObject({
      [CONFIG_KEYS.promoteThresholds]: promoteThresholds,
      [CONFIG_KEYS.controlFloorWeight]: 0,
      [CONFIG_KEYS.explorationAllotmentUsd]: 0
    })
    const loaded = loadAppSettings(store, {
      hasCursorApiKey: false,
      hasMarketDataKey: true
    })
    expect(loaded.promoteThresholds).toEqual(promoteThresholds)
    expect(loaded.controlFloorWeight).toBe(0)
    expect(loaded.explorationAllotmentUsd).toBe(0)
    expect(loaded.hasMarketDataKey).toBe(true)
  })
})
