import { AgentError } from '../../../shared/agent/errors'
import type { AgentPort } from '../../../shared/engine/ports'
import type { FactoryRole } from '../../../shared/engine/types'
import {
  assertExplorerDiversity,
  hypothesisKey,
  serializeKickoffPacket,
  type DiversityMode,
  type KickoffInputPacket
} from './assemblePacket'
import { loadControlFrozenKickoff, shouldRunKickoffAgent } from './controlFrozen'
import type { KickoffArtifact } from './schema'
import { runKickoff, type RunKickoffResult } from './runKickoff'

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
    return frozenKickoffResult(opts.frozenStore)
  }
  const first = await runKickoff({
    agent: opts.agent,
    factoryId: opts.factoryId,
    sessionId: opts.sessionId,
    userPacket: serializeKickoffPacket(opts.packet)
  })
  const firstCheck = assertExplorerDiversity({
    mode: opts.diversityMode,
    candidate: first.artifact,
    siblingHypotheses: opts.siblingHypotheses
  })
  if (firstCheck.ok) {
    return { ...first, fromFrozen: false }
  }
  return retryKickoffForDiversity(opts, firstCheck.collision)
}

export function collectSiblingHypotheses(artifacts: KickoffArtifact[]): string[] {
  return artifacts.map(hypothesisKey)
}

function frozenKickoffResult(
  frozenStore: { getConfig<T>(key: string): T | undefined }
): RunKickoffResult & { fromFrozen: boolean } {
  const artifact = loadControlFrozenKickoff(frozenStore)
  return {
    artifact,
    artifactJson: JSON.stringify(artifact),
    usage: null,
    compressRetried: false,
    fromFrozen: true
  }
}

async function retryKickoffForDiversity(
  opts: {
    agent: AgentPort
    factoryId: string
    sessionId: string
    packet: KickoffInputPacket
    siblingHypotheses: string[]
    diversityMode: DiversityMode
  },
  collision: string
): Promise<RunKickoffResult & { fromFrozen: boolean }> {
  const retryPacket = {
    ...opts.packet,
    siblingExclusions: [...opts.packet.siblingExclusions, collision]
  }
  const second = await runKickoff({
    agent: opts.agent,
    factoryId: opts.factoryId,
    sessionId: opts.sessionId,
    userPacket: `${serializeKickoffPacket(retryPacket)}\n\nDIVERSITY RETRY: hypothesis collided with "${collision}". Emit a distinct hypothesis_tested.`
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
