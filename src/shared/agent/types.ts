import type { CursorModelId } from './modelConfig'

export type AgentStage = 'kickoff' | 'research' | 'lessons'

export interface AgentUsageSnapshot {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  costUsd: number | null
}

export interface AgentPromptRequest {
  stage: AgentStage
  system: string
  user: string
  factoryId: string
  sessionId: string
}

export interface AgentPromptResult {
  text: string
  usage: AgentUsageSnapshot | null
  modelId: CursorModelId
}
