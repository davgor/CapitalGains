import type { MarketDataPort } from '../../../shared/engine/ports'
import type { Quote } from '../../../shared/engine/types'

interface MockQuoteSeed {
  symbol: string
  last: number
  bid?: number
  ask?: number
  asOf?: string
}

export function createMockMarketData(seeds: MockQuoteSeed[]): MarketDataPort {
  const bySymbol = new Map(seeds.map((s) => [s.symbol, s]))
  return {
    getQuote: (symbol, asOf) => quoteFromSeed(requireSeed(bySymbol, symbol), asOf),
    getSnapshot: (symbols, asOf) =>
      symbols.map((symbol) => quoteFromSeed(requireSeed(bySymbol, symbol), asOf))
  }
}

export function createProviderStub(opts: {
  apiKey: string | undefined
  seeds: MockQuoteSeed[]
}): MarketDataPort {
  if (!opts.apiKey) {
    throw new Error('market data provider key missing (read from config/env only)')
  }
  return createMockMarketData(opts.seeds)
}

function requireSeed(map: Map<string, MockQuoteSeed>, symbol: string): MockQuoteSeed {
  const seed = map.get(symbol)
  if (!seed) {
    throw new Error(`no quote fixture for ${symbol}`)
  }
  return seed
}

function quoteFromSeed(seed: MockQuoteSeed, asOf: Date): Quote {
  const stamp = seed.asOf ?? asOf.toISOString()
  const seedTime = Date.parse(stamp)
  const ageMs = Math.max(0, asOf.getTime() - seedTime)
  const last = seed.last
  const bid = seed.bid ?? last * 0.9995
  const ask = seed.ask ?? last * 1.0005
  return { symbol: seed.symbol, last, bid, ask, asOf: stamp, ageMs }
}
