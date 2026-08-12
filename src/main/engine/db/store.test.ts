import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openEngineStore } from './store'
import type { EngineStore } from './store'

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-engine-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('engine store multi-name fills', () => {
  it('persists a multi-name fill basket and reads it back', () => {
    const session = newSession('Alpha', 'Explorer', 10_000)
    insertBuy({ sessionId: session.id, symbol: 'NVDA', shares: 10, fillPrice: 120.5, midPrice: 120.4, commission: 0.05 })
    insertBuy({ sessionId: session.id, symbol: 'GOOGL', shares: 20, fillPrice: 175.1, midPrice: 175.0, commission: 0.1 })
    const fills = store.listFills(session.id)
    expect(fills.map((f) => f.symbol).sort()).toEqual(['GOOGL', 'NVDA'])
    expect(fills).toHaveLength(2)
  })

  it('idempotent fill insert by key does not duplicate', () => {
    const session = newSession('G', 'Explorer', 5_000)
    const row = {
      sessionId: session.id,
      symbol: 'AAPL',
      side: 'buy' as const,
      shares: 5,
      fillPrice: 190,
      midPrice: 189.9,
      commission: 0.025,
      idempotencyKey: 'buy:AAPL:1',
      filledAt: '2024-06-03T13:40:00.000Z'
    }
    store.insertFill(row)
    store.insertFill(row)
    expect(store.listFills(session.id)).toHaveLength(1)
  })
})

describe('engine store outcomes', () => {
  it('stores Outcome with gross, net, and dual return fields', () => {
    const session = newSession('Beta', 'Control', 10_000)
    const outcome = store.insertOutcome({
      sessionId: session.id,
      grossPnl: 120,
      netPnl: 95,
      fullLimitReturn: 0.0095,
      deployedReturn: 0.012,
      spyReturn: 0.004,
      cashResidual: 2_000
    })
    const loaded = store.getOutcome(session.id)
    expect(loaded).toEqual(outcome)
    expect(loaded?.netPnl).toBe(95)
    expect(loaded?.fullLimitReturn).not.toBe(loaded?.deployedReturn)
  })
})

function newSession(
  name: string,
  role: 'Explorer' | 'Control',
  dailyLimitUsd: number
) {
  const factory = store.createFactory({ name, role, evidenceWeight: 1 })
  return store.createSession({
    factoryId: factory.id,
    sessionDate: '2024-06-03',
    dailyLimitUsd
  })
}

type BuySeed = {
  sessionId: string
  symbol: string
  shares: number
  fillPrice: number
  midPrice: number
  commission: number
}

function insertBuy(seed: BuySeed): void {
  store.insertFill({
    sessionId: seed.sessionId,
    symbol: seed.symbol,
    side: 'buy',
    shares: seed.shares,
    fillPrice: seed.fillPrice,
    midPrice: seed.midPrice,
    commission: seed.commission,
    idempotencyKey: `buy:${seed.symbol}:1`,
    filledAt: '2024-06-03T13:40:00.000Z'
  })
}
