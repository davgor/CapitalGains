import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SecureSecretsStore } from '../secrets/secureStore'
import { openEngineStore, type EngineStore } from '../engine/db/store'
import type { Session } from '../../shared/engine/types'
import { buildDashboardSnapshot, ensureControlFactory, readSettings } from './serviceSnapshot'

let dir: string
let store: EngineStore

const noSecrets: SecureSecretsStore = {
  has: () => false,
  get: () => undefined,
  set: () => undefined,
  clear: () => undefined
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-snapshot-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

function sessionWithOutcome(input: {
  factoryId: string
  date: string
  limit: number
  net: number
  spy: number
  infraSkip?: boolean
}): Session {
  const session = store.createSession({
    factoryId: input.factoryId,
    sessionDate: input.date,
    dailyLimitUsd: input.limit
  })
  if (input.infraSkip) {
    store.updateSession(session.id, { infraSkip: true })
  }
  store.insertOutcome({
    sessionId: session.id,
    grossPnl: input.net + 7,
    netPnl: input.net,
    fullLimitReturn: input.net / input.limit,
    deployedReturn: input.net / input.limit,
    spyReturn: input.spy,
    cashResidual: 11
  })
  return store.getSession(session.id)!
}

function seedAggregateScenario() {
  const control = store.createFactory({ name: 'Control', role: 'Control', evidenceWeight: 1 })
  const explorer = store.createFactory({ name: 'Alpha', role: 'Explorer', evidenceWeight: 1 })
  sessionWithOutcome({ factoryId: control.id, date: '2024-06-03', limit: 1_000, net: 20, spy: 0.01 })
  sessionWithOutcome({ factoryId: control.id, date: '2024-06-04', limit: 2_000, net: -10, spy: 0.02 })
  sessionWithOutcome({ factoryId: explorer.id, date: '2024-06-03', limit: 1_000, net: 100, spy: 0.01 })
  const current = sessionWithOutcome({
    factoryId: explorer.id,
    date: '2024-06-04',
    limit: 2_000,
    net: -40,
    spy: 0.02
  })
  sessionWithOutcome({ factoryId: explorer.id, date: '2024-06-05', limit: 5_000, net: 999, spy: 0, infraSkip: true })
  store.commitStage({
    sessionId: current.id,
    stage: 'research',
    artifactJson: JSON.stringify({ label: 'Failed quota' })
  })
  store.setConfig('ui.promoteThresholds', {
    minSessionsExInfra: 2,
    minNetExcessVsSpy: 5,
    minNetExcessVsControl: 25,
    maxDrawdown: 0.5
  })
  return explorer
}

describe('ensureControlFactory', () => {
  it('creates exact Control defaults once', () => {
    ensureControlFactory(store)
    ensureControlFactory(store)

    expect(store.listFactories()).toHaveLength(1)
    expect(store.listFactories()[0]).toMatchObject({
      name: 'Control',
      role: 'Control',
      evidenceWeight: 1,
      queuedNextOpen: false
    })
  })

  it('does not mistake a Control-named Explorer for the Control role', () => {
    store.createFactory({ name: 'Control', role: 'Explorer', evidenceWeight: 0 })
    ensureControlFactory(store)

    expect(store.listFactories().map((factory) => factory.role)).toEqual([
      'Explorer',
      'Control'
    ])
  })
})

describe('readSettings', () => {
  it('returns persisted values and separate secret-presence flags', () => {
    store.setConfig('ui.dailyLimitUsd', 12_345)
    store.setConfig('ui.controlFloorWeight', 2.5)
    const secrets: SecureSecretsStore = {
      ...noSecrets,
      has: (key) => key === 'cursorApiKey'
    }

    const settings = readSettings(store, secrets)

    expect(settings.dailyLimitUsd).toBe(12_345)
    expect(settings.controlFloorWeight).toBe(2.5)
    expect(settings.hasCursorApiKey).toBe(true)
    expect(settings.hasMarketDataKey).toBe(false)
  })
})

describe('buildDashboardSnapshot empty state', () => {
  it('creates Control and returns exact zero-session row values', () => {
    const snapshot = buildDashboardSnapshot(
      store,
      noSecrets,
      () => new Date('2024-06-03T14:00:00.000Z')
    )
    const control = snapshot.factories[0]!

    expect(snapshot.sessionDate).toBe('2024-06-03')
    expect(snapshot.dailyProfitNet).toBe(0)
    expect(control.netDailyProfit).toBe(0)
    expect(control.sessionId).toBeNull()
    expect(control.sessionStage).toBeNull()
    expect(control.failureLabel).toBeNull()
    expect(control.protectedControl).toBe(true)
    expect(control.stageNodes.map((node) => node.visual)).toEqual([
      'active',
      'grey',
      'grey',
      'grey',
      'grey',
      'grey'
    ])
  })
})

describe('buildDashboardSnapshot aggregates', () => {
  it('computes exact SPY, Control, drawdown, and leaderboard aggregates', () => {
    const explorer = seedAggregateScenario()

    const snapshot = buildDashboardSnapshot(
      store,
      noSecrets,
      () => new Date('2024-06-04T14:00:00.000Z')
    )
    const row = snapshot.factories.find((factory) => factory.id === explorer.id)!
    const leader = snapshot.leaderboard.find((entry) => entry.factoryId === explorer.id)!
    const recommendation = snapshot.promoteRecommendations.find((entry) => entry.factoryId === explorer.id)!

    expect(snapshot.dailyProfitNet).toBe(-50)
    expect(row).toMatchObject({ netDailyProfit: -40, failureLabel: 'Failed quota', allocatedCash: 5_000 })
    expect(row.stageNodes.find((node) => node.stage === 'research')).toMatchObject({
      visual: 'failed',
      opensModal: true,
      errorAffordance: true
    })
    expect(recommendation).toEqual({
      factoryId: explorer.id,
      action: 'promote',
      reason: 'thresholds met'
    })
    expect(leader).toMatchObject({
      cumulativeNetPnl: 60,
      netExcessVsSpy: 10,
      netExcessVsControl: 50,
      winRateExInfra: 0.5
    })
    expect(snapshot.leaderboard[0]?.factoryId).toBe(explorer.id)
  })
})
