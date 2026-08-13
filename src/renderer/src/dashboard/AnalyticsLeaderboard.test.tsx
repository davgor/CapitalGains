import { describe, expect, it } from 'vitest'
import { AnalyticsLeaderboard } from './AnalyticsLeaderboard'

describe('AnalyticsLeaderboard', () => {
  it('renders Control baseline and sorted excess columns', () => {
    const node = AnalyticsLeaderboard({
      rows: [
        {
          factoryId: 'e',
          name: 'Alpha',
          role: 'Explorer',
          cumulativeNetPnl: 90,
          netExcessVsSpy: 70,
          netExcessVsControl: 50,
          winRateExInfra: 0.8,
          evidenceWeight: 2,
          isControlBaseline: false
        },
        {
          factoryId: 'c',
          name: 'Control',
          role: 'Control',
          cumulativeNetPnl: 40,
          netExcessVsSpy: 20,
          netExcessVsControl: 0,
          winRateExInfra: 0.6,
          evidenceWeight: 1,
          isControlBaseline: true
        }
      ],
      history: []
    })
    expect(node.props['aria-label']).toBe('Analytics leaderboard')
    const table = node.props.children[1]
    const body = table.props.children[1]
    const rows = body.props.children as Array<{ props: { 'data-control'?: string } }>
    expect(rows.some((r) => r.props['data-control'] === '1')).toBe(true)
  })
})
