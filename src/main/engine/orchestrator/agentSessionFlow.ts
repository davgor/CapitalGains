import type { Factory, ResearchPlan, Session } from '../../../shared/engine/types'
import { DEFAULT_RISK_LIMITS } from '../../../shared/engine/types'
import { createPaperBroker } from '../broker/paperBroker'
import { withTimeout } from '../../agent/failures'
import { assembleKickoffInputPacket } from '../../agent/kickoff/assemblePacket'
import { applySuggestedSeedToFactoryPrompt } from '../../agent/kickoff/controlFrozen'
import { runFactoryKickoff } from '../../agent/kickoff/runFactoryKickoff'
import type { KickoffArtifact } from '../../agent/kickoff/schema'
import { serializeTapeSummary } from '../../agent/kickoff/assemblePacket'
import { appendLessonToPool, queryGlobalLessonsPool } from '../../agent/lessons/pool'
import { runLessons } from '../../agent/lessons/runLessons'
import { runResearch } from '../../agent/research/runResearch'
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
import type { AgentOrchestratorDeps } from './agentOrchestratorTypes'

const DEFAULT_AGENT_TIMEOUT_MS = 120_000

export async function runAgenticSession(opts: {
  deps: AgentOrchestratorDeps
  factory: Factory
  session: Session
  siblingHypotheses: string[]
  controlSameDayNet: number | null
}): Promise<Session> {
  const timeoutMs = opts.deps.agentTimeoutMs ?? DEFAULT_AGENT_TIMEOUT_MS
  const kickoff = await runKickoffStage(opts, timeoutMs)
  let current = advanceOrchestratorStage(
    toOrch(opts.deps),
    opts.session,
    'kickoff',
    kickoff.artifact
  )
  current = applyClockInfraSkip(opts.deps, current)
  if (current.infraSkip) {
    return finishSitOutWithLessons({
      deps: opts.deps,
      factory: opts.factory,
      session: current,
      kickoff: kickoff.artifact,
      plan: null,
      controlSameDayNet: opts.controlSameDayNet
    })
  }
  current = advanceOrchestratorStage(toOrch(opts.deps), current, 'regime', {
    tapeSymbols: opts.deps.tape.map((t) => t.symbol)
  })
  return continueAfterRegime({
    deps: opts.deps,
    factory: opts.factory,
    session: current,
    kickoff,
    timeoutMs,
    controlSameDayNet: opts.controlSameDayNet
  })
}

async function runKickoffStage(
  opts: {
    deps: AgentOrchestratorDeps
    factory: Factory
    session: Session
    siblingHypotheses: string[]
  },
  timeoutMs: number
) {
  const diversityMode = opts.deps.diversityMode ?? 'explore'
  const packet = assembleKickoffInputPacket({
    regimeSummary: opts.deps.regimeSummary ?? 'regime=unknown',
    lessons: queryGlobalLessonsPool(opts.deps.store),
    ownRecap: '',
    tape: opts.deps.tape,
    siblingHypotheses: opts.siblingHypotheses,
    diversityMode,
    factoryRole: opts.factory.role
  })
  const kickoff = await withTimeout(
    runFactoryKickoff({
      agent: opts.deps.agent,
      role: opts.factory.role,
      factoryId: opts.factory.id,
      sessionId: opts.session.id,
      packet,
      frozenStore: opts.deps.store,
      siblingHypotheses: opts.siblingHypotheses,
      diversityMode
    }),
    timeoutMs,
    'kickoff'
  )
  recordAgentUsage(opts.deps.store, {
    factoryId: opts.factory.id,
    sessionId: opts.session.id,
    stage: 'kickoff',
    usage: kickoff.usage
  })
  return kickoff
}

async function continueAfterRegime(opts: {
  deps: AgentOrchestratorDeps
  factory: Factory
  session: Session
  kickoff: { artifact: KickoffArtifact; artifactJson: string; usage: unknown }
  timeoutMs: number
  controlSameDayNet: number | null
}): Promise<Session> {
  const { deps, factory } = opts
  const research = await withTimeout(
    runResearch({
      agent: deps.agent,
      factoryId: factory.id,
      sessionId: opts.session.id,
      kickoffJson: opts.kickoff.artifactJson,
      tapeSymbols: deps.tape.map((t) => t.symbol),
      tapeSummary: serializeTapeSummary(deps.tape)
    }),
    opts.timeoutMs,
    'research'
  )
  recordAgentUsage(deps.store, {
    factoryId: factory.id,
    sessionId: opts.session.id,
    stage: 'research',
    usage: research.usage
  })
  const current = advanceOrchestratorStage(
    toOrch(deps, research.plan),
    opts.session,
    'research',
    research.plan
  )
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
    kickoff: opts.kickoff.artifact,
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
  const { deps, plan } = opts
  if (plan.sitOut || plan.allocations.length === 0) {
    return finishSitOutWithLessons({
      deps,
      factory: opts.factory,
      session: opts.session,
      kickoff: opts.kickoff,
      plan,
      controlSameDayNet: opts.controlSameDayNet
    })
  }
  return runPurchasesMonitorFlatten(opts)
}

async function runPurchasesMonitorFlatten(opts: {
  deps: AgentOrchestratorDeps
  factory: Factory
  session: Session
  plan: ResearchPlan
  kickoff: KickoffArtifact
  broker: ReturnType<typeof createPaperBroker>
  controlSameDayNet: number | null
}): Promise<Session> {
  const { deps, plan } = opts
  const limits = deps.limits ?? DEFAULT_RISK_LIMITS
  let current = opts.session
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
  current = advanceOrchestratorStage(toOrch(deps, plan), current, 'purchases', purchase)
  applyMonitorTick(opts, current, limits)
  current = advanceOrchestratorStage(toOrch(deps, plan), current, 'purchases', { monitoring: true })
  const sells = flattenToStore(toOrch(deps, plan), current, opts.broker)
  writeOutcomeFromBroker(toOrch(deps, plan), current, opts.broker, sells)
  current = advanceOrchestratorStage(toOrch(deps, plan), current, 'monitoring', { outcome: true })
  return finishLessons({
    deps,
    factory: opts.factory,
    session: current,
    kickoff: opts.kickoff,
    plan,
    controlSameDayNet: opts.controlSameDayNet
  })
}

