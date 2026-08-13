import { allocateByEvidence } from '../../shared/engine/allocator'
import { buildLeaderboard, sortByNetExcessVsSpy } from '../../shared/engine/analytics'
import { loadAppSettings, saveAppSettingsPatch } from '../../shared/engine/appSettings'
import type {
  DashboardSnapshot,
  FactoryRowView,
  StageModalPayload
} from '../../shared/engine/dashboardApi'
import {
  mapKickoffModal,
  mapLessonsModal,
  mapMonitoringModal,
  mapOutcomeModal,
  mapPurchasesModal,
  mapResearchModal
} from '../../shared/engine/modalMappers'
import { aggregateDailyProfit } from '../../shared/engine/profit'
import {
  evaluatePromoteKill,
  type FactorySessionStats
} from '../../shared/engine/promote'
import { shouldQueueUntilNextOpen } from '../../shared/engine/queueEligibility'
import { mapStageNodeState } from '../../shared/engine/stageVisual'
import type {
  AppSettingsPublic,
  Factory,
  Outcome,
  Session
} from '../../shared/engine/types'
import { sessionPhaseAt, toNyWallTime } from '../engine/clock/marketClock'
import type { EngineStore } from '../engine/db/store'
import type { SecureSecretsStore } from '../secrets/secureStore'

export interface DashboardService {
  getSnapshot(): DashboardSnapshot
  setDailyLimit(dailyLimitUsd: number): DashboardSnapshot
  getSettings(): AppSettingsPublic
  saveSettings(patch: {
    friction?: AppSettingsPublic['friction']
    risk?: AppSettingsPublic['risk']
    promoteThresholds?: AppSettingsPublic['promoteThresholds']
    controlFloorWeight?: number
    explorationAllotmentUsd?: number
    dailyLimitUsd?: number
    cursorApiKey?: string
    marketDataKey?: string
  }): AppSettingsPublic
  addFactory(name: string): Factory
  renameFactory(id: string, name: string): Factory
  openStageModal(factoryId: string, stage: StageModalPayload['stage']): StageModalPayload
  confirmPromoteAction(
    factoryId: string,
    action: 'promote' | 'kill' | 'clone'
  ): DashboardSnapshot
}

export function createDashboardService(opts: {
  store: EngineStore
  secrets: SecureSecretsStore
  now?: () => Date
}): DashboardService {
  const now = opts.now ?? (() => new Date())

  const settingsFlags = (): { hasCursorApiKey: boolean; hasMarketDataKey: boolean } => ({
    hasCursorApiKey: opts.secrets.has('cursorApiKey'),
    hasMarketDataKey: opts.secrets.has('marketDataKey')
  })

  const readSettings = (): AppSettingsPublic =>
    loadAppSettings(opts.store, settingsFlags())

  const sessionDate = (): string => toNyWallTime(now()).dateKey

  const buildSnapshot = (): DashboardSnapshot => {
    ensureControlFactory(opts.store)
    const settings = readSettings()
    const date = sessionDate()
    const factories = opts.store.listFactories()
    const sessions = opts.store.listSessionsByDate(date)
    const sessionByFactory = new Map(sessions.map((s) => [s.factoryId, s]))
    const outcomes = sessions
      .map((s) => opts.store.getOutcome(s.id))
      .filter((o): o is Outcome => Boolean(o))
    const allocation = allocateByEvidence({
      factories,
      dailyLimitUsd: settings.dailyLimitUsd,
      controlFloorWeight: settings.controlFloorWeight,
      explorationAllotmentUsd: settings.explorationAllotmentUsd
    })

    const rows: FactoryRowView[] = factories.map((f) => {
      const session = sessionByFactory.get(f.id)
      const outcome = session ? opts.store.getOutcome(session.id) : undefined
      const failureLabel = readFailureLabel(opts.store, session)
      return {
        id: f.id,
        name: f.name,
        role: f.role,
        evidenceWeight: f.evidenceWeight,
        queuedNextOpen: f.queuedNextOpen,
        lineageParentId: f.lineageParentId,
        netDailyProfit: outcome?.netPnl ?? 0,
        allocatedCash: allocation.piles[f.id] ?? 0,
        sessionId: session?.id ?? null,
        sessionStage: session?.stage ?? null,
        stageNodes: mapStageNodeState({
          sessionStage: session?.stage ?? 'kickoff',
          failureLabel,
          skippedStages: session?.infraSkip ? ['purchases'] : undefined
        }),
        failureLabel,
        protectedControl: f.role === 'Control'
      }
    })

    const stats = factories.map((f) => collectFactoryStats(opts.store, f))
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
      leaderboard: sortByNetExcessVsSpy(buildLeaderboardFromStore(opts.store, factories)),
      promoteHistory: opts.store.listPromoteEvents(),
      settings
    }
  }

  return {
    getSnapshot: buildSnapshot,
    setDailyLimit(dailyLimitUsd) {
      saveAppSettingsPatch(opts.store, { dailyLimitUsd })
      return buildSnapshot()
    },
    getSettings: readSettings,
    saveSettings(patch) {
      const { cursorApiKey, marketDataKey, ...configPatch } = patch
      saveAppSettingsPatch(opts.store, configPatch)
      if (cursorApiKey !== undefined && cursorApiKey.length > 0) {
        opts.secrets.set('cursorApiKey', cursorApiKey)
      }
      if (marketDataKey !== undefined && marketDataKey.length > 0) {
        opts.secrets.set('marketDataKey', marketDataKey)
      }
      return readSettings()
    },
    addFactory(name) {
      const phase = sessionPhaseAt(now())
      const queued = shouldQueueUntilNextOpen({ phase })
      const hasControl = opts.store.listFactories().some((f) => f.role === 'Control')
      if (!hasControl && name.toLowerCase() === 'control') {
        return opts.store.createFactory({
          name,
          role: 'Control',
          evidenceWeight: 1,
          queuedNextOpen: false
        })
      }
      return opts.store.createFactory({
        name,
        role: 'Explorer',
        evidenceWeight: 0,
        queuedNextOpen: queued
      })
    },
    renameFactory(id, name) {
      const current = opts.store.getFactory(id)
      if (!current) {
        throw new Error(`factory not found: ${id}`)
      }
      if (current.role === 'Control' && name.trim().length === 0) {
        throw new Error('Control factory name required')
      }
      return opts.store.renameFactory(id, name)
    },
    openStageModal(factoryId, stage) {
      const session = opts.store
        .listSessionsByDate(sessionDate())
        .find((s) => s.factoryId === factoryId)
      if (!session) {
        return emptyModal(stage)
      }
      const nodes = mapStageNodeState({
        sessionStage: session.stage,
        failureLabel: readFailureLabel(opts.store, session),
        skippedStages: session.infraSkip ? ['purchases'] : undefined
      })
      const node = nodes.find((n) => n.stage === stage)
      if (!node?.opensModal) {
        return emptyModal(stage)
      }
      return buildStageModal(opts.store, session, stage)
    },
    confirmPromoteAction(factoryId, action) {
      const factory = opts.store.getFactory(factoryId)
      if (!factory) {
        throw new Error(`factory not found: ${factoryId}`)
      }
      if (factory.role === 'Control') {
        throw new Error('Control factory cannot be promoted, killed, or cloned without explicit policy')
      }
      if (action === 'promote') {
        opts.store.updateFactory(factoryId, {
          role: 'Promoted',
          evidenceWeight: Math.max(factory.evidenceWeight, 2)
        })
        opts.store.insertPromoteEvent({
          factoryId,
          action: 'promote',
          note: 'manual confirm'
        })
        opts.store.setConfig('diversity.mode', 'exploit')
      } else if (action === 'kill') {
        opts.store.updateFactory(factoryId, { role: 'Killed', evidenceWeight: 0 })
        opts.store.insertPromoteEvent({
          factoryId,
          action: 'kill',
          note: 'manual confirm'
        })
      } else {
        const clone = opts.store.createFactory({
          name: `${factory.name}-clone`,
          role: 'Explorer',
          evidenceWeight: 0,
          lineageParentId: factoryId,
          queuedNextOpen: shouldQueueUntilNextOpen({ phase: sessionPhaseAt(now()) })
        })
        opts.store.insertPromoteEvent({
          factoryId,
          action: 'clone',
          note: 'spawn explorer from lineage',
          cloneFactoryId: clone.id
        })
      }
      return buildSnapshot()
    }
  }
}

