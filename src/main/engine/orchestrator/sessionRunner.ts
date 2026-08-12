import { DEFAULT_RISK_LIMITS } from '../../../shared/engine/types'
import type { Session } from '../../../shared/engine/types'
import { createPaperBroker } from '../broker/paperBroker'
import { superviseSession } from '../clock/supervisor'
import { runMonitorTick } from '../monitor/outcome'
import { executePurchases } from '../stage/purchases'
import { nextStage } from '../stage/stageGraph'
import { markInfraSkip, stageIndex } from './sessionHelpers'
import {
  advanceStage,
  buildStops,
  flattenToStore,
  sellLeg,
  writeOutcomeFromBroker,
  writeSitOutOutcome,
  type OrchestratorDeps,
  type PaperBroker
} from './stageActions'
import { commitStageAdvance } from '../stage/purchases'

export {
  createSessionForFactory,
  markInfraSkip,
  resumeSession
} from './sessionHelpers'
export type { OrchestratorDeps } from './stageActions'

/** Drive Kickoff → Outcome without Cursor SDK (hardcoded Research plan). */
export function runHardcodedSession(deps: OrchestratorDeps, session: Session): Session {
  let current = advanceStage(deps, session, 'kickoff', { skipped: true })
  current = applyInfraSkipIfNeeded(deps, current)
  if (current.infraSkip) {
    return finishSitOutPath(deps, current)
  }
  current = advanceStage(deps, current, 'regime', {
    tapeSymbols: deps.tape.map((t) => t.symbol)
  })
  current = advanceStage(deps, current, 'research', deps.plan)
  const broker = createPaperBroker({
    marketData: deps.marketData,
    clock: deps.clock,
    startingCash: current.dailyLimitUsd
  })
  return continueFromPurchases(deps, current, broker)
}

/** Resume after restart: continue from last committed stage without resetting P&L. */
export function continueFromPurchases(
  deps: OrchestratorDeps,
  session: Session,
  broker: PaperBroker
): Session {
  const limits = deps.limits ?? DEFAULT_RISK_LIMITS
  if (stageIndex(session.stage) < stageIndex('purchases')) {
    throw new Error('cannot purchase before research commit')
  }
  let current = session
  if (current.stage === 'research') {
    current = advanceStage(deps, current, 'research', deps.plan)
  }
  const existingFills = deps.store.listFills(current.id)
  if (existingFills.length > 0 && 'hydrateFromFills' in broker) {
    broker.hydrateFromFills(existingFills)
  }
  if (current.stage === 'purchases' && existingFills.filter((f) => f.side === 'buy').length === 0) {
    current = runPurchaseCommit(deps, current, broker)
  }
  if (current.infraSkip || isSitOut(deps)) {
    return finishSitOutPath(deps, current)
  }
  current = ensureMonitoring(deps, current, broker, limits)
  return finishFlattenPath(deps, current, broker)
}

function runPurchaseCommit(
  deps: OrchestratorDeps,
  session: Session,
  broker: PaperBroker
): Session {
  const purchase = executePurchases({
    store: deps.store,
    session,
    plan: deps.plan,
    tape: deps.tape,
    broker,
    marketData: deps.marketData,
    clock: deps.clock,
    limits: deps.limits ?? DEFAULT_RISK_LIMITS
  })
  if (purchase.status === 'riskRejected') {
    throw new Error('risk rejected basket')
  }
  return advanceStage(deps, session, 'purchases', purchase)
}

function ensureMonitoring(
  deps: OrchestratorDeps,
  session: Session,
  broker: PaperBroker,
  limits: NonNullable<OrchestratorDeps['limits']>
): Session {
  let current = session
  if (current.stage === 'purchases') {
    const stops = buildStops(deps, current)
    const tick = runMonitorTick({
      store: deps.store,
      sessionId: current.id,
      asOf: deps.clock.now(),
      marketData: deps.marketData,
      broker,
      startingEquity: current.dailyLimitUsd,
      stops,
      limits
    })
    handleTickRisk(deps, current, broker, tick)
    current = advanceStage(deps, current, 'purchases', { monitoring: true })
  }
  return current
}

function handleTickRisk(
  deps: OrchestratorDeps,
  session: Session,
  broker: PaperBroker,
  tick: { halted: boolean; stopped: string[] }
): void {
  if (tick.halted) {
    deps.store.updateSession(session.id, { buysBlocked: true })
  }
  const asOf = deps.clock.now().toISOString()
  for (const symbol of tick.stopped) {
    const pos = broker.getPositions().find((p) => p.symbol === symbol)
    if (pos) {
      sellLeg({
        deps,
        session,
        broker,
        symbol,
        shares: pos.shares,
        asOf,
        prefix: 'stop'
      })
    }
  }
}

function finishFlattenPath(
  deps: OrchestratorDeps,
  session: Session,
  broker: PaperBroker
): Session {
  let current = session
  const sells = flattenToStore(deps, current, broker)
  writeOutcomeFromBroker(deps, current, broker, sells)
  if (current.stage === 'monitoring') {
    current = advanceStage(deps, current, 'monitoring', { outcome: true })
  }
  if (current.stage === 'outcome') {
    current = advanceStage(deps, current, 'outcome', { lessonsPlaceholder: true })
  }
  if (current.stage === 'lessons') {
    current = advanceStage(deps, current, 'lessons', { done: true })
  }
  return current
}

function finishSitOutPath(deps: OrchestratorDeps, session: Session): Session {
  let current = drainToMonitoring(deps, session)
  if (!deps.store.getOutcome(current.id)) {
    writeSitOutOutcome(deps, current)
  }
  if (current.stage === 'monitoring') {
    current = advanceStage(deps, current, 'monitoring', { outcome: true })
  }
  if (current.stage === 'outcome') {
    current = advanceStage(deps, current, 'outcome', { lessonsPlaceholder: true })
  }
  if (current.stage === 'lessons') {
    current = advanceStage(deps, current, 'lessons', { done: true })
  }
  return current
}

function drainToMonitoring(deps: OrchestratorDeps, session: Session): Session {
  let current = session
  while (stageIndex(current.stage) < stageIndex('monitoring')) {
    current = commitStageAdvance({
      store: deps.store,
      session: current,
      to: nextStage(current.stage),
      artifact: { sitOut: true }
    })
  }
  return current
}

function applyInfraSkipIfNeeded(deps: OrchestratorDeps, session: Session): Session {
  const sup = superviseSession({
    clock: deps.clock,
    purchasesStarted: stageIndex(session.stage) >= stageIndex('purchases')
  })
  if (!sup.infraSkip) {
    return session
  }
  return markInfraSkip(deps.store, session.id)
}

function isSitOut(deps: OrchestratorDeps): boolean {
  return deps.plan.sitOut || deps.plan.allocations.length === 0
}
