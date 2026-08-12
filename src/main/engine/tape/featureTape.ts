import type { MarketDataPort } from '../../../shared/engine/ports'
import type { FeatureRow } from '../../../shared/engine/types'

export interface UniverseFundamentals {
  symbol: string
  sector: string
  adv: number
  marketCap: number
  premarketGapPct: number
  rvol: number
  spreadBps: number
  isLeveragedEtf: boolean
}

const MIN_ADV = 1_000_000
const MIN_MKTCAP = 2_000_000_000
const MIN_PRICE = 10

export function passesUniverse(row: {
  price: number
  adv: number
  marketCap: number
  isLeveragedEtf: boolean
  allowLeveragedEtf?: boolean
}): boolean {
  if (row.price < MIN_PRICE) {
    return false
  }
  if (row.adv <= MIN_ADV) {
    return false
  }
  if (row.marketCap < MIN_MKTCAP) {
    return false
  }
  if (row.isLeveragedEtf && !row.allowLeveragedEtf) {
    return false
  }
  return true
}

export function buildFeatureTape(opts: {
  asOf: Date
  marketData: MarketDataPort
  fundamentals: UniverseFundamentals[]
  allowLeveragedEtf?: boolean
}): FeatureRow[] {
  const tape: FeatureRow[] = []
  for (const fund of opts.fundamentals) {
    const quote = opts.marketData.getQuote(fund.symbol, opts.asOf)
    const row: FeatureRow = {
      symbol: fund.symbol,
      sector: fund.sector,
      price: quote.last,
      premarketGapPct: fund.premarketGapPct,
      rvol: fund.rvol,
      adv: fund.adv,
      marketCap: fund.marketCap,
      spreadBps: fund.spreadBps,
      isLeveragedEtf: fund.isLeveragedEtf
    }
    if (
      passesUniverse({
        price: row.price,
        adv: row.adv,
        marketCap: row.marketCap,
        isLeveragedEtf: row.isLeveragedEtf,
        allowLeveragedEtf: opts.allowLeveragedEtf
      })
    ) {
      tape.push(row)
    }
  }
  return tape
}

export function serializeTape(tape: FeatureRow[]): string {
  return JSON.stringify(tape)
}

export function deserializeTape(json: string): FeatureRow[] {
  return JSON.parse(json) as FeatureRow[]
}
