import { describe, expect, it, vi } from 'vitest'
import { AgentError } from '../../shared/agent/errors'
import { CURSOR_MODEL_ID } from '../../shared/agent/modelConfig'
import { createCursorSdkAgent } from './cursorSdkClient'

describe('createCursorSdkAgent success path', () => {
  it('returns finished text and converts billed cents to USD', async () => {
    const getUsage = vi.fn(async () => ({
      usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
      cost: { totalCents: 250 }
    }))
    const port = createCursorSdkAgent({
      apiKey: 'k',
      modelId: CURSOR_MODEL_ID,
      createAgent: async () => ({
        send: async () => ({
          wait: async () => ({ status: 'finished' as const, result: 'ok' })
        }),
        getUsage
      })
    })
    const result = await port.runPrompt({
      stage: 'kickoff',
      system: 's',
      user: 'u',
      factoryId: 'f',
      sessionId: 's'
    })
    expect(result.text).toBe('ok')
    expect(result.usage?.costUsd).toBe(2.5)
    expect(result.usage?.totalTokens).toBe(7)
  })
})

describe('createCursorSdkAgent error status', () => {
  it('throws SdkError when run status is not finished', async () => {
    const port = createCursorSdkAgent({
      apiKey: 'k',
      modelId: CURSOR_MODEL_ID,
      createAgent: async () => ({
        send: async () => ({
          wait: async () => ({
            status: 'error' as const,
            error: { message: 'boom', code: 'X' }
          })
        })
      })
    })
    await expect(
      port.runPrompt({
        stage: 'research',
        system: 's',
        user: 'u',
        factoryId: 'f',
        sessionId: 's'
      })
    ).rejects.toMatchObject({ kind: 'SdkError', message: 'boom' } satisfies Partial<AgentError>)
  })
})

describe('createCursorSdkAgent usage fallbacks', () => {
  it('falls back to run usage when getUsage throws', async () => {
    const port = createCursorSdkAgent({
      apiKey: 'k',
      modelId: CURSOR_MODEL_ID,
      createAgent: async () => ({
        send: async () => ({
          wait: async () => ({
            status: 'finished' as const,
            result: 't',
            usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
          })
        }),
        getUsage: async () => {
          throw new Error('billing unavailable')
        }
      })
    })
    const result = await port.runPrompt({
      stage: 'lessons',
      system: 's',
      user: 'u',
      factoryId: 'f',
      sessionId: 's'
    })
    expect(result.usage).toEqual({
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      costUsd: null
    })
  })
})

describe('createCursorSdkAgent null usage and wrap', () => {
  it('returns null usage when neither billed nor run usage exists', async () => {
    const port = createCursorSdkAgent({
      apiKey: 'k',
      modelId: CURSOR_MODEL_ID,
      createAgent: async () => ({
        send: async () => ({
          wait: async () => ({ status: 'finished' as const, result: '' })
        })
      })
    })
    const result = await port.runPrompt({
      stage: 'kickoff',
      system: 's',
      user: 'u',
      factoryId: 'f',
      sessionId: 's'
    })
    expect(result.usage).toBeNull()
  })

  it('wraps unexpected create errors as SdkError', async () => {
    const port = createCursorSdkAgent({
      apiKey: 'k',
      modelId: CURSOR_MODEL_ID,
      createAgent: async () => {
        throw new Error('network down')
      }
    })
    await expect(
      port.runPrompt({
        stage: 'kickoff',
        system: 's',
        user: 'u',
        factoryId: 'f',
        sessionId: 's'
      })
    ).rejects.toMatchObject({ kind: 'SdkError', message: 'network down' } satisfies Partial<AgentError>)
  })
})
