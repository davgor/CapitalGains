import type { LeaderboardRow } from './analytics'
import type { PromoteRecommendation } from './promote'
import type { StageNodeView } from './stageVisual'
import type {
  AppSettingsPublic,
  Factory,
  FactoryRole,
  PromoteEvent,
  StageName
} from './types'
import type {
  KickoffModalView,
  LessonsModalView,
  MonitoringModalView,
  OutcomeModalView,
  PurchasesModalView,
  ResearchModalView
} from './modalMappers'

export interface FactoryRowView {
  id: string
  name: string
  role: FactoryRole
  evidenceWeight: number
  queuedNextOpen: boolean
  lineageParentId: string | null
  netDailyProfit: number
  allocatedCash: number
  sessionId: string | null
  sessionStage: StageName | null
  stageNodes: StageNodeView[]
  failureLabel: string | null
  protectedControl: boolean
}

export interface DashboardSnapshot {
  sessionDate: string
  dailyLimitUsd: number
  dailyProfitNet: number
  factories: FactoryRowView[]
  allocations: Record<string, number>
  promoteRecommendations: PromoteRecommendation[]
  leaderboard: LeaderboardRow[]
  promoteHistory: PromoteEvent[]
  settings: AppSettingsPublic
}

export type StageModalPayload =
  | { stage: 'kickoff'; view: KickoffModalView }
  | { stage: 'research'; view: ResearchModalView }
  | { stage: 'purchases'; view: PurchasesModalView }
  | { stage: 'monitoring'; view: MonitoringModalView }
  | { stage: 'outcome'; view: OutcomeModalView }
  | { stage: 'lessons'; view: LessonsModalView }

export interface DashboardApi {
  getSnapshot: () => Promise<DashboardSnapshot>
  setDailyLimit: (dailyLimitUsd: number) => Promise<DashboardSnapshot>
  getSettings: () => Promise<AppSettingsPublic>
  saveSettings: (patch: {
    friction?: AppSettingsPublic['friction']
    risk?: AppSettingsPublic['risk']
    promoteThresholds?: AppSettingsPublic['promoteThresholds']
    controlFloorWeight?: number
    explorationAllotmentUsd?: number
    dailyLimitUsd?: number
    cursorApiKey?: string
    marketDataKey?: string
  }) => Promise<AppSettingsPublic>
  addFactory: (name: string) => Promise<Factory>
  renameFactory: (id: string, name: string) => Promise<Factory>
  openStageModal: (factoryId: string, stage: StageModalPayload['stage']) => Promise<StageModalPayload>
  confirmPromoteAction: (
    factoryId: string,
    action: 'promote' | 'kill' | 'clone'
  ) => Promise<DashboardSnapshot>
}
