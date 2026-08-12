import { describe, expect, it } from 'vitest'
import { createMockMarketData } from '../marketData/mockMarketData'
import {
  allocateWholeShares,
  applyFriction,
  createPaperBroker,
  grossPnl,
  netPnl
} from './paperBroker'
import { DEFAULT_FRICTION } from '../../../shared/engine/types'

const CLOCK = { now: () => new Date('2024-06-03T13:40:00.000Z') }

describe('friction model', () => {
  it('computes exact buy/sell fills from spread and slippage bps', () => {
    const friction = { spreadBps: 5, slippageBps: 3, commissionPerShare: 0.005 }
    const mid = 100
    expect(applyFriction({ side: 'buy', mid, friction })).toBeCloseTo(100.055, 10)
    expect(applyFriction({ side: 'sell', mid, friction })).toBeCloseTo(99.945, 10)
    expect(applyFriction({ side: 'buy', mid, friction: DEFAULT_FRICTION })).toBeGreaterThan(mid)
  })

  it('gross and net helpers use exact arithmetic', () => {
    expect(grossPnl({ buyMidNotional: 1000, sellMidNotional: 1100 })).toBe(100)
    expect(
      netPnl({ buyFillNotional: 1005, sellFillNotional: 1095, commissions: 2 })
    ).toBe(88)
  })
})

describe('allocateWholeShares', () => {
  it('floors shares from budget/price and keeps residual notional', () => {
    const legs = allocateWholeShares({
      dailyLimitUsd: 10_000,
      weights: [
        { symbol: 'NVDA', weight: 0.4, price: 100 },
        { symbol: 'GOOGL', weight: 0.4, price: 200 }
      ]
    })
    expect(legs).toEqual([
      { symbol: 'NVDA', shares: 40, notional: 4000 },
      { symbol: 'GOOGL', shares: 20, notional: 4000 }
    ])
  })
})

describe('paper buy cash tracking', () => {
  it('places independent fills and tracks cash/avgCost', () => {
    const broker = zeroSpreadBroker()
    broker.placeOrder({
      symbol: 'NVDA',
      side: 'buy',
      shares: 40,
      idempotencyKey: 'buy:NVDA'
    })
    broker.placeOrder({
      symbol: 'GOOGL',
      side: 'buy',
      shares: 20,
      idempotencyKey: 'buy:GOOGL'
    })
    expect(broker.getCash()).toBeCloseTo(1999.4, 8)
    expect(broker.getPositions()).toEqual([
      { symbol: 'NVDA', shares: 40, avgCost: 100 },
      { symbol: 'GOOGL', shares: 20, avgCost: 200 }
    ])
    broker.placeOrder({
      symbol: 'NVDA',
      side: 'buy',
      shares: 40,
      idempotencyKey: 'buy:NVDA'
    })
    expect(broker.getPositions()).toHaveLength(2)
  })
})

describe('paper flatten', () => {
  it('flattens all positions with commissions', () => {
    const broker = zeroSpreadBroker()
    broker.placeOrder({
      symbol: 'NVDA',
      side: 'buy',
      shares: 40,
      idempotencyKey: 'buy:NVDA'
    })
    broker.placeOrder({
      symbol: 'GOOGL',
      side: 'buy',
      shares: 20,
      idempotencyKey: 'buy:GOOGL'
    })
    const flats = broker.flattenAll()
    expect(flats).toHaveLength(2)
    expect(broker.getPositions()).toHaveLength(0)
    expect(broker.getCash()).toBeCloseTo(9998.8, 8)
  })
})

describe('paper hydrate', () => {
  it('hydrates from fills and supports partial sells', () => {
    const marketData = createMockMarketData([
      { symbol: 'NVDA', last: 100, bid: 100, ask: 100 }
    ])
    const broker = createPaperBroker({
      marketData,
      clock: CLOCK,
      startingCash: 5_000,
      friction: { spreadBps: 0, slippageBps: 0, commissionPerShare: 0 }
    })
    broker.hydrateFromFills([
      {
        symbol: 'NVDA',
        side: 'buy',
        shares: 30,
        fillPrice: 100,
        commission: 0,
        idempotencyKey: 'buy:NVDA'
      }
    ])
    expect(broker.getCash()).toBe(2000)
    expect(broker.getPositions()[0]).toEqual({ symbol: 'NVDA', shares: 30, avgCost: 100 })
    broker.placeOrder({
      symbol: 'NVDA',
      side: 'sell',
      shares: 10,
      idempotencyKey: 'sell:partial'
    })
    expect(broker.getPositions()[0]?.shares).toBe(20)
    expect(broker.getCash()).toBe(3000)
  })
})

function zeroSpreadBroker() {
  const marketData = createMockMarketData([
    { symbol: 'NVDA', last: 100, bid: 100, ask: 100 },
    { symbol: 'GOOGL', last: 200, bid: 200, ask: 200 }
  ])
  return createPaperBroker({
    marketData,
    clock: CLOCK,
    startingCash: 10_000,
    friction: { spreadBps: 0, slippageBps: 0, commissionPerShare: 0.01 }
  })
}