function ensureControlFactory(store: EngineStore): void {
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

function emptyModal(stage: StageModalPayload['stage']): StageModalPayload {
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

function buildStageModal(
  store: EngineStore,
  session: Session,
  stage: StageModalPayload['stage']
): StageModalPayload {
  const records = store.listStageRecords(session.id)
  const artifact = records.find((r) => r.stage === stage)
  const parsed = artifact ? safeJson(artifact.artifactJson) : null

  switch (stage) {
    case 'kickoff':
      return {
        stage,
        view: mapKickoffModal(
          parsed as {
            hypothesis?: string
            style?: string
            searchDirective?: string
            generatedKickoffPrompt?: string
          } | null
        )
      }
    case 'research':
      return {
        stage,
        view: mapResearchModal(
          parsed as {
            sitOut: boolean
            allocations: Array<{ symbol: string; weight: number; sector: string }>
          } | null
        )
      }
    case 'purchases': {
      const fills = store.listFills(session.id).filter((f) => f.side === 'buy')
      const outcome = store.getOutcome(session.id)
      return {
        stage,
        view: mapPurchasesModal({
          fills,
          cashResidual: outcome?.cashResidual ?? 0,
          dailyLimitUsd: session.dailyLimitUsd
        })
      }
    }
    case 'monitoring': {
      const snaps = store.listSnapshots(session.id)
      const last = snaps[snaps.length - 1]
      const marks = last ? (safeJson(last.marksJson) as Record<string, number>) : {}
      return {
        stage,
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
    case 'outcome': {
      const outcome = store.getOutcome(session.id)
      const control = store
        .listSessionsByDate(session.sessionDate)
        .map((s) => ({ session: s, factory: store.getFactory(s.factoryId) }))
        .find((x) => x.factory?.role === 'Control')
      const controlOutcome = control
        ? store.getOutcome(control.session.id)
        : undefined
      return {
        stage,
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
    case 'lessons': {
      const lessonsArtifact =
        (parsed as {
          thoughtProcess?: string
          nextSeed?: string
          promoteKillNote?: string
        } | null) ??
        (() => {
          const lesson = store
            .listLessonsPool({ limit: 20 })
            .find((l) => l.sessionId === session.id)
          if (!lesson) {
            return null
          }
          return safeJson(lesson.bodyJson) as {
            thoughtProcess?: string
            nextSeed?: string
            promoteKillNote?: string
          }
        })()
      return { stage, view: mapLessonsModal(lessonsArtifact) }
    }
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
