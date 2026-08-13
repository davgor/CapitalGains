import type { Factory } from './types'

export interface AllocateByEvidenceInput {
  factories: Factory[]
  dailyLimitUsd: number
  /** Minimum effective weight for Control (configurable floor). */
  controlFloorWeight: number
  /** Fixed cash for explorers with evidenceWeight <= 0 (unscored). */
  explorationAllotmentUsd: number
}

export interface AllocateByEvidenceResult {
  piles: Record<string, number>
  effectiveWeights: Record<string, number>
}

/**
 * Split global Daily Limit across factories by evidence weights.
 * Killed and queued factories get 0. Control gets at least `controlFloorWeight`.
 * Unscored explorers (weight <= 0) take a fixed exploration allotment from the pot first.
 */
export function allocateByEvidence(input: AllocateByEvidenceInput): AllocateByEvidenceResult {
  const piles: Record<string, number> = {}
  const effectiveWeights: Record<string, number> = {}
  const eligible: Factory[] = []

  for (const f of input.factories) {
    if (f.role === 'Killed' || f.queuedNextOpen) {
      piles[f.id] = 0
      effectiveWeights[f.id] = 0
      continue
    }
    eligible.push(f)
  }

  let remaining = input.dailyLimitUsd
  const weighted: Factory[] = []

  for (const f of eligible) {
    if (f.role === 'Explorer' && f.evidenceWeight <= 0) {
      const allotment = Math.min(input.explorationAllotmentUsd, Math.max(0, remaining))
      piles[f.id] = allotment
      effectiveWeights[f.id] = 0
      remaining -= allotment
    } else {
      weighted.push(f)
    }
  }

  let weightSum = 0
  for (const f of weighted) {
    const w =
      f.role === 'Control'
        ? Math.max(f.evidenceWeight, input.controlFloorWeight)
        : Math.max(0, f.evidenceWeight)
    effectiveWeights[f.id] = w
    weightSum += w
  }

  if (weighted.length === 0) {
    return { piles, effectiveWeights }
  }

  if (weightSum <= 0) {
    const each = remaining / weighted.length
    for (const f of weighted) {
      piles[f.id] = each
    }
    return { piles, effectiveWeights }
  }

  let assigned = 0
  for (let i = 0; i < weighted.length; i++) {
    const f = weighted[i]!
    const w = effectiveWeights[f.id]!
    if (i === weighted.length - 1) {
      piles[f.id] = remaining - assigned
    } else {
      const pile = (remaining * w) / weightSum
      piles[f.id] = pile
      assigned += pile
    }
  }

  return { piles, effectiveWeights }
}
