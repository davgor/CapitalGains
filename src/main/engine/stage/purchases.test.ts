import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'vitest'
import { openEngineStore, type EngineStore } from '../db/store'
import { createMockMarketData } from '../marketData/mockMarketData'
import { createPaperBroker } from '../broker/paperBroker'
import { commitStageAdvance, executePurchases } from './purchases'
import { assertLegalTransition, nextStage } from './stageGraph'
import type { FeatureRow, ResearchPlan } from '../../../shared/engine/types'

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-stage-'))
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

function setupSession(): ReturnType<EngineStore['createSession']> {
  const factory = store.createFactory({ name: 'F', role: 'Explorer', evidenceWeight: 1 })
  return store.createSession({
    factoryId: factory.id,
    sessionDate: '2024-06-03',
    dailyLimitUsd: 10_000
  })
}

const clock = { now: () => new Date('2024-06-03T13:40:00.000Z') }
const marketData = createMockMarketData([
  { symbol: 'NVDA', last: 100, bid: 99.95, ask: 100.05 },
  { symbol: 'GOOGL', last: 200, bid: 199.9, ask: 200.1 }
])

describe('stage graph', () => {
  it('rejects illegal jumps and advances durably', () => {
    expect(() => assertLegalTransition('kickoff', 'purchases')).toThrow(/illegal/)
    expect(nextStage('research')).toBe('purchases')
    let session = setupSession()
    session = commitStageAdvance({
      store,
      session,
      to: 'regime',
      artifact: { skipped: true }
    })
    expect(session.stage).toBe('regime')
    expect(store.listStageRecords(session.id)).toHaveLength(1)
  })
})

describe('executePurchases happy path', () => {
  it('fills one row per symbol', () => {
    const session = setupSession()
    const broker = createPaperBroker({ marketData, clock, startingCash: 10_000 })
    const plan: ResearchPlan = {
      sitOut: false,
      allocations: [
        { symbol: 'NVDA', weight: 0.3, sector: 'Tech' },
        { symbol: 'GOOGL', weight: 0.25, sector: 'Tech' }
      ]
    }
    const result = executePurchases({
      store,
      session,
      plan,
      tape: TAPE,
      broker,
      marketData,
      clock
    })
    expect(result.status).toBe('filled')
    expect(result.symbols.sort()).toEqual(['GOOGL', 'NVDA'])
    expect(store.listFills(session.id).map((f) => f.symbol).sort()).toEqual(['GOOGL', 'NVDA'])
  })
})

describe('executePurchases rejection paths', () => {
  it('SitOut yields no fills', () => {
    const session = setupSession()
    const broker = createPaperBroker({ marketData, clock, startingCash: 10_000 })
    const result = executePurchases({
      store,
      session,
      plan: { sitOut: true, allocations: [] },
      tape: TAPE,
      broker,
      marketData,
      clock
    })
    expect(result.status).toBe('sitOut')
    expect(store.listFills(session.id)).toHaveLength(0)
  })

  it('risk rejection and off-tape symbols', () => {
    const session = setupSession()
    const broker = createPaperBroker({ marketData, clock, startingCash: 10_000 })
    const risk = executePurchases({
      store,
      session,
      plan: {
        sitOut: false,
        allocations: [{ symbol: 'NVDA', weight: 0.9, sector: 'Tech' }]
      },
      tape: TAPE,
      broker,
      marketData,
      clock
    })
    expect(risk.status).toBe('riskRejected')
    expect(() =>
      executePurchases({
        store,
        session,
        plan: {
          sitOut: false,
          allocations: [{ symbol: 'TSLA', weight: 0.2, sector: 'Auto' }]
        },
        tape: TAPE,
        broker,
        marketData,
        clock
      })
    ).toThrow(/off-tape/)
  })
})
