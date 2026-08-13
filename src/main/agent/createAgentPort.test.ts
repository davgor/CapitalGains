import { describe, expect, it, vi } from 'vitest'
import { AgentError } from '../../shared/agent/errors'
import { CURSOR_MODEL_ID } from '../../shared/agent/modelConfig'
import type { AgentPort } from '../../shared/engine/ports'
import { createAgentPort, createMockAgentPort } from './createAgentPort'

describe('createAgentPort mock path', () => {
  it('runs a one-shot prompt through an injected mock without network', async () => {
    const mock = createMockAgentPort({
      text: '{"ok":true}',
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        costUsd: 0.001
      }
    })
    const result = await createAgentPort({ mock }).runPrompt({
      stage: 'kickoff',
      system: 'sys',
      user: 'user',
      factoryId: 'f1',
      sessionId: 's1'
    })
    expect(result.text).toBe('{"ok":true}')
    expect(result.modelId).toBe(CURSOR_MODEL_ID)
    expect(result.usage?.totalTokens).toBe(15)
  })

  it('exposes AgentPort interface for unit tests without live SDK', async () => {
    const calls: string[] = []
    const mock: AgentPort = {
      runPrompt: async (req) => {
        calls.push(req.stage)
        return { text: 'x', usage: null, modelId: CURSOR_MODEL_ID }
      }
    }
    await createAgentPort({ mock }).runPrompt({
      stage: 'lessons',
      system: '',
      user: '',
      factoryId: 'f',
      sessionId: 's'
    })
    expect(calls).toEqual(['lessons'])
  })
})

describe('createAgentPort key missing', () => {
  it('fails Kickoff/Research/Lessons cleanly when API key is missing (no hang)', async () => {
    const port = createAgentPort({ apiKey: undefined, env: {} })
    await expect(
      port.runPrompt({
        stage: 'kickoff',
        system: 's',
        user: 'u',
        factoryId: 'f',
        sessionId: 's'
      })
    ).rejects.toMatchObject({ kind: 'MissingApiKey' } satisfies Partial<AgentError>)
  })
})

describe('createAgentPort fixed model', () => {
  it('uses a single fixed model id (not Auto/router) on the production path', async () => {
    const createAgent = vi.fn(async () => ({
      send: vi.fn(async () => ({
        wait: vi.fn(async () => ({
          status: 'finished' as const,
          result: 'hello',
          usage: undefined
        }))
      })),
      getUsage: vi.fn(async () => ({
        usage: {
          inputTokens: 1,
          outputTokens: 2,
          totalTokens: 3,
          cacheReadTokens: 0,
          cacheWriteTokens: 0
        },
        cost: { totalCents: 0 },
        runs: []
      }))
    }))
    const result = await createAgentPort({
      apiKey: 'test-key',
      createAgent: createAgent as never
    }).runPrompt({
      stage: 'research',
      system: 'sys',
      user: 'user',
      factoryId: 'f',
      sessionId: 's'
    })
    expect(createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        model: { id: CURSOR_MODEL_ID }
      })
    )
    expect(result.modelId).toBe(CURSOR_MODEL_ID)
    expect(result.text).toBe('hello')
  })
})
