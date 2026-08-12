import { AgentError } from '../../shared/agent/errors'
import {
  CURSOR_MODEL_ID,
  resolveCursorApiKey,
  type CursorModelId
} from '../../shared/agent/modelConfig'
import type { AgentPromptRequest, AgentPromptResult, AgentUsageSnapshot } from '../../shared/agent/types'
import type { AgentPort } from '../../shared/engine/ports'
import { createCursorSdkAgent, type CreateCursorAgent } from './cursorSdkClient'

export interface MockAgentPortOptions {
  text?: string
  usage?: AgentUsageSnapshot | null
  modelId?: CursorModelId
  handler?: (req: AgentPromptRequest) => Promise<AgentPromptResult> | AgentPromptResult
}

export function createMockAgentPort(opts: MockAgentPortOptions = {}): AgentPort {
  return {
    runPrompt: async (req) => {
      if (opts.handler) {
        return opts.handler(req)
      }
      return {
        text: opts.text ?? '',
        usage: opts.usage === undefined ? null : opts.usage,
        modelId: opts.modelId ?? CURSOR_MODEL_ID
      }
    }
  }
}

export interface CreateAgentPortOptions {
  /** Explicit key; when omitted, reads CURSOR_API_KEY from env. */
  apiKey?: string | undefined
  env?: NodeJS.ProcessEnv
  /** Injected mock for tests — never hits the network. */
  mock?: AgentPort
  /** Injectable SDK create for unit tests of the production path. */
  createAgent?: CreateCursorAgent
  modelId?: CursorModelId
}

export function createAgentPort(opts: CreateAgentPortOptions = {}): AgentPort {
  if (opts.mock) {
    return opts.mock
  }
  const key =
    opts.apiKey !== undefined ? trimOrUndefined(opts.apiKey) : resolveCursorApiKey(opts.env)
  if (!key) {
    return createMissingKeyAgent()
  }
  return createCursorSdkAgent({
    apiKey: key,
    modelId: opts.modelId ?? CURSOR_MODEL_ID,
    createAgent: opts.createAgent
  })
}

function createMissingKeyAgent(): AgentPort {
  return {
    runPrompt: async () => {
      throw new AgentError(
        'MissingApiKey',
        'CURSOR_API_KEY is missing; Kickoff/Research/Lessons cannot run',
        { infraSkip: true }
      )
    }
  }
}

function trimOrUndefined(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}
