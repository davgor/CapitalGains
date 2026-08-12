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
  it('fill price differs from mid when spread/slippage > 0', () => {
    const mid = 100
    const buy = applyFriction({ side: 'buy', mid, friction: DEFAULT_FRICTION })
    const sell = applyFriction({ side: 'sell', mid, friction: DEFAULT_FRICTION })
    expect(buy).toBeGreaterThan(mid)
    expect(sell).toBeLessThan(mid)
  })

  it('gross vs net helpers diverge by friction costs', () => {
    const g = grossPnl({ buyMidNotional: 1000, sellMidNotional: 1100 })
    const n = netPnl({
      buyFillNotional: 1005,
      sellFillNotional: 1095,
      commissions: 2
    })
    expect(g).toBe(100)
    expect(n).toBe(88)
    expect(n).toBeLessThan(g)
  })
})

describe('multi-name paper fills', () => {
  it('places independent fills and leaves residual cash', () => {
    const marketData = createMockMarketData([
      { symbol: 'NVDA', last: 100, bid: 99.95, ask: 100.05 },
      { symbol: 'GOOGL', last: 200, bid: 199.9, ask: 200.1 }
    ])
    const broker = createPaperBroker({
      marketData,
      clock: CLOCK,
      startingCash: 10_000
    })
    const legs = allocateWholeShares({
      dailyLimitUsd: 10_000,
      weights: [
        { symbol: 'NVDA', weight: 0.4, price: 100 },
        { symbol: 'GOOGL', weight: 0.4, price: 200 }
      ]
    })
    expect(legs.map((l) => l.symbol)).toEqual(['NVDA', 'GOOGL'])
    for (const leg of legs) {
      broker.placeOrder({
        symbol: leg.symbol,
        side: 'buy',
        shares: leg.shares,
        idempotencyKey: `buy:${leg.symbol}`
      })
    }
    expect(broker.getPositions()).toHaveLength(2)
    expect(broker.getCash()).toBeGreaterThan(0)
    expect(broker.getCash()).toBeLessThan(10_000)
  })
})
