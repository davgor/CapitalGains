import type { AgentPort, Clock, MarketDataPort } from '../../../shared/engine/ports'
import type {
  Factory,
  FeatureRow,
  ResearchPlan,
  RiskLimits,
  Session
} from '../../../shared/engine/types'
import { DEFAULT_RISK_LIMITS } from '../../../shared/engine/types'
import { createPaperBroker } from '../broker/paperBroker'
import type { EngineStore } from '../db/store'
import { mapAgentFailureToSessionFlags, withTimeout } from '../../agent/failures'
import { assembleKickoffInputPacket, type DiversityMode } from '../../agent/kickoff/assemblePacket'
import { applySuggestedSeedToFactoryPrompt } from '../../agent/kickoff/controlFrozen'
import { runFactoryKickoff, collectSiblingHypotheses } from '../../agent/kickoff/runFactoryKickoff'
import type { KickoffArtifact } from '../../agent/kickoff/schema'
import { appendLessonToPool, queryGlobalLessonsPool } from '../../agent/lessons/pool'
import { runLessons } from '../../agent/lessons/runLessons'
import { runResearch } from '../../agent/research/runResearch'
import { serializeTapeSummary } from '../../agent/kickoff/assemblePacket'
import { recordAgentUsage } from '../../agent/usage'
import { markInfraSkip, stageIndex } from './sessionHelpers'
import {
  advanceStage as advanceOrchestratorStage,
  buildStops,
  flattenToStore,
  sellLeg,
  writeOutcomeFromBroker,
  writeSitOutOutcome,
  type OrchestratorDeps
} from './stageActions'
import { executePurchases, commitStageAdvance } from '../stage/purchases'
import { nextStage } from '../stage/stageGraph'
import { runMonitorTick } from '../monitor/outcome'
import { superviseSession } from '../clock/supervisor'

const DEFAULT_AGENT_TIMEOUT_MS = 120_000

export interface AgentOrchestratorDeps {
  store: EngineStore
  clock: Clock
  marketData: MarketDataPort
  agent: AgentPort
  tape: FeatureRow[]
  limits?: RiskLimits
  spyOpen: number
  spyClose: number
  diversityMode?: DiversityMode
  regimeSummary?: string
  agentTimeoutMs?: number
}

export interface FactoryDayResult {
  factoryId: string
  sessionId: string
  ok: boolean
  infraSkip: boolean
  error?: ReturnType<typeof mapAgentFailureToSessionFlags>['errorPayload']
  session: Session
}

/**
 * Run one Control + N Explorers for a session date.
 * One factory failure does not stop the others.
 */
export async function runAgenticDay(opts: {
  deps: AgentOrchestratorDeps
  factories: Factory[]
  sessionDate: string
  dailyLimitUsd: number
}): Promise<FactoryDayResult[]> {
  const results: FactoryDayResult[] = []
  const explorerHypotheses: string[] = []
  let controlNet: number | null = null

  const ordered = [
    ...opts.factories.filter((f) => f.role === 'Control'),
    ...opts.factories.filter((f) => f.role !== 'Control')
  ]

  for (const factory of ordered) {
    const session = opts.deps.store.createSession({
      factoryId: factory.id,
      sessionDate: opts.sessionDate,
      dailyLimitUsd: opts.dailyLimitUsd
    })
    try {
      const finished = await runAgenticSession({
        deps: opts.deps,
        factory,
        session,
        siblingHypotheses: explorerHypotheses,
        controlSameDayNet: controlNet
      })
      if (factory.role !== 'Control') {
        const kickoff = readKickoffArtifact(opts.deps.store, finished.id)
        if (kickoff) {
          explorerHypotheses.push(...collectSiblingHypotheses([kickoff]))
        }
      } else {
        controlNet = opts.deps.store.getOutcome(finished.id)?.netPnl ?? null
      }
      results.push({
        factoryId: factory.id,
        sessionId: finished.id,
        ok: true,
        infraSkip: finished.infraSkip,
        session: finished
      })
    } catch (err) {
      const mapped = mapAgentFailureToSessionFlags(err)
      let current = session
      if (mapped.infraSkip) {
        current = markInfraSkip(opts.deps.store, session.id)
      }
      current = persistTerminalFailure(opts.deps.store, current, mapped.errorPayload)
      results.push({
        factoryId: factory.id,
        sessionId: current.id,
        ok: false,
        infraSkip: mapped.infraSkip,
        error: mapped.errorPayload,
        session: current
      })
    }
  }
  return results
}

