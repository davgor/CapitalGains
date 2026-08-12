import type { MarketDataPort } from '../../../shared/engine/ports'
import type { Fill, Outcome } from '../../../shared/engine/types'
import type { EngineStore } from '../db/store'
import type { BrokerPort } from '../../../shared/engine/ports'
import { grossPnl, netPnl } from '../broker/paperBroker'
import { shouldDailyLossHalt, shouldTriggerStop } from '../risk/riskEngine'
import type { RiskLimits } from '../../../shared/engine/types'
import { DEFAULT_RISK_LIMITS } from '../../../shared/engine/types'

export function runMonitorTick(opts: {
  store: EngineStore
  sessionId: string
  asOf: Date
  marketData: MarketDataPort
  broker: BrokerPort
  startingEquity: number
  stops: Map<string, { fillPrice: number; stopLossPercent: number }>
  limits?: RiskLimits
}): { unrealizedNet: number; halted: boolean; stopped: string[] } {
  const limits = opts.limits ?? DEFAULT_RISK_LIMITS
  const positions = opts.broker.getPositions()
  const marks: Record<string, number> = {}
  let unrealized = 0
  const stopped: string[] = []
  for (const pos of positions) {
    const quote = opts.marketData.getQuote(pos.symbol, opts.asOf)
    marks[pos.symbol] = quote.last
    unrealized += (quote.last - pos.avgCost) * pos.shares
    const stop = opts.stops.get(pos.symbol)
    if (
      stop &&
      shouldTriggerStop({
        side: 'long',
        fillPrice: stop.fillPrice,
        mark: quote.last,
        stopLossPercent: stop.stopLossPercent
      })
    ) {
      stopped.push(pos.symbol)
    }
  }
  opts.store.insertSnapshot({
    sessionId: opts.sessionId,
    asOf: opts.asOf.toISOString(),
    marksJson: JSON.stringify(marks),
    unrealizedNet: unrealized
  })
  const equity = opts.broker.getCash() + markToMarket(positions, marks)
  const halted = shouldDailyLossHalt({
    startingEquity: opts.startingEquity,
    equity,
    limits
  })
  return { unrealizedNet: unrealized, halted, stopped }
}

export function computeOutcome(opts: {
  store: EngineStore
  sessionId: string
  dailyLimitUsd: number
  buys: Fill[]
  sells: Fill[]
  spyOpen: number
  spyClose: number
  cashResidual: number
}): Outcome {
  const buyMid = sumNotional(opts.buys, 'mid')
  const sellMid = sumNotional(opts.sells, 'mid')
  const buyFill = sumNotional(opts.buys, 'fill')
  const sellFill = sumNotional(opts.sells, 'fill')
  const commissions =
    opts.buys.reduce((a, f) => a + f.commission, 0) +
    opts.sells.reduce((a, f) => a + f.commission, 0)
  const gross = grossPnl({ buyMidNotional: buyMid, sellMidNotional: sellMid })
  const net = netPnl({
    buyFillNotional: buyFill,
    sellFillNotional: sellFill,
    commissions
  })
  const deployed = buyFill
  const fullLimitReturn = opts.dailyLimitUsd === 0 ? 0 : net / opts.dailyLimitUsd
  const deployedReturn = deployed === 0 ? 0 : net / deployed
  const spyReturn =
    opts.spyOpen === 0 ? 0 : (opts.spyClose - opts.spyOpen) / opts.spyOpen
  return opts.store.insertOutcome({
    sessionId: opts.sessionId,
    grossPnl: gross,
    netPnl: net,
    fullLimitReturn,
    deployedReturn,
    spyReturn,
    cashResidual: opts.cashResidual
  })
}

/** Daily Profit aggregates use net P&L only — never gross. */
export function dailyProfitFromOutcomes(outcomes: Array<{ netPnl: number }>): number {
  return outcomes.reduce((acc, o) => acc + o.netPnl, 0)
}

function sumNotional(fills: Fill[], kind: 'mid' | 'fill'): number {
  return fills.reduce((acc, f) => {
    const px = kind === 'mid' ? f.midPrice : f.fillPrice
    return acc + px * f.shares
  }, 0)
}

function markToMarket(
  positions: Array<{ symbol: string; shares: number }>,
  marks: Record<string, number>
): number {
  return positions.reduce((acc, p) => acc + (marks[p.symbol] ?? 0) * p.shares, 0)
}
