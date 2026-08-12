import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openEngineStore, type EngineStore } from './db/store'
import { createMockMarketData } from './marketData/mockMarketData'
import { buildFeatureTape } from './tape/featureTape'
import { createPaperBroker } from './broker/paperBroker'
import { executePurchases } from './stage/purchases'
import {
  continueFromPurchases,
  createSessionForFactory,
  resumeSession,
  runHardcodedSession
} from './orchestrator/sessionRunner'
import { dailyProfitFromOutcomes } from './monitor/outcome'
import type { FeatureRow, ResearchPlan } from '../../shared/engine/types'
import type { MarketDataPort } from '../../shared/engine/ports'

/**
 * Phase 1 proof: inject clock + mock market data, drive one factory through a
 * full paper session with a hardcoded multi-name basket — no Cursor SDK.
 * See docs/runbooks/phase1-hardcoded-session.md.
 */

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-fullday-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

const PLAN: ResearchPlan = {
  sitOut: false,
  allocations: [
    { symbol: 'NVDA', weight: 0.3, sector: 'Tech' },
    { symbol: 'GOOGL', weight: 0.25, sector: 'Tech' }
  ]
}

describe('007.10 hardcoded full-day integration', () => {
  it('asserts multi-name fills, residual cash, dual benchmarks, resume', () => {
    const purchaseClock = { now: () => new Date('2024-06-03T13:40:00.000Z') }
    const marketData = baseMarketData()
    const tape = buildTape(marketData, purchaseClock.now())
    expect(tape.map((t) => t.symbol).sort()).toEqual(['GOOGL', 'NVDA'])
    const sessionId = runCrashResumePath(purchaseClock, marketData, tape)
    assertOutcome(sessionId)
    runCleanFullDay(purchaseClock, marketData, tape)
  })
})

function baseMarketData(): MarketDataPort {
  return createMockMarketData([
    { symbol: 'NVDA', last: 100, bid: 99.95, ask: 100.05 },
    { symbol: 'GOOGL', last: 200, bid: 199.9, ask: 200.1 },
    { symbol: 'SPY', last: 500 },
    { symbol: 'PENNY', last: 3 }
  ])
}

function buildTape(marketData: MarketDataPort, asOf: Date): FeatureRow[] {
  return buildFeatureTape({
    asOf,
    marketData,
    fundamentals: [
      fund('NVDA', 8e6),
      fund('GOOGL', 6e6),
      {
        symbol: 'PENNY',
        sector: 'Spec',
        adv: 2e6,
        marketCap: 5e9,
        premarketGapPct: 8,
        rvol: 3,
        spreadBps: 40,
        isLeveragedEtf: false
      }
    ]
  })
}

function fund(symbol: string, adv: number) {
  return {
    symbol,
    sector: 'Tech',
    adv,
    marketCap: 1e12,
    premarketGapPct: 1,
    rvol: 1.2,
    spreadBps: 4,
    isLeveragedEtf: false
  }
}

function seedToPurchases(sessionId: string): void {
  store.commitStage({ sessionId, stage: 'regime', artifactJson: '{}' })
  store.commitStage({ sessionId, stage: 'research', artifactJson: '{}' })
  store.commitStage({ sessionId, stage: 'purchases', artifactJson: '{}' })
}

function runCrashResumePath(
  purchaseClock: { now: () => Date },
  marketData: MarketDataPort,
  tape: FeatureRow[]
): string {
  const session = createSessionForFactory(store, {
    factoryName: 'Phase1Proof',
    sessionDate: '2024-06-03',
    dailyLimitUsd: 10_000
  })
  seedToPurchases(session.id)
  const broker = createPaperBroker({
    marketData,
    clock: purchaseClock,
    startingCash: 10_000
  })
  executePurchases({
    store,
    session: store.getSession(session.id)!,
    plan: PLAN,
    tape,
    broker,
    marketData,
    clock: purchaseClock
  })
  expect(store.listFills(session.id)).toHaveLength(2)
  expect(resumeMidMonitor(session.id, tape).stage).toBe('done')
  return session.id
}

function runCleanFullDay(
  purchaseClock: { now: () => Date },
  marketData: MarketDataPort,
  tape: FeatureRow[]
): void {
  const store2 = openEngineStore(join(dir, 'engine2.sqlite'))
  const session2 = createSessionForFactory(store2, {
    factoryName: 'Full',
    sessionDate: '2024-06-03',
    dailyLimitUsd: 10_000
  })
  const done2 = runHardcodedSession(
    {
      store: store2,
      clock: purchaseClock,
      marketData,
      tape,
      plan: PLAN,
      spyOpen: 500,
      spyClose: 502
    },
    session2
  )
  expect(done2.stage).toBe('done')
  store2.close()
}

function resumeMidMonitor(sessionId: string, tape: FeatureRow[]) {
  const monitorClock = { now: () => new Date('2024-06-03T15:00:00.000Z') }
  const monitorMd = createMockMarketData([
    { symbol: 'NVDA', last: 101, bid: 100.95, ask: 101.05 },
    { symbol: 'GOOGL', last: 202, bid: 201.9, ask: 202.1 },
    { symbol: 'SPY', last: 502 }
  ])
  const freshBroker = createPaperBroker({
    marketData: monitorMd,
    clock: monitorClock,
    startingCash: 10_000
  })
  return continueFromPurchases(
    {
      store,
      clock: monitorClock,
      marketData: monitorMd,
      tape,
      plan: PLAN,
      spyOpen: 500,
      spyClose: 502
    },
    resumeSession(store, sessionId),
    freshBroker
  )
}

function assertOutcome(sessionId: string): void {
  const buys = store.listFills(sessionId).filter((f) => f.side === 'buy')
  expect(buys.map((f) => f.symbol).sort()).toEqual(['GOOGL', 'NVDA'])
  expect(store.listSnapshots(sessionId).length).toBeGreaterThanOrEqual(1)
  const outcome = store.getOutcome(sessionId)!
  expect(outcome.cashResidual).toBeGreaterThan(0)
  expect(outcome.netPnl).not.toBe(outcome.grossPnl)
  expect(outcome.fullLimitReturn).not.toBe(outcome.deployedReturn)
  expect(outcome.spyReturn).toBeCloseTo(0.004)
  expect(dailyProfitFromOutcomes([outcome])).toBe(outcome.netPnl)
}
