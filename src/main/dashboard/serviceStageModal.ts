import type { StageModalPayload } from '../../shared/engine/dashboardApi'
import {
  mapKickoffModal,
  mapLessonsModal,
  mapMonitoringModal,
  mapOutcomeModal,
  mapPurchasesModal,
  mapResearchModal
} from '../../shared/engine/modalMappers'
import { mapStageNodeState } from '../../shared/engine/stageVisual'
import type { Session } from '../../shared/engine/types'
import { toNyWallTime } from '../engine/clock/marketClock'
import type { EngineStore } from '../engine/db/store'

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function readFailureLabel(store: EngineStore, session: Session | undefined): string | null {
  if (!session) {
    return null
  }
  const records = store.listStageRecords(session.id)
  for (const r of [...records].reverse()) {
    const parsed = safeJson(r.artifactJson) as { error?: string; label?: string } | null
    if (parsed?.error || parsed?.label?.startsWith('Failed')) {
      return parsed.label ?? parsed.error ?? 'Failed'
    }
  }
  return null
}

export function emptyStageModal(stage: StageModalPayload['stage']): StageModalPayload {
  switch (stage) {
    case 'kickoff':
      return { stage, view: mapKickoffModal(null) }
    case 'research':
      return { stage, view: mapResearchModal(null) }
    case 'purchases':
      return { stage, view: mapPurchasesModal(null) }
    case 'monitoring':
      return { stage, view: mapMonitoringModal(null) }
    case 'outcome':
      return { stage, view: mapOutcomeModal(null) }
    case 'lessons':
      return { stage, view: mapLessonsModal(null) }
  }
}

function renderKickoffModal(
  parsed: unknown
): StageModalPayload {
  return {
    stage: 'kickoff',
    view: mapKickoffModal(
      parsed as {
        hypothesis?: string
        style?: string
        searchDirective?: string
        generatedKickoffPrompt?: string
      } | null
    )
  }
}

function renderResearchModal(parsed: unknown): StageModalPayload {
  return {
    stage: 'research',
    view: mapResearchModal(
      parsed as {
        sitOut: boolean
        allocations: Array<{ symbol: string; weight: number; sector: string }>
      } | null
    )
  }
}

function renderPurchasesModal(store: EngineStore, session: Session): StageModalPayload {
  const fills = store.listFills(session.id).filter((f) => f.side === 'buy')
  const outcome = store.getOutcome(session.id)
  return {
    stage: 'purchases',
    view: mapPurchasesModal({
      fills,
      cashResidual: outcome?.cashResidual ?? 0,
      dailyLimitUsd: session.dailyLimitUsd
    })
  }
}

function renderMonitoringModal(store: EngineStore, session: Session): StageModalPayload {
  const snaps = store.listSnapshots(session.id)
  const last = snaps[snaps.length - 1]
  const marks = last ? (safeJson(last.marksJson) as Record<string, number>) : {}
  return {
    stage: 'monitoring',
    view: mapMonitoringModal(
      last
        ? {
            marks: marks ?? {},
            unrealizedNet: last.unrealizedNet,
            lastRefresh: last.asOf
          }
        : null
    )
  }
}

function renderOutcomeModal(store: EngineStore, session: Session): StageModalPayload {
  const outcome = store.getOutcome(session.id)
  const control = store
    .listSessionsByDate(session.sessionDate)
    .map((s) => ({ session: s, factory: store.getFactory(s.factoryId) }))
    .find((x) => x.factory?.role === 'Control')
  const controlOutcome = control ? store.getOutcome(control.session.id) : undefined
  return {
    stage: 'outcome',
    view: mapOutcomeModal(
      outcome
        ? {
            grossPnl: outcome.grossPnl,
            netPnl: outcome.netPnl,
            spyReturn: outcome.spyReturn,
            fullLimitReturn: outcome.fullLimitReturn,
            deployedReturn: outcome.deployedReturn,
            controlSameDayNet: controlOutcome?.netPnl,
            dailyLimitUsd: session.dailyLimitUsd
          }
        : null
    )
  }
}

function resolveLessonsArtifact(store: EngineStore, session: Session, parsed: unknown) {
  const fromStage = parsed as {
    thoughtProcess?: string
    nextSeed?: string
    promoteKillNote?: string
  } | null
  if (fromStage) {
    return fromStage
  }
  const lesson = store.listLessonsPool({ limit: 20 }).find((l) => l.sessionId === session.id)
  if (!lesson) {
    return null
  }
  return safeJson(lesson.bodyJson) as {
    thoughtProcess?: string
    nextSeed?: string
    promoteKillNote?: string
  }
}

function renderLessonsModal(
  store: EngineStore,
  session: Session,
  parsed: unknown
): StageModalPayload {
  return {
    stage: 'lessons',
    view: mapLessonsModal(resolveLessonsArtifact(store, session, parsed))
  }
}

export function buildStageModal(
  store: EngineStore,
  session: Session,
  stage: StageModalPayload['stage']
): StageModalPayload {
  const records = store.listStageRecords(session.id)
  const artifact = records.find((r) => r.stage === stage)
  const parsed = artifact ? safeJson(artifact.artifactJson) : null

  switch (stage) {
    case 'kickoff':
      return renderKickoffModal(parsed)
    case 'research':
      return renderResearchModal(parsed)
    case 'purchases':
      return renderPurchasesModal(store, session)
    case 'monitoring':
      return renderMonitoringModal(store, session)
    case 'outcome':
      return renderOutcomeModal(store, session)
    case 'lessons':
      return renderLessonsModal(store, session, parsed)
  }
}

export function openStageModalForFactory(
  store: EngineStore,
  now: () => Date,
  factoryId: string,
  stage: StageModalPayload['stage']
): StageModalPayload {
  const date = toNyWallTime(now()).dateKey
  const session = store.listSessionsByDate(date).find((s) => s.factoryId === factoryId)
  if (!session) {
    return emptyStageModal(stage)
  }
  const nodes = mapStageNodeState({
    sessionStage: session.stage,
    failureLabel: readFailureLabel(store, session),
    skippedStages: session.infraSkip ? ['purchases'] : undefined
  })
  const node = nodes.find((n) => n.stage === stage)
  if (!node?.opensModal) {
    return emptyStageModal(stage)
  }
  return buildStageModal(store, session, stage)
}
