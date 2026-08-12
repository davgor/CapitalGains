import { describe, expect, it } from 'vitest'
import { isQuoteStale } from '../../../shared/engine/ports'
import { createMockMarketData, createProviderStub } from './mockMarketData'

describe('MarketDataPort mock', () => {
  it('returns quote with age metadata', () => {
    const port = createMockMarketData([
      { symbol: 'NVDA', last: 120, asOf: '2024-06-03T13:30:00.000Z' }
    ])
    const quote = port.getQuote('NVDA', new Date('2024-06-03T13:30:05.000Z'))
    expect(quote.last).toBe(120)
    expect(quote.ageMs).toBe(5_000)
    expect(quote.bid).toBeLessThan(quote.ask)
  })

  it('isQuoteStale rejects beyond threshold', () => {
    const port = createMockMarketData([
      { symbol: 'SPY', last: 500, asOf: '2024-06-03T13:00:00.000Z' }
    ])
    const quote = port.getQuote('SPY', new Date('2024-06-03T13:05:00.000Z'))
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
