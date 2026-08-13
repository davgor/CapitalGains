import { describe, expect, it } from 'vitest'
import { aggregateDailyProfit } from './profit'

describe('aggregateDailyProfit', () => {
  it('sums factory net outcomes for the session day', () => {
    expect(
      aggregateDailyProfit([
        { netPnl: 10.5 },
        { netPnl: -3 },
        { netPnl: 1.25 }
      ])
    ).toBeCloseTo(8.75, 6)
  })

  it('uses net not gross', () => {
    expect(aggregateDailyProfit([{ netPnl: 5, grossPnl: 99 }])).toBe(5)
  })

  it('returns 0 for empty day', () => {
    expect(aggregateDailyProfit([])).toBe(0)
  })
})
