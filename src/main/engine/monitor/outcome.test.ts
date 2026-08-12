import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openEngineStore, type EngineStore } from '../db/store'
import { createMockMarketData } from '../marketData/mockMarketData'
import { createPaperBroker } from '../broker/paperBroker'
import { computeOutcome, dailyProfitFromOutcomes, runMonitorTick } from './outcome'

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-mon-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('monitor ticks', () => {
  it('updates snapshots idempotently for frozen clock sequence', () => {
    const factory = store.createFactory({ name: 'M', role: 'Control', evidenceWeight: 1 })
    const session = store.createSession({
      factoryId: factory.id,
      sessionDate: '2024-06-03',
      dailyLimitUsd: 10_000
    })
    const marketData = createMockMarketData([
      { symbol: 'NVDA', last: 100, bid: 99.95, ask: 100.05 }
    ])
    const clock = { now: () => new Date('2024-06-03T14:00:00.000Z') }
    const broker = createPaperBroker({ marketData, clock, startingCash: 10_000 })
    broker.placeOrder({
      symbol: 'NVDA',
      side: 'buy',
      shares: 40,
      idempotencyKey: 'buy:NVDA'
    })
    const asOf = new Date('2024-06-03T14:02:00.000Z')
    const stops = new Map([['NVDA', { fillPrice: 100.1, stopLossPercent: 2 }]])
    const tickArgs = {
      store,
      sessionId: session.id,
      asOf,
      marketData,
      broker,
      startingEquity: 10_000,
      stops
    }
    runMonitorTick(tickArgs)
    runMonitorTick(tickArgs)
    expect(store.listSnapshots(session.id)).toHaveLength(1)
  })
})

describe('outcome dual benchmarks', () => {
  it('dual returns differ with cash residual; Daily Profit uses net', () => {
    const session = store.createSession({
      factoryId: store.createFactory({ name: 'O', role: 'Explorer', evidenceWeight: 1 }).id,
      sessionDate: '2024-06-03',
      dailyLimitUsd: 10_000
    })
    const buys = [fill(session.id, 'buy', 100.4, 100)]
    const sells = [fill(session.id, 'sell', 101.5, 102)]
    const outcome = computeOutcome({
      store,
      sessionId: session.id,
      dailyLimitUsd: 10_000,
      buys,
      sells,
      spyOpen: 500,
      spyClose: 502,
      cashResidual: 5_984
    })
    expect(outcome.grossPnl).toBeGreaterThan(outcome.netPnl)
    expect(outcome.fullLimitReturn).not.toBe(outcome.deployedReturn)
    expect(outcome.deployedReturn).toBeGreaterThan(outcome.fullLimitReturn)
    expect(outcome.spyReturn).toBeCloseTo(0.004)
    expect(dailyProfitFromOutcomes([outcome, { netPnl: 10 }])).toBe(outcome.netPnl + 10)
    expect(dailyProfitFromOutcomes([{ netPnl: outcome.netPnl }])).not.toBe(outcome.grossPnl)
  })
})

function fill(
  sessionId: string,
  side: 'buy' | 'sell',
  fillPrice: number,
  midPrice: number
) {
  return store.insertFill({
    sessionId,
    symbol: 'NVDA',
    side,
    shares: 40,
    fillPrice,
    midPrice,
    commission: 0.2,
    idempotencyKey: `${side}:NVDA`,
    filledAt:
      side === 'buy' ? '2024-06-03T13:40:00.000Z' : '2024-06-03T20:00:00.000Z'
  })
}
