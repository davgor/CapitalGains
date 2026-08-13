import { describe, expect, it } from 'vitest'
import {
  buildLeaderboard,
  sortByNetExcessVsSpy,
  type LeaderboardRowInput
} from './analytics'

function row(partial: Partial<LeaderboardRowInput> & Pick<LeaderboardRowInput, 'factoryId' | 'name' | 'role'>): LeaderboardRowInput {
  return {
    cumulativeNetPnl: 0,
    cumulativeSpyBenchmark: 0,
    cumulativeControlBenchmark: 0,
    winsExInfra: 0,
    sessionsExInfra: 0,
    evidenceWeight: 1,
    ...partial
  }
}

describe('analytics net excess', () => {
  it('computes net excess vs SPY and Control', () => {
    const rows = buildLeaderboard([
      row({
        factoryId: 'c',
        name: 'Control',
        role: 'Control',
        cumulativeNetPnl: 100,
        cumulativeSpyBenchmark: 80,
        cumulativeControlBenchmark: 100,
        winsExInfra: 3,
        sessionsExInfra: 5
      }),
      row({
        factoryId: 'e',
        name: 'Explorer',
        role: 'Explorer',
        cumulativeNetPnl: 150,
        cumulativeSpyBenchmark: 80,
        cumulativeControlBenchmark: 100,
        winsExInfra: 4,
        sessionsExInfra: 5,
        evidenceWeight: 2
      })
    ])
    const explorer = rows.find((r) => r.factoryId === 'e')!
    expect(explorer.netExcessVsSpy).toBe(70)
    expect(explorer.netExcessVsControl).toBe(50)
    expect(explorer.winRateExInfra).toBeCloseTo(0.8, 6)
  })
})

describe('analytics control row', () => {
  it('always includes Control row for comparison', () => {
    const rows = buildLeaderboard([
      row({
        factoryId: 'e',
        name: 'OnlyExplorer',
        role: 'Explorer',
        cumulativeNetPnl: 10,
        cumulativeSpyBenchmark: 5,
        cumulativeControlBenchmark: 0
      })
    ])
    expect(rows.some((r) => r.role === 'Control')).toBe(true)
  })
})

describe('analytics sorting', () => {
  it('sorts by net excess vs SPY descending', () => {
    const unsorted = buildLeaderboard([
      row({
        factoryId: 'c',
        name: 'Control',
        role: 'Control',
        cumulativeNetPnl: 50,
        cumulativeSpyBenchmark: 40
      }),
      row({
        factoryId: 'a',
        name: 'A',
        role: 'Explorer',
        cumulativeNetPnl: 20,
        cumulativeSpyBenchmark: 40
      }),
      row({
        factoryId: 'b',
        name: 'B',
        role: 'Promoted',
        cumulativeNetPnl: 90,
        cumulativeSpyBenchmark: 40
      })
    ])
    const sorted = sortByNetExcessVsSpy(unsorted)
    expect(sorted.map((r) => r.factoryId)).toEqual(['b', 'c', 'a'])
  })
})
