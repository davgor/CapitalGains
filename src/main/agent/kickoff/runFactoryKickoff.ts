import { AgentError } from '../../../shared/agent/errors'
import type { AgentPort } from '../../../shared/engine/ports'
import {
  assertExplorerDiversity,
  serializeKickoffPacket,
  type DiversityMode,
  type KickoffInputPacket
} from './assemblePacket'
import { loadControlFrozenKickoff, shouldRunKickoffAgent } from './controlFrozen'
import type { KickoffArtifact } from './schema'
import { hypothesisKey } from './assemblePacket'
import { runKickoff, type RunKickoffResult } from './runKickoff'
import type { FactoryRole } from '../../../shared/engine/types'

export async function runFactoryKickoff(opts: {
  agent: AgentPort
  role: FactoryRole
  factoryId: string
  sessionId: string
  packet: KickoffInputPacket
  frozenStore: { getConfig<T>(key: string): T | undefined }
  siblingHypotheses: string[]
  diversityMode: DiversityMode
}): Promise<RunKickoffResult & { fromFrozen: boolean }> {
  if (!shouldRunKickoffAgent(opts.role)) {
    const artifact = loadControlFrozenKickoff(opts.frozenStore)
    return {
      artifact,
      artifactJson: JSON.stringify(artifact),
      usage: null,
      compressRetried: false,
      fromFrozen: true
    }
  }

  const userPacket = serializeKickoffPacket(opts.packet)
  const first = await runKickoff({
    agent: opts.agent,
    factoryId: opts.factoryId,
    sessionId: opts.sessionId,
    userPacket
  })
  const check = assertExplorerDiversity({
    mode: opts.diversityMode,
    candidate: first.artifact,
    siblingHypotheses: opts.siblingHypotheses
  })
  if (check.ok) {
    return { ...first, fromFrozen: false }
  }

  const retryPacket = {
    ...opts.packet,
    siblingExclusions: [...opts.packet.siblingExclusions, check.collision]
  }
  const second = await runKickoff({
    agent: opts.agent,
    factoryId: opts.factoryId,
    sessionId: opts.sessionId,
    userPacket: `${serializeKickoffPacket(retryPacket)}\n\nDIVERSITY RETRY: hypothesis collided with "${check.collision}". Emit a distinct hypothesis_tested.`
  })
  const secondCheck = assertExplorerDiversity({
    mode: opts.diversityMode,
    candidate: second.artifact,
    siblingHypotheses: opts.siblingHypotheses
  })
  if (!secondCheck.ok) {
    throw new AgentError(
      'DiversityCollision',
      `Explorer hypothesis collided after retry: ${secondCheck.collision}`,
      { infraSkip: false, details: { collision: secondCheck.collision } }
    )
  }
  return { ...second, fromFrozen: false }
}

export function collectSiblingHypotheses(artifacts: KickoffArtifact[]): string[] {
  return artifacts.map(hypothesisKey)
}
