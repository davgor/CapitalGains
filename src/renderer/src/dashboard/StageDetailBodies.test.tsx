import { describe, expect, it } from 'vitest'
import type { StageModalPayload } from '../../../shared/engine/dashboardApi'
import {
  renderKickoffBody,
  renderLessonsBody,
  renderMonitoringBody,
  renderOutcomeBody,
  renderPurchasesBody,
  renderResearchBody,
  renderStageBody
} from './StageDetailBodies'

describe('stage detail locked bodies', () => {
  it('renders each stage-specific locked message', () => {
    const payloads: StageModalPayload[] = [
      { stage: 'kickoff', view: { status: 'locked', hypothesis: null, style: null, searchDirective: null, generatedKickoffPrompt: null, message: 'kickoff locked' } },
      { stage: 'research', view: { status: 'locked', sitOut: false, allocations: [], message: 'research locked' } },
      { stage: 'purchases', view: { status: 'locked', lines: [], cashResidual: 0, totals: { notional: 0, commission: 0 }, message: 'purchases locked' } },
      { stage: 'monitoring', view: { status: 'locked', marks: {}, deltas: {}, stops: {}, lastRefresh: null, unrealizedNet: 0, message: 'monitoring locked' } },
      { stage: 'outcome', view: { status: 'locked', grossPnl: null, netPnl: null, vsSpy: null, vsControl: null, fullLimitReturn: null, deployedReturn: null, message: 'outcome locked' } },
      { stage: 'lessons', view: { status: 'locked', thoughtProcess: null, nextSeed: null, promoteKillNote: null, message: 'lessons locked' } }
    ]

    expect(payloads.map((payload) => renderStageBody(payload).props.children)).toEqual([
      'kickoff locked',
      'research locked',
      'purchases locked',
      'monitoring locked',
      'outcome locked',
      'lessons locked'
    ])
  })
})

describe('stage detail ready bodies', () => {
  it('serializes kickoff and research values exactly', () => {
    const kickoff = renderKickoffBody({
      status: 'ready',
      hypothesis: 'gap fade',
      style: 'mean revert',
      searchDirective: 'liquid',
      generatedKickoffPrompt: 'prompt'
    })
    const research = renderResearchBody({
      status: 'ready',
      sitOut: false,
      allocations: [{ symbol: 'AAPL', weight: 0.5, sector: 'Tech' }]
    })

    expect(JSON.parse(kickoff.props.children)).toEqual({
      hypothesis: 'gap fade',
      style: 'mean revert',
      searchDirective: 'liquid',
      generatedKickoffPrompt: 'prompt'
    })
    expect(JSON.parse(research.props.children)).toEqual({
      sitOut: false,
      allocations: [{ symbol: 'AAPL', weight: 0.5, sector: 'Tech' }]
    })
  })

  it('formats purchase values and totals to two decimals', () => {
    const body = renderPurchasesBody({
      status: 'ready',
      lines: [
        {
          symbol: 'AAPL',
          shares: 3,
          rawQuote: 100.1,
          frictionFill: 100.2,
          notional: 300.6,
          commission: 0.03
        }
      ],
      cashResidual: 699.4,
      totals: { notional: 300.6, commission: 0.03 }
    })
    const table = body.props.children[0]
    const dataRow = table.props.children[1].props.children[0]

    expect(dataRow.props.children.map((cell) => cell.props.children)).toEqual([
      'AAPL',
      3,
      '100.10',
      '100.20',
      '300.60'
    ])
    expect(body.props.children[1].props.children).toEqual([
      'Residual cash: $',
      '699.40',
      ' · Totals notional $',
      '300.60'
    ])
  })

  it('serializes monitoring, outcome, and lessons values exactly', () => {
    const monitoring = renderMonitoringBody({
      status: 'ready',
      marks: { AAPL: 101 },
      deltas: { AAPL: 2 },
      stops: { AAPL: 95 },
      unrealizedNet: 12,
      lastRefresh: '15:00'
    })
    const outcome = renderOutcomeBody({
      status: 'ready',
      grossPnl: 20,
      netPnl: 15,
      vsSpy: 5,
      vsControl: 3,
      fullLimitReturn: 0.015,
      deployedReturn: 0.02
    })
    const lessons = renderLessonsBody({
      status: 'ready',
      thoughtProcess: 'tighten',
      nextSeed: 'seed',
      promoteKillNote: 'hold'
    })

    expect(JSON.parse(monitoring.props.children)).toMatchObject({
      marks: { AAPL: 101 },
      deltas: { AAPL: 2 },
      unrealizedNet: 12
    })
    expect(JSON.parse(outcome.props.children)).toMatchObject({
      grossPnl: 20,
      netPnl: 15,
      vsSpy: 5,
      vsControl: 3
    })
    expect(JSON.parse(lessons.props.children)).toEqual({
      thoughtProcess: 'tighten',
      nextSeed: 'seed',
      promoteKillNote: 'hold'
    })
  })
})
