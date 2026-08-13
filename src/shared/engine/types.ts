/** Domain types for the deterministic paper engine (Phase 1). */

export type FactoryRole = 'Control' | 'Explorer' | 'Promoted' | 'Killed'

export type StageName =
  | 'kickoff'
  | 'regime'
  | 'research'
  | 'purchases'
  | 'monitoring'
  | 'outcome'
  | 'lessons'
  | 'done'

export interface Factory {
  id: string
  name: string
  role: FactoryRole
  evidenceWeight: number
  createdAt: string
  /** When true, factory waits until next open (late-add). */
  queuedNextOpen: boolean
  /** Parent factory id when cloned from a promoted lineage. */
  lineageParentId: string | null
}

export interface PromoteEvent {
  id: string
  factoryId: string
  action: 'promote' | 'kill' | 'clone'
  note: string
  createdAt: string
  cloneFactoryId: string | null
}

export interface AppSettingsPublic {
  friction: FrictionConfig
  risk: RiskLimits
  promoteThresholds: {
    minSessionsExInfra: number
    minNetExcessVsSpy: number
    minNetExcessVsControl: number
    maxDrawdown: number
  }
  controlFloorWeight: number
  explorationAllotmentUsd: number
  dailyLimitUsd: number
  /** Whether Cursor API key is stored (never the raw value). */
  hasCursorApiKey: boolean
  /** Whether market-data key is stored. */
  hasMarketDataKey: boolean
}

export const DEFAULT_DAILY_LIMIT_USD = 10_000
export const DEFAULT_CONTROL_FLOOR_WEIGHT = 1
export const DEFAULT_EXPLORATION_ALLOTMENT_USD = 500

export const CONFIG_KEYS = {
  dailyLimitUsd: 'ui.dailyLimitUsd',
  friction: 'ui.friction',
  risk: 'ui.risk',
  promoteThresholds: 'ui.promoteThresholds',
  controlFloorWeight: 'ui.controlFloorWeight',
  explorationAllotmentUsd: 'ui.explorationAllotmentUsd'
} as const

export interface Session {
  id: string
  factoryId: string
  sessionDate: string
  stage: StageName
  infraSkip: boolean
  buysBlocked: boolean
  dailyLimitUsd: number
  createdAt: string
  updatedAt: string
}

export interface StageRecord {
  id: string
  sessionId: string
  stage: StageName
  committedAt: string
  artifactJson: string
}

export interface Fill {
  id: string
  sessionId: string
  symbol: string
  side: 'buy' | 'sell'
  shares: number
  fillPrice: number
  midPrice: number
  commission: number
  idempotencyKey: string
  filledAt: string
}

export interface Snapshot {
  id: string
  sessionId: string
  asOf: string
  marksJson: string
  unrealizedNet: number
}

export interface Outcome {
  id: string
  sessionId: string
  grossPnl: number
  netPnl: number
  fullLimitReturn: number
  deployedReturn: number
  spyReturn: number
  cashResidual: number
  createdAt: string
}

export interface EngineConfig {
  id: string
  key: string
  valueJson: string
}

export interface LessonRow {
  id: string
  sessionId: string
  roleTag: string
  bodyJson: string
  createdAt: string
  excludeFromPromote: boolean
}

export interface AgentUsageRow {
  id: string
  factoryId: string
  sessionId: string
  stage: 'kickoff' | 'research' | 'lessons'
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  costUsd: number | null
  createdAt: string
}

export interface RiskLimits {
  maxSingleNameWeight: number
  maxSectorWeight: number
  defaultStopLossPercent: number
  dailyLossHaltPercent: number
}

export interface Allocation {
  symbol: string
  weight: number
  sector: string
  stopLossPercent?: number
}

export interface ResearchPlan {
  sitOut: boolean
  allocations: Allocation[]
  stopLossPercent?: number
}

export interface FeatureRow {
  symbol: string
  sector: string
  price: number
  premarketGapPct: number
  rvol: number
  adv: number
  marketCap: number
  spreadBps: number
  isLeveragedEtf: boolean
}

export interface Quote {
  symbol: string
  last: number
  bid: number
  ask: number
  asOf: string
  ageMs: number
}

export interface FrictionConfig {
  spreadBps: number
  slippageBps: number
  commissionPerShare: number
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxSingleNameWeight: 0.4,
  maxSectorWeight: 0.6,
  defaultStopLossPercent: 2,
  dailyLossHaltPercent: 3
}

export const DEFAULT_FRICTION: FrictionConfig = {
  spreadBps: 5,
  slippageBps: 3,
  commissionPerShare: 0.005
}
