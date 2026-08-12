import { describe, expect, it } from 'vitest'
import { createMockMarketData } from '../marketData/mockMarketData'
import {
  buildFeatureTape,
  deserializeTape,
  passesUniverse,
  serializeTape
} from './featureTape'
import type { UniverseFundamentals } from './featureTape'

const AS_OF = new Date('2024-06-03T13:10:00.000Z')

function fund(partial: Partial<UniverseFundamentals> & { symbol: string }): UniverseFundamentals {
  return {
    sector: 'Tech',
    adv: 5_000_000,
    marketCap: 50_000_000_000,
    premarketGapPct: 1.2,
    rvol: 1.5,
    spreadBps: 4,
    isLeveragedEtf: false,
    ...partial
  }
}

describe('feature tape + universe filters', () => {
  it('returns only universe-passing symbols with feature fields', () => {
    const marketData = createMockMarketData([
      { symbol: 'NVDA', last: 120 },
      { symbol: 'PENNY', last: 2 },
      { symbol: 'ILLIQ', last: 50 },
      { symbol: 'MICRO', last: 40 },
      { symbol: 'TQQQ', last: 60 }
    ])
    const tape = buildFeatureTape({
      asOf: AS_OF,
      marketData,
      fundamentals: [
        fund({ symbol: 'NVDA' }),
        fund({ symbol: 'PENNY' }),
        fund({ symbol: 'ILLIQ', adv: 100_000 }),
        fund({ symbol: 'MICRO', marketCap: 500_000_000 }),
        fund({ symbol: 'TQQQ', isLeveragedEtf: true })
      ]
    })
    expect(tape.map((r) => r.symbol)).toEqual(['NVDA'])
    expect(tape[0]?.rvol).toBe(1.5)
    expect(tape[0]?.adv).toBe(5_000_000)
  })

  it('rejects penny / illiquid / micro-cap / leveraged ETF via helper', () => {
    expect(passesUniverse({ price: 5, adv: 5e6, marketCap: 5e10, isLeveragedEtf: false })).toBe(
      false
    )
    expect(passesUniverse({ price: 20, adv: 1e6, marketCap: 5e10, isLeveragedEtf: false })).toBe(
      false
    )
    expect(passesUniverse({ price: 20, adv: 5e6, marketCap: 1e9, isLeveragedEtf: false })).toBe(
      false
    )
    expect(passesUniverse({ price: 20, adv: 5e6, marketCap: 5e10, isLeveragedEtf: true })).toBe(
      false
    )
  })

  it('serializes tape for Research modal replay', () => {
    const marketData = createMockMarketData([{ symbol: 'GOOGL', last: 175 }])
    const tape = buildFeatureTape({
      asOf: AS_OF,
      marketData,
      fundamentals: [fund({ symbol: 'GOOGL', sector: 'Tech' })]
    })
    const roundTrip = deserializeTape(serializeTape(tape))
    expect(roundTrip).toEqual(tape)
  })
})
