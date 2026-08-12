import { describe, expect, it } from 'vitest'
import { AgentError } from '../../../shared/agent/errors'
import { createMockAgentPort } from '../createAgentPort'
import { runResearch } from './runResearch'
import { safeParseResearchPlan } from './schema'

describe('Research Zod schema', () => {
  it('matches plan (sitOut, allocations, required stopLossPercent)', () => {
    const ok = safeParseResearchPlan({
      sitOut: false,
      allocations: [{ symbol: 'NVDA', weight: 0.3, sector: 'Tech' }],
      stopLossPercent: 2
    })
    expect(ok.success).toBe(true)
    const sit = safeParseResearchPlan({ sitOut: true, allocations: [], stopLossPercent: 2 })
    expect(sit.success).toBe(true)
    const missingStop = safeParseResearchPlan({
      sitOut: true,
      allocations: []
    })
    expect(missingStop.success).toBe(false)
  })
})

describe('runResearch tape bounds', () => {
  it('rejects off-tape symbols even if the agent emits them', async () => {
    const agent = createMockAgentPort({
      text: JSON.stringify({
        sitOut: false,
        allocations: [{ symbol: 'FAKE', weight: 0.2, sector: 'Tech' }],
        stopLossPercent: 2
      })
    })
    await expect(
      runResearch({
        agent,
        factoryId: 'f',
        sessionId: 's',
        kickoffJson: '{}',
        tapeSymbols: ['NVDA', 'GOOGL'],
        tapeSummary: 'NVDA,GOOGL'
      })
    ).rejects.toMatchObject({ kind: 'OffTapeSymbol' } satisfies Partial<AgentError>)
  })

  it('retries schema once then fails', async () => {
    let calls = 0
    const agent = createMockAgentPort({
      handler: async () => {
        calls += 1
        return { text: 'not-json', usage: null, modelId: 'composer-2.5' }
      }
    })
    await expect(
      runResearch({
        agent,
        factoryId: 'f',
        sessionId: 's',
        kickoffJson: '{}',
        tapeSymbols: ['NVDA'],
        tapeSummary: 'NVDA'
      })
    ).rejects.toMatchObject({ kind: 'SchemaInvalid' } satisfies Partial<AgentError>)
    expect(calls).toBe(2)
  })

  it('returns sitOut plans that skip Purchases via existing path', async () => {
    const agent = createMockAgentPort({
      text: JSON.stringify({ sitOut: true, allocations: [], stopLossPercent: 2 })
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
    expect(result.plan.allocations).toEqual([])
  })
})
