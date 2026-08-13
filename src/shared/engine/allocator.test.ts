import { describe, expect, it } from 'vitest'
import { allocateByEvidence } from './allocator'
import type { Factory } from './types'

function factory(
  partial: Pick<Factory, 'id' | 'name' | 'role' | 'evidenceWeight'> &
    Partial<Pick<Factory, 'queuedNextOpen' | 'lineageParentId' | 'createdAt'>>
): Factory {
  return {
    createdAt: '2024-06-03T12:00:00.000Z',
    queuedNextOpen: false,
    lineageParentId: null,
    ...partial
  }
}

const defaultInput = {
  dailyLimitUsd: 10_000,
  controlFloorWeight: 1,
  explorationAllotmentUsd: 500
}

describe('allocateByEvidence daily limit split', () => {
  it('splits Daily Limit so piles sum to the limit', () => {
    const factories = [
      factory({ id: 'c', name: 'Control', role: 'Control', evidenceWeight: 2 }),
      factory({ id: 'a', name: 'A', role: 'Explorer', evidenceWeight: 1 }),
      factory({ id: 'b', name: 'B', role: 'Promoted', evidenceWeight: 3 })
    ]
    const result = allocateByEvidence({ factories, ...defaultInput })
    const sum = Object.values(result.piles).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(10_000, 6)
    expect(result.piles['c']).toBeGreaterThan(0)
    expect(result.piles['a']).toBeGreaterThan(0)
    expect(result.piles['b']).toBeGreaterThan(0)
  })
})

describe('allocateByEvidence killed factories', () => {
  it('gives killed factories zero and redistributes to others', () => {
    const factories = [
      factory({ id: 'c', name: 'Control', role: 'Control', evidenceWeight: 1 }),
      factory({ id: 'k', name: 'Dead', role: 'Killed', evidenceWeight: 99 }),
      factory({ id: 'e', name: 'E', role: 'Explorer', evidenceWeight: 1 })
    ]
    const result = allocateByEvidence({
      factories,
      dailyLimitUsd: 1_000,
      controlFloorWeight: 1,
      explorationAllotmentUsd: 100
    })
    expect(result.piles['k']).toBe(0)
    expect(result.piles['c']! + result.piles['e']!).toBeCloseTo(1_000, 6)
  })
})

describe('allocateByEvidence control floor', () => {
  it('applies control floor weight even when stored weight is lower', () => {
    const factories = [
      factory({ id: 'c', name: 'Control', role: 'Control', evidenceWeight: 0.1 }),
      factory({ id: 'p', name: 'P', role: 'Promoted', evidenceWeight: 10 })
    ]
    const result = allocateByEvidence({
      factories,
      dailyLimitUsd: 1_100,
      controlFloorWeight: 1,
      explorationAllotmentUsd: 0
    })
    expect(result.effectiveWeights['c']).toBe(1)
    expect(result.piles['c']).toBeCloseTo(100, 4)
    expect(result.piles['p']).toBeCloseTo(1_000, 4)
  })
})

describe('allocateByEvidence exploration allotment', () => {
  it('gives unscored explorers the exploration allotment until weight is scored', () => {
    const factories = [
      factory({ id: 'c', name: 'Control', role: 'Control', evidenceWeight: 1 }),
      factory({ id: 'n', name: 'New', role: 'Explorer', evidenceWeight: 0 })
    ]
    const result = allocateByEvidence({
      factories,
      dailyLimitUsd: 2_000,
      controlFloorWeight: 1,
      explorationAllotmentUsd: 250
    })
    expect(result.piles['n']).toBe(250)
    expect(result.piles['c']).toBe(1_750)
  })
})

describe('allocateByEvidence queue eligibility', () => {
  it('skips factories queued until next open', () => {
    const factories = [
      factory({ id: 'c', name: 'Control', role: 'Control', evidenceWeight: 1 }),
      factory({
        id: 'q',
        name: 'Late',
        role: 'Explorer',
        evidenceWeight: 5,
        queuedNextOpen: true
      })
    ]
    const result = allocateByEvidence({
      factories,
      dailyLimitUsd: 1_000,
      controlFloorWeight: 1,
      explorationAllotmentUsd: 100
    })
    expect(result.piles['q']).toBe(0)
    expect(result.piles['c']).toBe(1_000)
  })
})
