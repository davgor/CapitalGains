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
    const rows = body.props.children as Array<{
      props: {
        'data-control'?: string
        children: Array<{ props: { children: unknown } }>
      }
    }>
    expect(rows.some((r) => r.props['data-control'] === '1')).toBe(true)
    expect(rows.map((r) => r.props['data-control'])).toEqual(['0', '1'])
    expect(rows[0]?.props.children[4].props.children).toBe('80%')
    expect(rows[1]?.props.children[4].props.children).toBe('60%')
    expect(node.props.children[3].props.children).toBe('No promote/kill events yet.')
  })
})

describe('AnalyticsLeaderboard history', () => {
  it('renders null win rates and exact promote history details', () => {
    const node = AnalyticsLeaderboard({
      rows: [
        {
          factoryId: 'control-id',
          name: 'Control',
          role: 'Control',
          cumulativeNetPnl: 0,
          netExcessVsSpy: 0,
          netExcessVsControl: 0,
          winRateExInfra: null,
          evidenceWeight: 1,
          isControlBaseline: true
        }
      ],
      history: [
        {
          id: 'event-1',
          factoryId: 'factory-123456789',
          action: 'kill',
          note: 'manual confirm',
          createdAt: '2024-06-03T15:00:00.000Z',
          cloneFactoryId: null
        }
      ]
    })
    const tableRow = node.props.children[1].props.children[1].props.children[0]
    const history = node.props.children[3]

    expect(tableRow.props.children[4].props.children).toBe('—')
    expect(history.props.children[0].props.children).toEqual([
      '2024-06-03T15:00:00.000Z',
      ' · ',
      'kill',
      ' · ',
      'factory-',
      ' — ',
      'manual confirm'
    ])
  })
})
