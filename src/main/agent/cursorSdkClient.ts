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
        return await executePrompt(opts, req.system, req.user, req.stage)
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

async function executePrompt(
  opts: { apiKey: string; modelId: CursorModelId; createAgent?: CreateCursorAgent },
  system: string,
  user: string,
  stage: string
): Promise<AgentPromptResult> {
  const create = opts.createAgent ?? (await loadSdkCreate())
  const agent = await create({
    apiKey: opts.apiKey,
    model: { id: opts.modelId },
    cloud: { repos: [] }
  })
  const run = await agent.send(`${system}\n\n${user}`)
  const waited = await run.wait()
  if (waited.status !== 'finished') {
    throw new AgentError('SdkError', waited.error?.message ?? `agent run ${waited.status}`, {
      infraSkip: true,
      details: { code: waited.error?.code, stage }
    })
  }
  return {
    text: waited.result ?? '',
    usage: await resolveUsage(agent, waited.usage),
    modelId: opts.modelId
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
  const billed = await tryGetBilledUsage(agent)
  if (billed) {
    return billed
  }
  return snapshotFromRunUsage(runUsage)
}

async function tryGetBilledUsage(agent: SdkAgentHandle): Promise<AgentUsageSnapshot | null> {
  if (typeof agent.getUsage !== 'function') {
    return null
  }
  try {
    const billed = await agent.getUsage()
    return {
      inputTokens: billed.usage?.inputTokens ?? null,
      outputTokens: billed.usage?.outputTokens ?? null,
      totalTokens: billed.usage?.totalTokens ?? null,
      costUsd: centsToUsd(billed.cost?.totalCents)
    }
  } catch {
    return null
  }
}

function snapshotFromRunUsage(runUsage: SdkRunUsage | undefined): AgentUsageSnapshot | null {
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

function centsToUsd(totalCents: number | null | undefined): number | null {
  if (totalCents === undefined || totalCents === null) {
    return null
  }
  return totalCents / 100
}