function applyMonitorTick(
  opts: {
    deps: AgentOrchestratorDeps
    plan: ResearchPlan
    broker: ReturnType<typeof createPaperBroker>
  },
  session: Session,
  limits: NonNullable<AgentOrchestratorDeps['limits']> | typeof DEFAULT_RISK_LIMITS
): void {
  const tick = runMonitorTick({
    store: opts.deps.store,
    sessionId: session.id,
    asOf: opts.deps.clock.now(),
    marketData: opts.deps.marketData,
    broker: opts.broker,
    startingEquity: session.dailyLimitUsd,
    stops: buildStops(toOrch(opts.deps, opts.plan), session),
    limits
  })
  if (tick.halted) {
    opts.deps.store.updateSession(session.id, { buysBlocked: true })
  }
  const asOf = opts.deps.clock.now().toISOString()
  for (const symbol of tick.stopped) {
    const pos = opts.broker.getPositions().find((p) => p.symbol === symbol)
    if (!pos) {
      continue
    }
    sellLeg({
      deps: toOrch(opts.deps, opts.plan),
      session,
      broker: opts.broker,
      symbol,
      shares: pos.shares,
      asOf,
      prefix: 'stop'
    })
  }
}

async function finishSitOutWithLessons(opts: {
  deps: AgentOrchestratorDeps
  factory: Factory
  session: Session
  kickoff: KickoffArtifact
  plan: ResearchPlan | null
  controlSameDayNet: number | null
}): Promise<Session> {
  let current = opts.session
  while (stageIndex(current.stage) < stageIndex('monitoring')) {
    current = commitStageAdvance({
      store: opts.deps.store,
      session: current,
      to: nextStage(current.stage),
      artifact: { sitOut: true }
    })
  }
  const plan = opts.plan ?? { sitOut: true, allocations: [] }
  if (!opts.deps.store.getOutcome(current.id)) {
    writeSitOutOutcome(toOrch(opts.deps, plan), current)
  }
  if (current.stage === 'monitoring') {
    current = advanceOrchestratorStage(toOrch(opts.deps, plan), current, 'monitoring', {
      outcome: true
    })
  }
  return finishLessons({ ...opts, session: current, plan })
}

async function finishLessons(opts: {
  deps: AgentOrchestratorDeps
  factory: Factory
  session: Session
  kickoff: KickoffArtifact
  plan: ResearchPlan | null
  controlSameDayNet: number | null
}): Promise<Session> {
  const plan = opts.plan ?? { sitOut: true, allocations: [] }
  const lessonsResult = await invokeLessonsAgent(opts, plan)
  recordAgentUsage(opts.deps.store, {
    factoryId: opts.factory.id,
    sessionId: opts.session.id,
    stage: 'lessons',
    usage: lessonsResult.usage
  })
  applySuggestedSeedToFactoryPrompt({
    store: opts.deps.store,
    role: opts.factory.role,
    suggestedSeed: lessonsResult.output.suggestedSeed
  })
  appendLessonToPool(opts.deps.store, {
    sessionId: opts.session.id,
    role: opts.factory.role,
    body: lessonsResult.output,
    excludeFromPromote: lessonsResult.output.excludeFromPromote === true || opts.session.infraSkip
  })
  return advanceLessonsStages(opts.deps, opts.session, plan, lessonsResult.output)
}

async function invokeLessonsAgent(
  opts: {
    deps: AgentOrchestratorDeps
    factory: Factory
    session: Session
    kickoff: KickoffArtifact
    controlSameDayNet: number | null
  },
  plan: ResearchPlan
) {
  const outcome = opts.deps.store.getOutcome(opts.session.id)
  const fills = opts.deps.store.listFills(opts.session.id)
  return withTimeout(
    runLessons({
      agent: opts.deps.agent,
      factoryId: opts.factory.id,
      sessionId: opts.session.id,
      role: opts.factory.role,
      packet: {
        hypothesis: opts.kickoff.hypothesis,
        research: plan,
        frictionFillsSummary: fills.map((f) => `${f.side}:${f.symbol}:${f.shares}`).join(','),
        trajectorySummary: `stage=${opts.session.stage}`,
        netPnl: outcome?.netPnl ?? 0,
        fullLimitReturn: outcome?.fullLimitReturn ?? 0,
        deployedReturn: outcome?.deployedReturn ?? 0,
        spyReturn: outcome?.spyReturn ?? 0,
        controlSameDayNet: opts.controlSameDayNet,
        infraSkip: opts.session.infraSkip
      }
    }),
    opts.deps.agentTimeoutMs ?? DEFAULT_AGENT_TIMEOUT_MS,
    'lessons'
  )
}

function advanceLessonsStages(
  deps: AgentOrchestratorDeps,
  session: Session,
  plan: ResearchPlan,
  lessonsOutput: unknown
): Session {
  let current = session
  if (current.stage === 'outcome') {
    current = advanceOrchestratorStage(toOrch(deps, plan), current, 'outcome', lessonsOutput)
  }
  if (current.stage === 'lessons') {
    current = advanceOrchestratorStage(toOrch(deps, plan), current, 'lessons', { done: true })
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
