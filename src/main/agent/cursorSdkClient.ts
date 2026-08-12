import { AgentError } from '../../shared/agent/errors'
import type { CursorModelId } from '../../shared/agent/modelConfig'
import type { AgentPromptResult, AgentUsageSnapshot } from '../../shared/agent/types'
import type { AgentPort } from '../../shared/engine/ports'

interface SdkRunUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

interface SdkWaitResult {
  status: 'finished' | 'error' | 'cancelled'
  result?: string
  error?: { message: string; code?: string }
  usage?: SdkRunUsage
}

interface SdkAgentHandle {
  send: (message: string) => Promise<{ wait: () => Promise<SdkWaitResult> }>
  getUsage?: () => Promise<{
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
    cost?: { totalCents?: number } | null
  }>
}

export type CreateCursorAgent = (options: {
  apiKey: string
  model: { id: string }
  cloud: { repos: [] }
}) => Promise<SdkAgentHandle>

export function createCursorSdkAgent(opts: {
  apiKey: string
  modelId: CursorModelId
  createAgent?: CreateCursorAgent
}): AgentPort {
  return {
    runPrompt: async (req) => {
      try {
        const create = opts.createAgent ?? (await loadSdkCreate())
        const agent = await create({
          apiKey: opts.apiKey,
          model: { id: opts.modelId },
          cloud: { repos: [] }
        })
        const prompt = `${req.system}\n\n${req.user}`
        const run = await agent.send(prompt)
        const waited = await run.wait()
        if (waited.status !== 'finished') {
          throw new AgentError('SdkError', waited.error?.message ?? `agent run ${waited.status}`, {
            infraSkip: true,
            details: { code: waited.error?.code, stage: req.stage }
          })
        }
        const usage = await resolveUsage(agent, waited.usage)
        const result: AgentPromptResult = {
          text: waited.result ?? '',
          usage,
          modelId: opts.modelId
        }
        return result
      } catch (err) {
        if (err instanceof AgentError) {
          throw err
        }
        throw new AgentError('SdkError', err instanceof Error ? err.message : 'SDK failure', {
          infraSkip: true,
          cause: err,
          details: { stage: req.stage }
        })
      }
    }
  }
}

async function loadSdkCreate(): Promise<CreateCursorAgent> {
  const mod = (await import('@cursor/sdk')) as { Agent: { create: CreateCursorAgent } }
  return mod.Agent.create.bind(mod.Agent) as CreateCursorAgent
}

async function resolveUsage(
  agent: SdkAgentHandle,
  runUsage: SdkRunUsage | undefined
): Promise<AgentUsageSnapshot | null> {
  if (typeof agent.getUsage === 'function') {
    try {
      const billed = await agent.getUsage()
      return {
        inputTokens: billed.usage?.inputTokens ?? runUsage?.inputTokens ?? null,
        outputTokens: billed.usage?.outputTokens ?? runUsage?.outputTokens ?? null,
        totalTokens: billed.usage?.totalTokens ?? runUsage?.totalTokens ?? null,
        costUsd:
          billed.cost?.totalCents === undefined || billed.cost?.totalCents === null
            ? null
            : billed.cost.totalCents / 100
      }
    } catch {
      // fall through to run usage
    }
  }
  if (!runUsage) {
    return null
  }
  return {
    inputTokens: runUsage.inputTokens,
    outputTokens: runUsage.outputTokens,
    totalTokens: runUsage.totalTokens,
    costUsd: null
  }
}
