import type { FeatureRow, FactoryRole } from '../../../shared/engine/types'
import type { LessonEntry } from '../lessons/schema'
import { summarizeLessonsForKickoff } from '../lessons/pool'
import type { KickoffArtifact } from './schema'

export type DiversityMode = 'explore' | 'exploit'

export interface KickoffInputPacket {
  regimeSummary: string
  globalLessons: ReturnType<typeof summarizeLessonsForKickoff>
  ownRecap: string
  tapeSummary: string
  siblingExclusions: string[]
  diversityMode: DiversityMode
  factoryRole: FactoryRole
}

export function assembleKickoffInputPacket(opts: {
  regimeSummary: string
  lessons: LessonEntry[]
  ownRecap: string
  tape: FeatureRow[]
  siblingHypotheses: string[]
  diversityMode: DiversityMode
  factoryRole: FactoryRole
}): KickoffInputPacket {
  return {
    regimeSummary: opts.regimeSummary,
    globalLessons: summarizeLessonsForKickoff(opts.lessons),
    ownRecap: opts.ownRecap,
    tapeSummary: serializeTapeSummary(opts.tape),
    siblingExclusions: opts.siblingHypotheses,
    diversityMode: opts.diversityMode,
    factoryRole: opts.factoryRole
  }
}

export function serializeKickoffPacket(packet: KickoffInputPacket): string {
  return JSON.stringify(packet, null, 2)
}

export function serializeTapeSummary(tape: FeatureRow[]): string {
  return tape
    .map(
      (t) =>
        `${t.symbol}|${t.sector}|px=${t.price}|gap=${t.premarketGapPct}|rvol=${t.rvol}`
    )
    .join('\n')
}

export function hypothesisKey(artifact: KickoffArtifact): string {
  const raw = artifact.hypothesis_tested ?? artifact.hypothesis
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Explore mode: distinct hypothesis_tested among explorers.
 * Exploit mode: diversity requirement disabled (hook for 009 promote).
 */
export function assertExplorerDiversity(opts: {
  mode: DiversityMode
  candidate: KickoffArtifact
  siblingHypotheses: string[]
}): { ok: true } | { ok: false; collision: string } {
  if (opts.mode === 'exploit') {
    return { ok: true }
  }
  const key = hypothesisKey(opts.candidate)
  const siblings = new Set(opts.siblingHypotheses.map((h) => h.trim().toLowerCase().replace(/\s+/g, ' ')))
  if (siblings.has(key)) {
    return { ok: false, collision: key }
  }
  return { ok: true }
}
