import { allocateByEvidence } from '../../shared/engine/allocator'
import { buildLeaderboard, sortByNetExcessVsSpy } from '../../shared/engine/analytics'
import { loadAppSettings } from '../../shared/engine/appSettings'
import type { DashboardSnapshot, FactoryRowView } from '../../shared/engine/dashboardApi'
import { evaluatePromoteKill, type FactorySessionStats } from '../../shared/engine/promote'
import { mapStageNodeState } from '../../shared/engine/stageVisual'
import type { AppSettingsPublic, Factory, Outcome, Session } from '../../shared/engine/types'
import { toNyWallTime } from '../engine/clock/marketClock'
import type { EngineStore } from '../engine/db/store'
import type { SecureSecretsStore } from '../secrets/secureStore'
import { aggregateDailyProfit } from '../../shared/engine/profit'

export function ensureControlFactory(store: EngineStore): void {
  if (store.listFactories().some((f) => f.role === 'Control')) {
    return
  }
  store.createFactory({
    name: 'Control',
    role: 'Control',
    evidenceWeight: 1,
    queuedNextOpen: false
  })
}

export function readSettings(
  store: EngineStore,
  secrets: SecureSecretsStore
): AppSettingsPublic {
  return loadAppSettings(store, {
    hasCursorApiKey: secrets.has('cursorApiKey'),
    hasMarketDataKey: secrets.has('marketDataKey')
  })
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

function sessionNetPnl(store: EngineStore, session: Session | undefined): number {
  if (!session) {
    return 0
  }
  return store.getOutcome(session.id)?.netPnl ?? 0
}

function buildStageNodes(session: Session | undefined, failureLabel: string | null) {
  const skippedStages = session?.infraSkip ? ['purchases' as const] : undefined
  return mapStageNodeState({
    sessionStage: session?.stage ?? 'kickoff',
    failureLabel,
    skippedStages
  })
}

function buildFactoryRow(
  store: EngineStore,
  factory: Factory,
  session: Session | undefined,
  allocatedCash: number
): FactoryRowView {
  const failureLabel = readFailureLabel(store, session)
  return {
    id: factory.id,
    name: factory.name,
    role: factory.role,
    evidenceWeight: factory.evidenceWeight,
    queuedNextOpen: factory.queuedNextOpen,
    lineageParentId: factory.lineageParentId,
    netDailyProfit: sessionNetPnl(store, session),
    allocatedCash,
    sessionId: session?.id ?? null,
    sessionStage: session?.stage ?? null,
    stageNodes: buildStageNodes(session, failureLabel),
    failureLabel,
    protectedControl: factory.role === 'Control'
  }
}

function collectFactoryStats(store: EngineStore, factory: Factory): FactorySessionStats {
  const sessions = store.listSessionsByFactory(factory.id)
  const usable = sessions.filter((s) => !s.infraSkip)
  const outcomes = usable
    .map((s) => store.getOutcome(s.id))
    .filter((o): o is Outcome => Boolean(o))
  const avgSpyParts = outcomes.map((o) => {
    const session = usable.find((u) => u.id === o.sessionId)
    const spyDollars = (session?.dailyLimitUsd ?? 0) * o.spyReturn
    return o.netPnl - spyDollars
  })
  const avgNetExcessVsSpy =
    avgSpyParts.length === 0
      ? 0
      : avgSpyParts.reduce((s, n) => s + n, 0) / avgSpyParts.length
  const controlNets = usable.map((s) => {
    const controlSession = store
      .listSessionsByDate(s.sessionDate)
      .find((x) => store.getFactory(x.factoryId)?.role === 'Control')
    return controlSession ? store.getOutcome(controlSession.id)?.netPnl ?? 0 : 0
  })
  const avgNetExcessVsControl =
    outcomes.length === 0
      ? 0
      : outcomes.reduce((s, o, i) => s + (o.netPnl - (controlNets[i] ?? 0)), 0) / outcomes.length

  let peak = 0
  let maxDrawdown = 0
  let equity = 0
  for (const o of outcomes) {
    equity += o.netPnl
    peak = Math.max(peak, equity)
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak)
    }
  }

  return {
    factoryId: factory.id,
    role: factory.role,
    sessionsExInfra: usable.length,
    avgNetExcessVsSpy,
    avgNetExcessVsControl,
    maxDrawdown
  }
}

function buildLeaderboardFromStore(store: EngineStore, factories: Factory[]) {
  return buildLeaderboard(
    factories.map((f) => {
      const sessions = store.listSessionsByFactory(f.id).filter((s) => !s.infraSkip)
      const outcomes = sessions
        .map((s) => store.getOutcome(s.id))
        .filter((o): o is Outcome => Boolean(o))
      const cumulativeNetPnl = outcomes.reduce((s, o) => s + o.netPnl, 0)
      const cumulativeSpyBenchmark = outcomes.reduce((s, o) => {
        const session = sessions.find((x) => x.id === o.sessionId)
        return s + (session ? session.dailyLimitUsd * o.spyReturn : 0)
      }, 0)
      let cumulativeControlBenchmark = 0
      for (const session of sessions) {
        const controlSession = store
          .listSessionsByDate(session.sessionDate)
          .find((x) => store.getFactory(x.factoryId)?.role === 'Control')
        if (controlSession) {
          cumulativeControlBenchmark += store.getOutcome(controlSession.id)?.netPnl ?? 0
        }
      }
      const winsExInfra = outcomes.filter((o) => o.netPnl > 0).length
      return {
        factoryId: f.id,
        name: f.name,
        role: f.role,
        cumulativeNetPnl,
        cumulativeSpyBenchmark,
        cumulativeControlBenchmark,
        winsExInfra,
        sessionsExInfra: sessions.length,
        evidenceWeight: f.evidenceWeight
      }
    })
  )
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export function buildDashboardSnapshot(
  store: EngineStore,
  secrets: SecureSecretsStore,
  now: () => Date
): DashboardSnapshot {
  ensureControlFactory(store)
  const settings = readSettings(store, secrets)
  const date = toNyWallTime(now()).dateKey
  const factories = store.listFactories()
  const sessions = store.listSessionsByDate(date)
  const sessionByFactory = new Map(sessions.map((s) => [s.factoryId, s]))
  const outcomes = sessions
    .map((s) => store.getOutcome(s.id))
    .filter((o): o is Outcome => Boolean(o))
  const allocation = allocateByEvidence({
    factories,
    dailyLimitUsd: settings.dailyLimitUsd,
    controlFloorWeight: settings.controlFloorWeight,
    explorationAllotmentUsd: settings.explorationAllotmentUsd
  })

  const rows = factories.map((f) =>
    buildFactoryRow(store, f, sessionByFactory.get(f.id), allocation.piles[f.id] ?? 0)
  )

  const stats = factories.map((f) => collectFactoryStats(store, f))
  const promoteRecommendations = evaluatePromoteKill({
    factories: stats,
    thresholds: settings.promoteThresholds
  })

  return {
    sessionDate: date,
    dailyLimitUsd: settings.dailyLimitUsd,
    dailyProfitNet: aggregateDailyProfit(outcomes),
    factories: rows,
    allocations: allocation.piles,
    promoteRecommendations,
    leaderboard: sortByNetExcessVsSpy(buildLeaderboardFromStore(store, factories)),
    promoteHistory: store.listPromoteEvents(),
    settings
  }
}
