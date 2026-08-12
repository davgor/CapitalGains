import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openEngineStore, type EngineStore } from '../db/store'
import { createMockMarketData } from '../marketData/mockMarketData'
import { createPaperBroker } from '../broker/paperBroker'
import { executePurchases } from '../stage/purchases'
import {
  createSessionForFactory,
  markInfraSkip,
  resumeSession,
  runHardcodedSession,
  continueFromPurchases
} from './sessionRunner'
import type { FeatureRow, ResearchPlan } from '../../../shared/engine/types'
import { dailyProfitFromOutcomes } from '../monitor/outcome'

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-orch-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

const TAPE: FeatureRow[] = [
  {
    symbol: 'NVDA',
    sector: 'Tech',
    price: 100,
    premarketGapPct: 1,
    rvol: 1.2,
    adv: 5e6,
    marketCap: 1e12,
    spreadBps: 4,
    isLeveragedEtf: false
  },
  {
    symbol: 'GOOGL',
    sector: 'Tech',
    price: 200,
    premarketGapPct: 0.5,
    rvol: 1.1,
    adv: 4e6,
    marketCap: 1e12,
    spreadBps: 4,
    isLeveragedEtf: false
  }
]

const PLAN: ResearchPlan = {
  sitOut: false,
  allocations: [
    { symbol: 'NVDA', weight: 0.3, sector: 'Tech' },
    { symbol: 'GOOGL', weight: 0.25, sector: 'Tech' }
  ]
}

describe('idempotent basket replay', () => {
  it('replaying place basket after committed fill is a no-op', () => {
    const session = createSessionForFactory(store, {
      factoryName: 'R',
      sessionDate: '2024-06-03',
      dailyLimitUsd: 10_000
    })
    store.updateSession(session.id, { stage: 'purchases' })
    const clock = { now: () => new Date('2024-06-03T13:40:00.000Z') }
    const marketData = createMockMarketData([
      { symbol: 'NVDA', last: 100, bid: 99.95, ask: 100.05 },
      { symbol: 'GOOGL', last: 200, bid: 199.9, ask: 200.1 }
    ])
    const broker = createPaperBroker({ marketData, clock, startingCash: 10_000 })
    const args = {
      store,
      session: store.getSession(session.id)!,
      plan: PLAN,
      tape: TAPE,
      broker,
      marketData,
      clock
    }
    executePurchases(args)
    executePurchases(args)
    expect(store.listFills(session.id)).toHaveLength(2)
  })
})

describe('crash resume', () => {
  it('continues after crash between fill persist and stage advance', () => {
    const session = seedPurchasesSession()
    const clock = { now: () => new Date('2024-06-03T14:00:00.000Z') }
    const marketData = createMockMarketData([
      { symbol: 'NVDA', last: 101, bid: 100.95, ask: 101.05 },
      { symbol: 'GOOGL', last: 201, bid: 200.9, ask: 201.1 },
      { symbol: 'SPY', last: 501 }
    ])
    const broker = createPaperBroker({ marketData, clock, startingCash: 10_000 })
    executePurchases({
      store,
      session: store.getSession(session.id)!,
      plan: PLAN,
      tape: TAPE,
      broker,
      marketData,
      clock
    })
    expect(store.getSession(session.id)?.stage).toBe('purchases')
    expect(store.listFills(session.id)).toHaveLength(2)
    const done = continueFromPurchases(
      { store, clock, marketData, tape: TAPE, plan: PLAN, spyOpen: 500, spyClose: 502 },
      resumeSession(store, session.id),
      broker
    )
    expect(store.listFills(session.id).filter((f) => f.side === 'buy')).toHaveLength(2)
    expect(done.stage).toBe('done')
    const outcome = store.getOutcome(session.id)!
    expect(dailyProfitFromOutcomes([outcome])).toBe(outcome.netPnl)
  })
})

describe('infra_skip + happy path', () => {
  it('infra_skip is settable and queryable', () => {
    const session = createSessionForFactory(store, {
      factoryName: 'Skip',
      sessionDate: '2024-06-03',
      dailyLimitUsd: 10_000
    })
    markInfraSkip(store, session.id)
    expect(store.getSession(session.id)?.infraSkip).toBe(true)
  })

  it('runs open→close multi-name without SDK', () => {
    const clock = { now: () => new Date('2024-06-03T13:40:00.000Z') }
    const marketData = createMockMarketData([
      { symbol: 'NVDA', last: 100, bid: 99.95, ask: 100.05 },
      { symbol: 'GOOGL', last: 200, bid: 199.9, ask: 200.1 }
    ])
    const session = createSessionForFactory(store, {
      factoryName: 'Day',
      sessionDate: '2024-06-03',
      dailyLimitUsd: 10_000
    })
    const done = runHardcodedSession(
      { store, clock, marketData, tape: TAPE, plan: PLAN, spyOpen: 500, spyClose: 502 },
      session
    )
    expect(done.stage).toBe('done')
    expect(
      store.listFills(session.id).filter((f) => f.side === 'buy').map((f) => f.symbol).sort()
    ).toEqual(['GOOGL', 'NVDA'])
    const outcome = store.getOutcome(session.id)!
    expect(outcome.cashResidual).toBeGreaterThan(0)
    expect(outcome.fullLimitReturn).not.toBe(outcome.deployedReturn)
  })
})

function seedPurchasesSession() {
  const session = createSessionForFactory(store, {
    factoryName: 'Crash',
    sessionDate: '2024-06-03',
    dailyLimitUsd: 10_000
  })
  store.commitStage({ sessionId: session.id, stage: 'regime', artifactJson: '{}' })
  store.commitStage({ sessionId: session.id, stage: 'research', artifactJson: '{}' })
  store.commitStage({ sessionId: session.id, stage: 'purchases', artifactJson: '{}' })
  return session
}
