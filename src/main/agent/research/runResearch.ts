import { AgentError } from '../../../shared/agent/errors'
import type { ResearchPlan } from '../../../shared/engine/types'
import type { AgentPort } from '../../../shared/engine/ports'
import { RESEARCH_SYSTEM_PROMPT } from './prompts'
import { parseResearchPlan, safeParseResearchPlan, type ResearchAgentPlan } from './schema'

export interface RunResearchResult {
  plan: ResearchPlan
  artifactJson: string
  usage: Awaited<ReturnType<AgentPort['runPrompt']>>['usage']
  schemaRetried: boolean
}

export async function runResearch(opts: {
  agent: AgentPort
  factoryId: string
  sessionId: string
  kickoffJson: string
  tapeSymbols: string[]
  tapeSummary: string
}): Promise<RunResearchResult> {
  const user = buildResearchUser(opts)
  const first = await invokeResearch(opts, user)
  if (first.plan) {
    assertOnTape(first.plan, opts.tapeSymbols)
    return finalize(first.plan, first.usage, false)
  }
  const second = await invokeResearch(
    opts,
    `${user}\n\nSCHEMA RETRY: prior output failed validation (${first.schemaError}). Return valid JSON only.`
  )
  if (!second.plan) {
    throw new AgentError('SchemaInvalid', second.schemaError ?? 'Research schema invalid after retry', {
      infraSkip: false,
      details: { schemaError: second.schemaError }
    })
  }
  assertOnTape(second.plan, opts.tapeSymbols)
  return finalize(second.plan, second.usage, true)
}

function finalize(
  plan: ResearchAgentPlan,
  usage: RunResearchResult['usage'],
  schemaRetried: boolean
): RunResearchResult {
  const researchPlan: ResearchPlan = {
    sitOut: plan.sitOut,
    allocations: plan.allocations,
    stopLossPercent: plan.stopLossPercent
  }
  return {
    plan: researchPlan,
    artifactJson: JSON.stringify(researchPlan),
    usage,
    schemaRetried
  }
}

function assertOnTape(plan: ResearchAgentPlan, tapeSymbols: string[]): void {
  if (plan.sitOut) {
    return
  }
  const onTape = new Set(tapeSymbols)
  const off = plan.allocations.filter((a) => !onTape.has(a.symbol)).map((a) => a.symbol)
  if (off.length > 0) {
    throw new AgentError('OffTapeSymbol', `off-tape symbols: ${off.join(',')}`, {
      infraSkip: false,
      details: { symbols: off }
    })
  }
}

async function invokeResearch(
  opts: { agent: AgentPort; factoryId: string; sessionId: string },
  user: string
): Promise<{
  plan: ResearchAgentPlan | null
  schemaError: string | undefined
  usage: RunResearchResult['usage']
}> {
  const result = await opts.agent.runPrompt({
    stage: 'research',
    system: RESEARCH_SYSTEM_PROMPT,
    user,
    factoryId: opts.factoryId,
    sessionId: opts.sessionId
  })
  const rawText = extractJsonObject(result.text) ?? result.text
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText) as unknown
  } catch {
    return {
      plan: null,
      schemaError: 'Research response was not valid JSON',
      usage: result.usage
    }
  }
  const safe = safeParseResearchPlan(parsed)
  if (!safe.success) {
    return { plan: null, schemaError: safe.error.message, usage: result.usage }
  }
  return { plan: parseResearchPlan(safe.data), schemaError: undefined, usage: result.usage }
}

function buildResearchUser(opts: {
  kickoffJson: string
  tapeSymbols: string[]
  tapeSummary: string
}): string {
  return [
    'Kickoff JSON:',
    opts.kickoffJson,
    '',
    `Tape symbols (closed set): ${opts.tapeSymbols.join(', ')}`,
    'Tape summary:',
    opts.tapeSummary
  ].join('\n')
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) {
    return null
  }
  return text.slice(start, end + 1)
}
