import { describe, expect, it } from 'vitest'
import { createMockAgentPort } from '../createAgentPort'
import { runResearch } from './runResearch'
import { safeParseResearchPlan } from './schema'

describe('runResearch JSON extraction', () => {
  it('parses Research JSON embedded in prose', async () => {
    const plan = { sitOut: true, allocations: [], stopLossPercent: 2 }
    const agent = createMockAgentPort({
      text: `Result:\n${JSON.stringify(plan)}\nend`
    })
    const result = await runResearch({
      agent,
      factoryId: 'f',
      sessionId: 's',
      kickoffJson: '{}',
      tapeSymbols: ['NVDA'],
      tapeSummary: 'NVDA'
    })
    expect(result.plan.sitOut).toBe(true)
  })
})

describe('researchPlanSchema refinements', () => {
  it('rejects sitOut with allocations and non-sitOut empty allocations', () => {
    expect(
      safeParseResearchPlan({
        sitOut: true,
        allocations: [{ symbol: 'NVDA', weight: 0.1, sector: 'Tech' }],
        stopLossPercent: 2
      }).success
    ).toBe(false)
    expect(
      safeParseResearchPlan({
        sitOut: false,
        allocations: [],
        stopLossPercent: 2
      }).success
    ).toBe(false)
  })
})