export async function runAgenticSession(opts: {
  deps: AgentOrchestratorDeps
  factory: Factory
  session: Session
  siblingHypotheses: string[]
  controlSameDayNet: number | null
}): Promise<Session> {
  const { deps, factory, session } = opts
  const timeoutMs = deps.agentTimeoutMs ?? DEFAULT_AGENT_TIMEOUT_MS
  const diversityMode = deps.diversityMode ?? 'explore'
  const lessons = queryGlobalLessonsPool(deps.store)
  const packet = assembleKickoffInputPacket({
    regimeSummary: deps.regimeSummary ?? 'regime=unknown',
    lessons,
    ownRecap: '',
    tape: deps.tape,
    siblingHypotheses: opts.siblingHypotheses,
    diversityMode,
    factoryRole: factory.role
  })

  const kickoff = await withTimeout(
    runFactoryKickoff({
      agent: deps.agent,
      role: factory.role,
      factoryId: factory.id,
      sessionId: session.id,
      packet,
      frozenStore: deps.store,
      siblingHypotheses: opts.siblingHypotheses,
      diversityMode
    }),
    timeoutMs,
    'kickoff'
  )
  recordAgentUsage(deps.store, {
    factoryId: factory.id,
    sessionId: session.id,
    stage: 'kickoff',
    usage: kickoff.usage
  })
  let current = advanceOrchestratorStage(toOrch(deps), session, 'kickoff', kickoff.artifact)

  current = applyClockInfraSkip(deps, current)
  if (current.infraSkip) {
    return finishSitOutWithLessons(deps, factory, current, kickoff.artifact, null, opts.controlSameDayNet)
  }

  current = advanceOrchestratorStage(toOrch(deps), current, 'regime', {
    tapeSymbols: deps.tape.map((t) => t.symbol)
  })

  const research = await withTimeout(
    runResearch({
      agent: deps.agent,
      factoryId: factory.id,
      sessionId: current.id,
      kickoffJson: kickoff.artifactJson,
      tapeSymbols: deps.tape.map((t) => t.symbol),
      tapeSummary: serializeTapeSummary(deps.tape)
    }),
    timeoutMs,
    'research'
  )
  recordAgentUsage(deps.store, {
    factoryId: factory.id,
    sessionId: current.id,
    stage: 'research',
    usage: research.usage
  })
  current = advanceOrchestratorStage(toOrch(deps, research.plan), current, 'research', research.plan)

  const broker = createPaperBroker({
    marketData: deps.marketData,
    clock: deps.clock,
    startingCash: current.dailyLimitUsd
  })
  return continueAgenticFromPurchases({
    deps,
    factory,
    session: current,
    plan: research.plan,
    kickoff: kickoff.artifact,
    broker,
    controlSameDayNet: opts.controlSameDayNet
  })
}

function continueAgenticFromPurchases(opts: {
  deps: AgentOrchestratorDeps
  factory: Factory
  session: Session
  plan: ResearchPlan
  kickoff: KickoffArtifact
  broker: ReturnType<typeof createPaperBroker>
  controlSameDayNet: number | null
}): Promise<Session> {
  const { deps, session, plan } = opts
  const limits = deps.limits ?? DEFAULT_RISK_LIMITS
  let current = session

  if (current.stage === 'research') {
    // already committed research artifact
  }

  if (plan.sitOut || plan.allocations.length === 0) {
    return Promise.resolve(
      finishSitOutWithLessons(deps, opts.factory, current, opts.kickoff, plan, opts.controlSameDayNet)
    )
  }

  if (current.stage === 'purchases' || current.stage === 'research') {
    // move to purchases via execute
  }

  const purchase = executePurchases({
    store: deps.store,
    session: current,
    plan,
    tape: deps.tape,
    broker: opts.broker,
    marketData: deps.marketData,
    clock: deps.clock,
    limits
  })
  if (purchase.status === 'riskRejected') {
    throw new Error('risk rejected basket')
  }
  current = advanceOrchestratorStage(toOrch(deps), current, 'purchases', purchase)

  const stops = buildStops(toOrch(deps, plan), current)
  const tick = runMonitorTick({
    store: deps.store,
    sessionId: current.id,
    asOf: deps.clock.now(),
    marketData: deps.marketData,
    broker: opts.broker,
    startingEquity: current.dailyLimitUsd,
    stops,
    limits
  })
  if (tick.halted) {
    deps.store.updateSession(current.id, { buysBlocked: true })
  }
  const asOf = deps.clock.now().toISOString()
  for (const symbol of tick.stopped) {
    const pos = opts.broker.getPositions().find((p) => p.symbol === symbol)
    if (pos) {
      sellLeg({
        deps: toOrch(deps, plan),
        session: current,
        broker: opts.broker,
        symbol,
        shares: pos.shares,
        asOf,
        prefix: 'stop'
      })
    }
  }
  current = advanceOrchestratorStage(toOrch(deps, plan), current, 'purchases', { monitoring: true })

  const sells = flattenToStore(toOrch(deps, plan), current, opts.broker)
  writeOutcomeFromBroker(toOrch(deps, plan), current, opts.broker, sells)
  current = advanceOrchestratorStage(toOrch(deps, plan), current, 'monitoring', { outcome: true })

  return finishLessons(deps, opts.factory, current, opts.kickoff, plan, opts.controlSameDayNet)
}

