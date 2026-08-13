import { describe, expect, it } from 'vitest'
import { createMockAgentPort } from '../createAgentPort'
import { runLessons } from './runLessons'

describe('runLessons JSON extraction', () => {
  it('parses Lessons JSON embedded in prose', async () => {
    const body = {
      failureMode: 'late',
      winLossFactor: 'spread',
      suggestedSeed: 'earlier'
    }
    const result = await runLessons({
      agent: createMockAgentPort({ text: `note\n${JSON.stringify(body)}\n` }),
      factoryId: 'f',
      sessionId: 's',
      role: 'Explorer',
      packet: {
        hypothesis: 'h',
        research: {},
        frictionFillsSummary: '',
        trajectorySummary: '',
        netPnl: 0,
        fullLimitReturn: 0,
        deployedReturn: 0,
        spyReturn: 0,
        controlSameDayNet: null,
        infraSkip: false
      }
    })
    expect(result.output.failureMode).toBe('late')
    expect(result.skippedAgent).toBe(false)
  })
})
