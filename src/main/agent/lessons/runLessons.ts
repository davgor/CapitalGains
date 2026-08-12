import { AgentError } from '../../../shared/agent/errors'
import type { AgentPort } from '../../../shared/engine/ports'
import type { FactoryRole } from '../../../shared/engine/types'
import { LESSONS_SYSTEM_PROMPT } from './prompts'
import {
  lessonsInputSchema,
  parseLessonsOutput,
  safeParseLessonsOutput,
  type LessonsInputPacket,
  type LessonsOutput
} from './schema'

export interface RunLessonsResult {
  output: LessonsOutput
  artifactJson: string
  usage: Awaited<ReturnType<AgentPort['runPrompt']>>['usage']
  skippedAgent: boolean
}

export async function runLessons(opts: {
  agent: AgentPort
  factoryId: string
  sessionId: string
  role: FactoryRole
  packet: LessonsInputPacket
}): Promise<RunLessonsResult> {
  const packet = lessonsInputSchema.parse(opts.packet)
  if (packet.infraSkip) {
    const output: LessonsOutput = {
      failureMode: 'infra_skip',
      winLossFactor: 'operational_skip',
      suggestedSeed: 'n/a',
      excludeFromPromote: true
    }
    return {
      output,
      artifactJson: JSON.stringify(output),
      usage: null,
      skippedAgent: true
    }
  }
  const result = await opts.agent.runPrompt({
    stage: 'lessons',
    system: LESSONS_SYSTEM_PROMPT,
    user: JSON.stringify(packet),
    factoryId: opts.factoryId,
    sessionId: opts.sessionId
  })
  const rawText = extractJsonObject(result.text) ?? result.text
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText) as unknown
  } catch {
    throw new AgentError('SchemaInvalid', 'Lessons response was not valid JSON', {
      infraSkip: false
    })
  }
  const safe = safeParseLessonsOutput(parsed)
  if (!safe.success) {
    throw new AgentError('SchemaInvalid', safe.error.message, { infraSkip: false })
  }
  const output = parseLessonsOutput(safe.data)
  return {
    output,
    artifactJson: JSON.stringify(output),
    usage: result.usage,
    skippedAgent: false
  }
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) {
    return null
  }
  return text.slice(start, end + 1)
}