async function finishSitOutWithLessons(
  deps: AgentOrchestratorDeps,
  factory: Factory,
  session: Session,
  kickoff: KickoffArtifact,
  plan: ResearchPlan | null,
  controlSameDayNet: number | null
): Promise<Session> {
  let current = session
  while (stageIndex(current.stage) < stageIndex('monitoring')) {
    current = commitStageAdvance({
      store: deps.store,
      session: current,
      to: nextStage(current.stage),
      artifact: { sitOut: true }
    })
  }
  if (!deps.store.getOutcome(current.id)) {
    writeSitOutOutcome(toOrch(deps, plan ?? { sitOut: true, allocations: [] }), current)
  }
  if (current.stage === 'monitoring') {
    current = advanceOrchestratorStage(
      toOrch(deps, plan ?? { sitOut: true, allocations: [] }),
      current,
      'monitoring',
      { outcome: true }
    )
  }
  return finishLessons(deps, factory, current, kickoff, plan, controlSameDayNet)
}

async function finishLessons(
  deps: AgentOrchestratorDeps,
  factory: Factory,
  session: Session,
  kickoff: KickoffArtifact,
  plan: ResearchPlan | null,
  controlSameDayNet: number | null
): Promise<Session> {
  let current = session
  const outcome = deps.store.getOutcome(current.id)
  const fills = deps.store.listFills(current.id)
  const lessonsResult = await withTimeout(
    runLessons({
      agent: deps.agent,
      factoryId: factory.id,
      sessionId: current.id,
      role: factory.role,
      packet: {
        hypothesis: kickoff.hypothesis,
        research: plan,
        frictionFillsSummary: fills.map((f) => `${f.side}:${f.symbol}:${f.shares}`).join(','),
        trajectorySummary: `stage=${current.stage}`,
        netPnl: outcome?.netPnl ?? 0,
        fullLimitReturn: outcome?.fullLimitReturn ?? 0,
        deployedReturn: outcome?.deployedReturn ?? 0,
        spyReturn: outcome?.spyReturn ?? 0,
        controlSameDayNet,
        infraSkip: current.infraSkip
      }
    }),
    deps.agentTimeoutMs ?? DEFAULT_AGENT_TIMEOUT_MS,
    'lessons'
  )
  recordAgentUsage(deps.store, {
    factoryId: factory.id,
    sessionId: current.id,
    stage: 'lessons',
    usage: lessonsResult.usage
  })

  applySuggestedSeedToFactoryPrompt({
    store: deps.store,
    role: factory.role,
    suggestedSeed: lessonsResult.output.suggestedSeed
  })

  appendLessonToPool(deps.store, {
    sessionId: current.id,
    role: factory.role,
    body: lessonsResult.output,
    excludeFromPromote: lessonsResult.output.excludeFromPromote === true || current.infraSkip
  })

  if (current.stage === 'outcome') {
    current = advanceOrchestratorStage(
      toOrch(deps, plan ?? { sitOut: true, allocations: [] }),
      current,
      'outcome',
      lessonsResult.output
    )
  }
  if (current.stage === 'lessons') {
    current = advanceOrchestratorStage(
      toOrch(deps, plan ?? { sitOut: true, allocations: [] }),
      current,
      'lessons',
      { done: true }
    )
  }
  return current
}

function applyClockInfraSkip(deps: AgentOrchestratorDeps, session: Session): Session {
  const sup = superviseSession({
    clock: deps.clock,
    purchasesStarted: stageIndex(session.stage) >= stageIndex('purchases')
  })
  if (!sup.infraSkip) {
    return session
  }
  return markInfraSkip(deps.store, session.id)
}

function persistTerminalFailure(
  store: EngineStore,
  session: Session,
  errorPayload: ReturnType<typeof mapAgentFailureToSessionFlags>['errorPayload']
): Session {
  let current = session
  const artifact = { error: errorPayload, failed: true }
  if (stageIndex(current.stage) <= stageIndex('kickoff')) {
    current = commitStageAdvance({
      store,
      session: current,
      to: 'regime',
      artifact
    })
  }
  while (stageIndex(current.stage) < stageIndex('done')) {
    current = commitStageAdvance({
      store,
      session: current,
      to: nextStage(current.stage),
      artifact: { error: errorPayload, sitOut: true }
    })
  }
  return current
}

function readKickoffArtifact(store: EngineStore, sessionId: string): KickoffArtifact | null {
  const records = store.listStageRecords(sessionId)
  const regimeOrKickoff = records.find((r) => {
    try {
      const parsed = JSON.parse(r.artifactJson) as { hypothesis?: string }
      return typeof parsed.hypothesis === 'string'
    } catch {
      return false
    }
  })
  if (!regimeOrKickoff) {
    return null
  }
  try {
    return JSON.parse(regimeOrKickoff.artifactJson) as KickoffArtifact
  } catch {
    return null
  }
}

function toOrch(deps: AgentOrchestratorDeps, plan?: ResearchPlan): OrchestratorDeps {
  return {
    store: deps.store,
    clock: deps.clock,
    marketData: deps.marketData,
    tape: deps.tape,
    plan: plan ?? { sitOut: true, allocations: [] },
    limits: deps.limits,
    spyOpen: deps.spyOpen,
    spyClose: deps.spyClose
  }
}
