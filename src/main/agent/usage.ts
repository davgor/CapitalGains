import type { AgentStage, AgentUsageSnapshot } from '../../shared/agent/types'

export interface UsageRow {
  id: string
  factoryId: string
  sessionId: string
  stage: AgentStage
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  costUsd: number | null
  createdAt: string
}

export interface UsageStore {
  insertUsage(input: {
    factoryId: string
    sessionId: string
    stage: AgentStage
    usage: AgentUsageSnapshot | null
  }): UsageRow
  listUsageBySessionDate(sessionDate: string): UsageRow[]
}

export function recordAgentUsage(
  store: UsageStore,
  input: {
    factoryId: string
    sessionId: string
    stage: AgentStage
    usage: AgentUsageSnapshot | null
  }
): UsageRow {
  return store.insertUsage(input)
}

export function aggregateDailySdkSpend(rows: UsageRow[]): {
  totalCostUsd: number | null
  totalTokens: number
  byFactory: Record<string, { costUsd: number | null; totalTokens: number }>
} {
  let costSum = 0
  let costSeen = false
  let totalTokens = 0
  const byFactory: Record<string, { costUsd: number | null; totalTokens: number }> = {}

  for (const row of rows) {
    const tokens = row.totalTokens ?? 0
    totalTokens += tokens
    const entry = byFactory[row.factoryId] ?? { costUsd: null, totalTokens: 0 }
    entry.totalTokens += tokens
    if (row.costUsd !== null) {
      costSeen = true
      costSum += row.costUsd
      entry.costUsd = (entry.costUsd ?? 0) + row.costUsd
    }
    byFactory[row.factoryId] = entry
  }

  return {
    totalCostUsd: costSeen ? costSum : null,
    totalTokens,
    byFactory
  }
}
