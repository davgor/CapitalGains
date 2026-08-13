import { describe, expect, it } from 'vitest'
import {
  mapKickoffModal,
  mapLessonsModal,
  mapMonitoringModal,
  mapOutcomeModal,
  mapPurchasesModal,
  mapResearchModal
} from './modalMappers'

describe('mapKickoffModal', () => {
  it('maps kickoff artifact and shows locked messaging when missing', () => {
    expect(mapKickoffModal(null).status).toBe('locked')
    const mapped = mapKickoffModal({
      hypothesis: 'gap fade',
      style: 'mean-revert',
      searchDirective: 'find liquid names',
      generatedKickoffPrompt: 'PROMPT'
    })
    expect(mapped.status).toBe('ready')
    expect(mapped.hypothesis).toBe('gap fade')
  })
})

describe('mapResearchModal', () => {
  it('maps research sit-out and weights', () => {
    const sit = mapResearchModal({ sitOut: true, allocations: [] })
    expect(sit.sitOut).toBe(true)
    const plan = mapResearchModal({
      sitOut: false,
      allocations: [{ symbol: 'AAPL', weight: 0.5, sector: 'Tech' }]
    })
    expect(plan.allocations).toHaveLength(1)
  })
})

describe('mapPurchasesModal', () => {
  it('lists multiple purchase symbols when basket > 1', () => {
    const mapped = mapPurchasesModal({
      fills: [
        {
          symbol: 'NVDA',
          shares: 10,
          fillPrice: 100,
          midPrice: 99.9,
          commission: 0.05
        },
        {
          symbol: 'GOOGL',
          shares: 5,
          fillPrice: 150,
          midPrice: 149.8,
          commission: 0.025
        }
      ],
      cashResidual: 200,
      dailyLimitUsd: 5_000
    })
    expect(mapped.lines.map((l) => l.symbol).sort()).toEqual(['GOOGL', 'NVDA'])
    expect(mapped.totals.notional).toBeGreaterThan(0)
  })
})

describe('mapMonitoringModal and mapOutcomeModal', () => {
  it('maps monitoring marks and outcome dual benchmarks', () => {
    const mon = mapMonitoringModal({
      marks: { AAPL: 190 },
      unrealizedNet: 12,
      stops: { AAPL: 185 },
      lastRefresh: '2024-06-03T15:00:00.000Z'
    })
    expect(mon.marks.AAPL).toBe(190)
    const out = mapOutcomeModal({
      grossPnl: 20,
      netPnl: 15,
      spyReturn: 0.01,
      fullLimitReturn: 0.0015,
      deployedReturn: 0.002,
      controlSameDayNet: 10
    })
    expect(out.netPnl).toBe(15)
    expect(out.vsControl).toBe(5)
  })
})

describe('mapLessonsModal', () => {
  it('maps lessons thought process without crashing on missing', () => {
    expect(mapLessonsModal(null).status).toBe('locked')
    const mapped = mapLessonsModal({
      thoughtProcess: 'tighten stops',
      nextSeed: 'focus RVOL',
      promoteKillNote: 'hold'
    })
    expect(mapped.thoughtProcess).toBe('tighten stops')
  })
})
