import type { FactoryRole } from './types'

export interface LeaderboardRowInput {
  factoryId: string
  name: string
  role: FactoryRole
  cumulativeNetPnl: number
  /** Sum of (dailyLimit * spyReturn) style benchmark dollars, or comparable net. */
  cumulativeSpyBenchmark: number
  cumulativeControlBenchmark: number
  winsExInfra: number
  sessionsExInfra: number
  evidenceWeight: number
}

export interface LeaderboardRow {
  factoryId: string
  name: string
  role: FactoryRole
  cumulativeNetPnl: number
  netExcessVsSpy: number
  netExcessVsControl: number
  winRateExInfra: number | null
  evidenceWeight: number
  isControlBaseline: boolean
}

export function buildLeaderboard(inputs: LeaderboardRowInput[]): LeaderboardRow[] {
  const rows: LeaderboardRow[] = inputs.map((r) => ({
    factoryId: r.factoryId,
    name: r.name,
    role: r.role,
    cumulativeNetPnl: r.cumulativeNetPnl,
    netExcessVsSpy: r.cumulativeNetPnl - r.cumulativeSpyBenchmark,
    netExcessVsControl: r.cumulativeNetPnl - r.cumulativeControlBenchmark,
    winRateExInfra:
      r.sessionsExInfra > 0 ? r.winsExInfra / r.sessionsExInfra : null,
    evidenceWeight: r.evidenceWeight,
    isControlBaseline: r.role === 'Control'
  }))

  if (!rows.some((r) => r.role === 'Control')) {
    rows.unshift({
      factoryId: '__control_baseline__',
      name: 'Control',
      role: 'Control',
      cumulativeNetPnl: 0,
      netExcessVsSpy: 0,
      netExcessVsControl: 0,
      winRateExInfra: null,
      evidenceWeight: 0,
      isControlBaseline: true
    })
  }

  return rows
}

export function sortByNetExcessVsSpy(rows: LeaderboardRow[]): LeaderboardRow[] {
  return [...rows].sort((a, b) => b.netExcessVsSpy - a.netExcessVsSpy)
}
