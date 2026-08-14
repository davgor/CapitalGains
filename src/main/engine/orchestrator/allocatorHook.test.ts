import { allocateByEvidence } from '../../../shared/engine/allocator'
import { describe, expect, it } from 'vitest'
import type { Factory } from '../../../shared/engine/types'

describe('orchestrator allocator hook', () => {
  it('produces per-factory cash piles that sum to Daily Limit for Purchases', () => {
    const factories: Factory[] = [
      {
        id: 'c',
        name: 'Control',
        role: 'Control',
        evidenceWeight: 1,
        createdAt: 't',
        queuedNextOpen: false,
        lineageParentId: null
      },
      {
        id: 'e',
        name: 'E',
        role: 'Explorer',
        evidenceWeight: 3,
        createdAt: 't',
        queuedNextOpen: false,
        lineageParentId: null
      },
      {
        id: 'k',
        name: 'K',
        role: 'Killed',
        evidenceWeight: 9,
        createdAt: 't',
        queuedNextOpen: false,
        lineageParentId: null
      }
    ]
    const { piles } = allocateByEvidence({
      factories,
      dailyLimitUsd: 4_000,
      controlFloorWeight: 1,
      explorationAllotmentUsd: 100
    })
    expect(piles['k']).toBe(0)
    expect((piles['c'] ?? 0) + (piles['e'] ?? 0)).toBeCloseTo(4_000, 6)
  })
})
