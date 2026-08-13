import { describe, expect, it } from 'vitest'
import { AgentError } from '../../../shared/agent/errors'
import { createMockAgentPort } from '../createAgentPort'
import { KICKOFF_SYSTEM_PROMPT } from './prompts'
import { parseKickoffArtifact, safeParseKickoffArtifact } from './schema'
import { runKickoff } from './runKickoff'
import { classifyKickoffWordBudget, countWords } from './wordBudget'

const VALID = {
  hypothesis: 'Momentum fade in mega-cap tech after gap-ups',
  style: 'mean-reversion intraday',
  searchDirective: 'scan premarket gaps with elevated rvol',
  negativeConstraints: ['no leveraged ETFs', 'no sub-$5 names'],
  allowFullCash: true,
  generatedKickoffPrompt: 'Fade crowded tech gap-ups; sit out if breadth is one-sided.'
}

describe('Kickoff Zod contract', () => {
  it('rejects invalid Kickoff payloads', () => {
    const bad = safeParseKickoffArtifact({
      hypothesis: 'x',
      style: 'y',
      searchDirective: 'z',
      negativeConstraints: ['only-one'],
      allowFullCash: true,
      generatedKickoffPrompt: 'p'
    })
    expect(bad.success).toBe(false)
  })

  it('accepts snake_case aliases from agents', () => {
    const parsed = parseKickoffArtifact({
      hypothesis: 'h',
      style: 's',
      search_directive: 'd',
      negative_constraints: ['a', 'b'],
      allow_full_cash: false,
      generated_kickoff_prompt: 'prompt'
    })
    expect(parsed.allowFullCash).toBe(false)
    expect(parsed.searchDirective).toBe('d')
  })
})

describe('Kickoff word budget', () => {
  it('classifies soft and hard budgets', () => {
    const soft = Array.from({ length: 320 }, () => 'word').join(' ')
    const hard = Array.from({ length: 360 }, () => 'word').join(' ')
    expect(classifyKickoffWordBudget(soft).status).toBe('soft')
    expect(classifyKickoffWordBudget(hard).status).toBe('hard')
    expect(countWords('one two three')).toBe(3)
  })

  it('triggers one compress retry then BudgetExceeded', async () => {
    const bloated = {
      ...VALID,
      generatedKickoffPrompt: Array.from({ length: 400 }, () => 'pad').join(' ')
    }
    let calls = 0
    const agent = createMockAgentPort({
      handler: async () => {
        calls += 1
        return {
          text: JSON.stringify(bloated),
          usage: null,
          modelId: 'composer-2.5'
        }
      }
    })
    await expect(
      runKickoff({
        agent,
        factoryId: 'f',
        sessionId: 's',
        userPacket: 'regime=risk-on'
      })
    ).rejects.toMatchObject({ kind: 'BudgetExceeded' } satisfies Partial<AgentError>)
    expect(calls).toBe(2)
  })

  it('persists a valid Kickoff artifact for modal replay', async () => {
    const agent = createMockAgentPort({ text: JSON.stringify(VALID) })
    const result = await runKickoff({
      agent,
      factoryId: 'f',
      sessionId: 's',
      userPacket: 'packet'
    })
    expect(result.artifact.hypothesis).toContain('Momentum')
    expect(result.artifactJson).toContain('"hypothesis"')
    expect(KICKOFF_SYSTEM_PROMPT).toMatch(/Soft limit: 300/)
    expect(KICKOFF_SYSTEM_PROMPT).toMatch(/Hard stop: 350/)
  })
})
