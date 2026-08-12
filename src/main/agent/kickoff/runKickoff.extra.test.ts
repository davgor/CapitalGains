import { describe, expect, it } from 'vitest'
import { AgentError } from '../../../shared/agent/errors'
import { createMockAgentPort } from '../createAgentPort'
import { runKickoff } from './runKickoff'

const VALID = {
  hypothesis: 'h',
  style: 's',
  searchDirective: 'd',
  negativeConstraints: ['a', 'b'],
  allowFullCash: true,
  generatedKickoffPrompt: 'short prompt'
}

describe('runKickoff JSON extraction', () => {
  it('parses Kickoff JSON embedded in prose', async () => {
    const agent = createMockAgentPort({
      text: `Here you go:\n${JSON.stringify(VALID)}\nThanks`
    })
    const result = await runKickoff({
      agent,
      factoryId: 'f',
      sessionId: 's',
      userPacket: 'p'
    })
    expect(result.artifact.hypothesis).toBe('h')
    expect(result.compressRetried).toBe(false)
  })

  it('schema-invalid then still invalid after retry raises SchemaInvalid', async () => {
    const agent = createMockAgentPort({
      handler: async () => ({ text: 'no-json-here', usage: null, modelId: 'composer-2.5' })
    })
    await expect(
      runKickoff({ agent, factoryId: 'f', sessionId: 's', userPacket: 'p' })
    ).rejects.toMatchObject({ kind: 'SchemaInvalid' } satisfies Partial<AgentError>)
  })
})
