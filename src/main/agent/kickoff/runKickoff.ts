import { AgentError } from '../../../shared/agent/errors'
import type { AgentPort } from '../../../shared/engine/ports'
import { KICKOFF_COMPRESS_USER_SUFFIX, KICKOFF_SYSTEM_PROMPT } from './prompts'
import {
  type KickoffArtifact,
  parseKickoffArtifact,
  safeParseKickoffArtifact
} from './schema'
import { classifyKickoffWordBudget } from './wordBudget'

export interface RunKickoffResult {
  artifact: KickoffArtifact
  artifactJson: string
  usage: Awaited<ReturnType<AgentPort['runPrompt']>>['usage']
  compressRetried: boolean
}

type InvokeResult = {
  rawText: string
  artifact: KickoffArtifact | null
  schemaError: string | undefined
  usage: RunKickoffResult['usage']
}

export async function runKickoff(opts: {
  agent: AgentPort
  factoryId: string
  sessionId: string
  userPacket: string
}): Promise<RunKickoffResult> {
  const first = await invokeKickoff(opts, opts.userPacket)
  if (first.artifact && classifyKickoffWordBudget(first.rawText).status === 'ok') {
    return finalize(first.artifact, first.usage, false)
  }

  const second = await invokeKickoff(
    opts,
    `${opts.userPacket}\n\n${KICKOFF_COMPRESS_USER_SUFFIX}\nPrior draft:\n${first.rawText}`
  )
  const secondBudget = classifyKickoffWordBudget(second.rawText)
  if (!second.artifact || secondBudget.status === 'hard') {
    throw new AgentError(
      second.artifact ? 'BudgetExceeded' : 'SchemaInvalid',
      second.artifact
        ? `Kickoff exceeded hard word budget (${secondBudget.words}) after compress retry`
        : (second.schemaError ?? 'Kickoff schema invalid after compress retry'),
      {
        infraSkip: false,
        details: {
          words: secondBudget.words,
          schemaError: second.schemaError
        }
      }
    )
  }
  return finalize(second.artifact, second.usage, true)
}

function finalize(
  artifact: KickoffArtifact,
  usage: RunKickoffResult['usage'],
  compressRetried: boolean
): RunKickoffResult {
  return {
    artifact,
    artifactJson: JSON.stringify(artifact),
    usage,
    compressRetried
  }
}

async function invokeKickoff(
  opts: { agent: AgentPort; factoryId: string; sessionId: string },
  user: string
): Promise<InvokeResult> {
  const result = await opts.agent.runPrompt({
    stage: 'kickoff',
    system: KICKOFF_SYSTEM_PROMPT,
    user,
    factoryId: opts.factoryId,
    sessionId: opts.sessionId
  })
  return parseKickoffResponse(result.text, result.usage)
}

function parseKickoffResponse(
  text: string,
  usage: RunKickoffResult['usage']
): InvokeResult {
  const rawText = extractJsonObject(text)
  if (!rawText) {
    return invalidKickoff(text, usage, 'Kickoff response was not valid JSON')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText) as unknown
  } catch {
    return invalidKickoff(rawText, usage, 'Kickoff response was not valid JSON')
  }
  const safe = safeParseKickoffArtifact(parsed)
  if (!safe.success) {
    return invalidKickoff(rawText, usage, safe.error.message)
  }
  return {
    rawText,
    artifact: parseKickoffArtifact(safe.data),
    schemaError: undefined,
    usage
  }
}

function invalidKickoff(
  rawText: string,
  usage: RunKickoffResult['usage'],
  schemaError: string
): InvokeResult {
  return { rawText, artifact: null, schemaError, usage }
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) {
    return null
  }
  return text.slice(start, end + 1)
}
