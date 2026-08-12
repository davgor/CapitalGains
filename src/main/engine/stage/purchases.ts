import type { BrokerPort, MarketDataPort } from '../../../shared/engine/ports'
import type {
  FeatureRow,
  ResearchPlan,
  RiskLimits,
  Session
} from '../../../shared/engine/types'
import { DEFAULT_RISK_LIMITS } from '../../../shared/engine/types'
import type { EngineStore } from '../db/store'
import { allocateWholeShares } from '../broker/paperBroker'
import { validateBasket } from '../risk/riskEngine'
import { assertLegalTransition, nextStage } from './stageGraph'

interface PurchasesResult {
  status: 'filled' | 'sitOut' | 'riskRejected' | 'blocked'
  symbols: string[]
}

export function commitStageAdvance(opts: {
  store: EngineStore
  session: Session
  to: ReturnType<typeof nextStage>
  artifact: unknown
}): Session {
  assertLegalTransition(opts.session.stage, opts.to)
  opts.store.commitStage({
    sessionId: opts.session.id,
    stage: opts.to,
    artifactJson: JSON.stringify(opts.artifact)
  })
  return opts.store.getSession(opts.session.id)!
}

export function executePurchases(opts: {
  store: EngineStore
  session: Session
  plan: ResearchPlan
  tape: FeatureRow[]
  broker: BrokerPort
  marketData: MarketDataPort
  clock: { now(): Date }
  limits?: RiskLimits
}): PurchasesResult {
  if (opts.session.buysBlocked || opts.session.infraSkip) {
    return { status: 'blocked', symbols: [] }
  }
  if (opts.plan.sitOut || opts.plan.allocations.length === 0) {
    return { status: 'sitOut', symbols: [] }
  }
  const onTape = new Set(opts.tape.map((t) => t.symbol))
  const offTape = opts.plan.allocations.filter((a) => !onTape.has(a.symbol))
  if (offTape.length > 0) {
    throw new Error(`off-tape symbols: ${offTape.map((a) => a.symbol).join(',')}`)
  }
  const limits = opts.limits ?? DEFAULT_RISK_LIMITS
  const check = validateBasket(opts.plan.allocations, limits)
  if (!check.ok) {
    return { status: 'riskRejected', symbols: [] }
  }
  return placeBasket(opts)
}

function placeBasket(opts: {
  store: EngineStore
  session: Session
  plan: ResearchPlan
  broker: BrokerPort
  marketData: MarketDataPort
  clock: { now(): Date }
}): PurchasesResult {
  const asOf = opts.clock.now()
  const weights = opts.plan.allocations.map((a) => {
    const quote = opts.marketData.getQuote(a.symbol, asOf)
    return { symbol: a.symbol, weight: a.weight, price: quote.last }
  })
  const legs = allocateWholeShares({
    dailyLimitUsd: opts.session.dailyLimitUsd,
    weights
  })
  const symbols: string[] = []
  for (const leg of legs) {
    if (leg.shares <= 0) {
      continue
    }
    const key = `buy:${opts.session.id}:${leg.symbol}`
    const existing = opts.store.findFillByKey(opts.session.id, key)
    if (existing) {
      symbols.push(existing.symbol)
      continue
    }
    const fill = opts.broker.placeOrder({
      symbol: leg.symbol,
      side: 'buy',
      shares: leg.shares,
      idempotencyKey: key
    })
    opts.store.insertFill({
      sessionId: opts.session.id,
      symbol: leg.symbol,
      side: 'buy',
      shares: leg.shares,
      fillPrice: fill.fillPrice,
      midPrice: fill.midPrice,
      commission: fill.commission,
      idempotencyKey: key,
      filledAt: asOf.toISOString()
    })
    symbols.push(leg.symbol)
  }
  return { status: 'filled', symbols }
}
