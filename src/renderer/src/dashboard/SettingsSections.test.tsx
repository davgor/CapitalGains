import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONTROL_FLOOR_WEIGHT,
  DEFAULT_EXPLORATION_ALLOTMENT_USD,
  DEFAULT_FRICTION,
  DEFAULT_RISK_LIMITS
} from '../../../shared/engine/types'
import { DEFAULT_PROMOTE_THRESHOLDS } from '../../../shared/engine/promote'
import { SettingsFormFields } from './SettingsFormFields'
import {
  SettingsAllocationWeights,
  SettingsPromote,
  SettingsPromoteThresholds
} from './SettingsPromoteSection'
import { SettingsFriction, SettingsRisk, SettingsSecrets } from './SettingsSections'

describe('SettingsSecrets', () => {
  it('renders independent set and missing statuses', () => {
    const node = SettingsSecrets({
      hasCursorApiKey: true,
      hasMarketDataKey: false,
      cursorApiKey: '',
      marketDataKey: '',
      onCursorApiKeyChange: () => undefined,
      onMarketDataKeyChange: () => undefined
    })
    const status = node.props.children[1].props.children

    expect(status).toContain('set')
    expect(status).toContain('missing')
  })

  it('forwards both secret input values', () => {
    const changed: string[] = []
    const node = SettingsSecrets({
      hasCursorApiKey: false,
      hasMarketDataKey: true,
      cursorApiKey: 'cursor',
      marketDataKey: 'market',
      onCursorApiKeyChange: (value) => changed.push(`cursor:${value}`),
      onMarketDataKeyChange: (value) => changed.push(`market:${value}`)
    })

    node.props.children[2].props.children[1].props.onChange({ target: { value: 'new-cursor' } })
    node.props.children[3].props.children[1].props.onChange({ target: { value: 'new-market' } })

    expect(changed).toEqual(['cursor:new-cursor', 'market:new-market'])
  })
})

describe('SettingsFriction and SettingsRisk', () => {
  it('updates each friction field without changing the others', () => {
    const changed: Array<typeof DEFAULT_FRICTION> = []
    const node = SettingsFriction({
      friction: DEFAULT_FRICTION,
      onChange: (value) => changed.push(value)
    })
    const labels = node.props.children.slice(1)

    labels[0].props.children[1].props.onChange({ target: { value: '12' } })
    labels[1].props.children[1].props.onChange({ target: { value: '9' } })
    labels[2].props.children[1].props.onChange({ target: { value: '0.02' } })

    expect(changed).toEqual([
      { ...DEFAULT_FRICTION, spreadBps: 12 },
      { ...DEFAULT_FRICTION, slippageBps: 9 },
      { ...DEFAULT_FRICTION, commissionPerShare: 0.02 }
    ])
  })

  it('updates each risk field without changing the others', () => {
    const changed: Array<typeof DEFAULT_RISK_LIMITS> = []
    const node = SettingsRisk({
      risk: DEFAULT_RISK_LIMITS,
      onChange: (value) => changed.push(value)
    })
    const labels = node.props.children.slice(1)

    labels[0].props.children[1].props.onChange({ target: { value: '0.25' } })
    labels[1].props.children[1].props.onChange({ target: { value: '4.5' } })

    expect(changed).toEqual([
      { ...DEFAULT_RISK_LIMITS, maxSingleNameWeight: 0.25 },
      { ...DEFAULT_RISK_LIMITS, dailyLossHaltPercent: 4.5 }
    ])
  })
})

describe('SettingsPromote controls', () => {
  it('updates each threshold independently', () => {
    const changed: Array<typeof DEFAULT_PROMOTE_THRESHOLDS> = []
    const node = SettingsPromoteThresholds({
      promote: DEFAULT_PROMOTE_THRESHOLDS,
      onChange: (value) => changed.push(value)
    })
    const labels = node.props.children

    labels[0].props.children[1].props.onChange({ target: { value: '7' } })
    labels[1].props.children[1].props.onChange({ target: { value: '0.03' } })
    labels[2].props.children[1].props.onChange({ target: { value: '0.02' } })
    labels[3].props.children[1].props.onChange({ target: { value: '0.15' } })

    expect(changed).toEqual([
      { ...DEFAULT_PROMOTE_THRESHOLDS, minSessionsExInfra: 7 },
      { ...DEFAULT_PROMOTE_THRESHOLDS, minNetExcessVsSpy: 0.03 },
      { ...DEFAULT_PROMOTE_THRESHOLDS, minNetExcessVsControl: 0.02 },
      { ...DEFAULT_PROMOTE_THRESHOLDS, maxDrawdown: 0.15 }
    ])
  })

  it('forwards allocation weights and composes the settings block', () => {
    const changed: number[] = []
    const weights = SettingsAllocationWeights({
      controlFloor: 1.5,
      explore: 750,
      onControlFloorChange: (value) => changed.push(value),
      onExploreChange: (value) => changed.push(value)
    })
    weights.props.children[0].props.children[1].props.onChange({ target: { value: '2.5' } })
    weights.props.children[1].props.children[1].props.onChange({ target: { value: '900' } })
    const section = SettingsPromote({
      promote: DEFAULT_PROMOTE_THRESHOLDS,
      controlFloor: 1.5,
      explore: 750,
      onPromoteChange: () => undefined,
      onControlFloorChange: () => undefined,
      onExploreChange: () => undefined
    })

    expect(changed).toEqual([2.5, 900])
    expect(section.props.children[1].props.promote).toBe(DEFAULT_PROMOTE_THRESHOLDS)
    expect(section.props.children[2].props).toMatchObject({ controlFloor: 1.5, explore: 750 })
  })
})

describe('SettingsFormFields', () => {
  it('forwards public settings and current form state to all sections', () => {
    const settings = {
      friction: DEFAULT_FRICTION,
      risk: DEFAULT_RISK_LIMITS,
      promoteThresholds: DEFAULT_PROMOTE_THRESHOLDS,
      controlFloorWeight: DEFAULT_CONTROL_FLOOR_WEIGHT,
      explorationAllotmentUsd: DEFAULT_EXPLORATION_ALLOTMENT_USD,
      dailyLimitUsd: 10_000,
      hasCursorApiKey: true,
      hasMarketDataKey: false
    }
    const node = SettingsFormFields({
      settings,
      friction: DEFAULT_FRICTION,
      risk: DEFAULT_RISK_LIMITS,
      promote: DEFAULT_PROMOTE_THRESHOLDS,
      controlFloor: 2,
      explore: 800,
      cursorApiKey: 'cursor',
      marketDataKey: 'market',
      onFrictionChange: () => undefined,
      onRiskChange: () => undefined,
      onPromoteChange: () => undefined,
      onControlFloorChange: () => undefined,
      onExploreChange: () => undefined,
      onCursorApiKeyChange: () => undefined,
      onMarketDataKeyChange: () => undefined
    })

    expect(node.props.children[0].props).toMatchObject({
      hasCursorApiKey: true,
      hasMarketDataKey: false,
      cursorApiKey: 'cursor',
      marketDataKey: 'market'
    })
    expect(node.props.children[3].props).toMatchObject({ controlFloor: 2, explore: 800 })
  })
})
