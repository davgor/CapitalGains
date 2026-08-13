import { describe, expect, it } from 'vitest'
import { HeaderBar } from './HeaderBar'

describe('HeaderBar', () => {
  it('renders Daily Limit and net Daily Profit', () => {
    const node = HeaderBar({
      dailyLimitUsd: 10000,
      dailyProfitNet: 42.5,
      sessionDate: '2024-06-03',
      version: '0.5.0',
      onDailyLimitChange: () => undefined,
      onOpenSettings: () => undefined
    })
    expect(node.props.className).toBe('dash-header')
    const metrics = node.props.children[1]
    const profit = metrics.props.children[1]
    expect(profit.props.children[1].props.children).toBe('$42.50')
    expect(profit.props.children[1].props['data-testid']).toBe('daily-profit')
  })
})
