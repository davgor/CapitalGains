import type { AgentPort, Clock, MarketDataPort } from '../../../shared/engine/ports'
import type { FeatureRow, RiskLimits } from '../../../shared/engine/types'
import type { EngineStore } from '../db/store'
import type { DiversityMode } from '../../agent/kickoff/assemblePacket'

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
