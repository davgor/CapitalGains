import type {
  Factory,
  Session
} from '../../../shared/engine/types'
import type { EngineStore } from '../db/store'
import { mapAgentFailureToSessionFlags } from '../../agent/failures'
import { collectSiblingHypotheses } from '../../agent/kickoff/runFactoryKickoff'
import type { KickoffArtifact } from '../../agent/kickoff/schema'
import { markInfraSkip, stageIndex } from './sessionHelpers'
import { commitStageAdvance } from '../stage/purchases'
import { nextStage } from '../stage/stageGraph'
import { runAgenticSession } from './agentSessionFlow'
import type { AgentOrchestratorDeps } from './agentOrchestratorTypes'

export type { AgentOrchestratorDeps } from './agentOrchestratorTypes'

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
  const ordered = orderFactories(opts.factories)

  for (const factory of ordered) {
    const result = await runOneFactoryDay({
      deps: opts.deps,
      factory,
      sessionDate: opts.sessionDate,
      dailyLimitUsd: opts.dailyLimitUsd,
      siblingHypotheses: explorerHypotheses,
      controlSameDayNet: controlNet
    })
    results.push(result)
    if (result.ok) {
      controlNet = updateControlNet(opts.deps.store, factory, result.sessionId, controlNet)
      pushExplorerHypothesis(opts.deps.store, factory, result.sessionId, explorerHypotheses)
    }
  }
  return results
}

export { runAgenticSession } from './agentSessionFlow'

function orderFactories(factories: Factory[]): Factory[] {
  return [
    ...factories.filter((f) => f.role === 'Control'),
    ...factories.filter((f) => f.role !== 'Control')
  ]
}

async function runOneFactoryDay(opts: {
  deps: AgentOrchestratorDeps
  factory: Factory
  sessionDate: string
  dailyLimitUsd: number
  siblingHypotheses: string[]
  controlSameDayNet: number | null
}): Promise<FactoryDayResult> {
  const session = opts.deps.store.createSession({
    factoryId: opts.factory.id,
    sessionDate: opts.sessionDate,
    dailyLimitUsd: opts.dailyLimitUsd
  })
  try {
    const finished = await runAgenticSession({
      deps: opts.deps,
      factory: opts.factory,
      session,
      siblingHypotheses: opts.siblingHypotheses,
      controlSameDayNet: opts.controlSameDayNet
    })
    return {
      factoryId: opts.factory.id,
      sessionId: finished.id,
      ok: true,
      infraSkip: finished.infraSkip,
      session: finished
    }
  } catch (err) {
    return failureResult(opts.deps.store, opts.factory.id, session, err)
  }
}

function failureResult(
  store: EngineStore,
  factoryId: string,
  session: Session,
  err: unknown
): FactoryDayResult {
  const mapped = mapAgentFailureToSessionFlags(err)
  let current = session
  if (mapped.infraSkip) {
    current = markInfraSkip(store, session.id)
  }
  current = persistTerminalFailure(store, current, mapped.errorPayload)
  return {
    factoryId,
    sessionId: current.id,
    ok: false,
    infraSkip: mapped.infraSkip,
    error: mapped.errorPayload,
    session: current
  }
}

function updateControlNet(
  store: EngineStore,
  factory: Factory,
  sessionId: string,
  controlNet: number | null
): number | null {
  if (factory.role !== 'Control') {
    return controlNet
  }
  return store.getOutcome(sessionId)?.netPnl ?? null
}

function pushExplorerHypothesis(
  store: EngineStore,
  factory: Factory,
  sessionId: string,
  explorerHypotheses: string[]
): void {
  if (factory.role === 'Control') {
    return
  }
  const kickoff = readKickoffArtifact(store, sessionId)
  if (kickoff) {
    explorerHypotheses.push(...collectSiblingHypotheses([kickoff]))
  }
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
  for (const record of store.listStageRecords(sessionId)) {
    const artifact = tryParseKickoff(record.artifactJson)
    if (artifact) {
      return artifact
    }
  }
  return null
}

function tryParseKickoff(artifactJson: string): KickoffArtifact | null {
  try {
    const parsed = JSON.parse(artifactJson) as { hypothesis?: string }
    if (typeof parsed.hypothesis !== 'string') {
      return null
    }
    return parsed as KickoffArtifact
  } catch {
    return null
  }
}
