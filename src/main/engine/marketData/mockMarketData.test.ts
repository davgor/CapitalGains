import { describe, expect, it } from 'vitest'
import { isQuoteStale } from '../../../shared/engine/ports'
import { createMockMarketData, createProviderStub } from './mockMarketData'

describe('MarketDataPort mock', () => {
  it('returns quote with exact age and default bid/ask band', () => {
    const port = createMockMarketData([
      { symbol: 'NVDA', last: 120, asOf: '2024-06-03T13:30:00.000Z' }
    ])
    const quote = port.getQuote('NVDA', new Date('2024-06-03T13:30:05.000Z'))
    expect(quote.last).toBe(120)
    expect(quote.ageMs).toBe(5_000)
    expect(quote.bid).toBeCloseTo(120 * 0.9995, 10)
    expect(quote.ask).toBeCloseTo(120 * 1.0005, 10)
    expect(quote.asOf).toBe('2024-06-03T13:30:00.000Z')
  })

  it('snapshot returns all symbols; missing symbol throws', () => {
    const port = createMockMarketData([
      { symbol: 'A', last: 10, bid: 9.9, ask: 10.1 },
      { symbol: 'B', last: 20, bid: 19.9, ask: 20.1 }
    ])
    const snap = port.getSnapshot(['A', 'B'], new Date('2024-06-03T14:00:00.000Z'))
    expect(snap.map((q) => q.symbol)).toEqual(['A', 'B'])
    expect(snap[0]?.bid).toBe(9.9)
    expect(() => port.getQuote('ZZZ', new Date())).toThrow(/no quote fixture/)
  })

  it('isQuoteStale rejects beyond threshold', () => {
    const port = createMockMarketData([
      { symbol: 'SPY', last: 500, asOf: '2024-06-03T13:00:00.000Z' }
    ])
    const quote = port.getQuote('SPY', new Date('2024-06-03T13:05:00.000Z'))
    expect(quote.ageMs).toBe(300_000)
    expect(isQuoteStale(quote, 60_000)).toBe(true)
    expect(isQuoteStale(quote, 10 * 60_000)).toBe(false)
  })

  it('provider stub refuses missing API key from env/config', () => {
    expect(() => createProviderStub({ apiKey: undefined, seeds: [] })).toThrow(/key missing/)
    const port = createProviderStub({
      apiKey: process.env['MARKET_DATA_API_KEY'] ?? 'test-key-not-a-secret',
      seeds: [{ symbol: 'AAPL', last: 190 }]
    })
    expect(port.getQuote('AAPL', new Date('2024-06-03T14:00:00.000Z')).last).toBe(190)
  })
})
