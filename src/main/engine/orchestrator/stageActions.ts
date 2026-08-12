import type { Clock, MarketDataPort } from '../../../shared/engine/ports'
import type {
  FeatureRow,
  Fill,
  ResearchPlan,
  RiskLimits,
  Session
} from '../../../shared/engine/types'
import { DEFAULT_RISK_LIMITS } from '../../../shared/engine/types'
import { createPaperBroker } from '../broker/paperBroker'
import type { EngineStore } from '../db/store'
import { computeOutcome } from '../monitor/outcome'
import { effectiveStopPercent } from '../risk/riskEngine'
import { commitStageAdvance } from '../stage/purchases'
import { nextStage } from '../stage/stageGraph'
import { stageIndex } from './sessionHelpers'

export interface OrchestratorDeps {
  store: EngineStore
  clock: Clock
  marketData: MarketDataPort
  tape: FeatureRow[]
  plan: ResearchPlan
  limits?: RiskLimits
  spyOpen: number
  spyClose: number
}

export type PaperBroker = ReturnType<typeof createPaperBroker>

export function advanceStage(
  deps: OrchestratorDeps,
  session: Session,
  expectedCurrent: Session['stage'],
  artifact: unknown
): Session {
  if (stageIndex(session.stage) > stageIndex(expectedCurrent)) {
    return session
  }
  const to = nextStage(expectedCurrent)
  return commitStageAdvance({ store: deps.store, session, to, artifact })
}

export function buildStops(
  deps: OrchestratorDeps,
  session: Session
): Map<string, { fillPrice: number; stopLossPercent: number }> {
  const fills = deps.store.listFills(session.id).filter((f) => f.side === 'buy')
  const map = new Map<string, { fillPrice: number; stopLossPercent: number }>()
  const limits = deps.limits ?? DEFAULT_RISK_LIMITS
  for (const fill of fills) {
    const alloc = deps.plan.allocations.find((a) => a.symbol === fill.symbol)
    map.set(fill.symbol, {
      fillPrice: fill.fillPrice,
      stopLossPercent: effectiveStopPercent({
        allocationStop: alloc?.stopLossPercent,
        planStop: deps.plan.stopLossPercent,
        limits
      })
    })
  }
  return map
}

export function flattenToStore(
  deps: OrchestratorDeps,
  session: Session,
  broker: PaperBroker
): Fill[] {
  const asOf = deps.clock.now().toISOString()
  const sells: Fill[] = []
  for (const pos of broker.getPositions()) {
    sells.push(
      sellLeg({
        deps,
        session,
        broker,
        symbol: pos.symbol,
        shares: pos.shares,
        asOf,
        prefix: 'flatten'
      })
    )
  }
  return sells
}

export function sellLeg(opts: {
  deps: OrchestratorDeps
  session: Session
  broker: PaperBroker
  symbol: string
  shares: number
  asOf: string
  prefix: string
}): Fill {
  const key = `${opts.prefix}:${opts.session.id}:${opts.symbol}`
  const existing = opts.deps.store.findFillByKey(opts.session.id, key)
  if (existing) {
    return existing
  }
  const fill = opts.broker.placeOrder({
    symbol: opts.symbol,
    side: 'sell',
    shares: opts.shares,
    idempotencyKey: key
  })
  return opts.deps.store.insertFill({
    sessionId: opts.session.id,
    symbol: opts.symbol,
    side: 'sell',
    shares: opts.shares,
    fillPrice: fill.fillPrice,
    midPrice: fill.midPrice,
    commission: fill.commission,
    idempotencyKey: key,
    filledAt: opts.asOf
  })
}

export function writeOutcomeFromBroker(
  deps: OrchestratorDeps,
  session: Session,
  broker: PaperBroker,
  sells: Fill[]
): void {
  const buys = deps.store.listFills(session.id).filter((f) => f.side === 'buy')
  computeOutcome({
    store: deps.store,
    sessionId: session.id,
    dailyLimitUsd: session.dailyLimitUsd,
    buys,
    sells,
    spyOpen: deps.spyOpen,
    spyClose: deps.spyClose,
    cashResidual: broker.getCash()
  })
}

export function writeSitOutOutcome(deps: OrchestratorDeps, session: Session): void {
  computeOutcome({
    store: deps.store,
    sessionId: session.id,
    dailyLimitUsd: session.dailyLimitUsd,
    buys: [],
    sells: [],
    spyOpen: deps.spyOpen,
    spyClose: deps.spyClose,
    cashResidual: session.dailyLimitUsd
  })
}
