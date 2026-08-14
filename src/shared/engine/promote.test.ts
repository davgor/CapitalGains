import { describe, expect, it } from 'vitest'
import { evaluatePromoteKill, type FactorySessionStats } from './promote'

const thresholds = {
  minSessionsExInfra: 3,
  minNetExcessVsSpy: 0.01,
  minNetExcessVsControl: 0.005,
  maxDrawdown: 0.08
}

function stats(partial: Partial<FactorySessionStats> & Pick<FactorySessionStats, 'factoryId'>): FactorySessionStats {
  return {
    role: 'Explorer',
    sessionsExInfra: 5,
    avgNetExcessVsSpy: 0.02,
    avgNetExcessVsControl: 0.01,
    maxDrawdown: 0.03,
    ...partial
  }
}

describe('evaluatePromoteKill promote', () => {
  it('recommends promote when thresholds met', () => {
    const result = evaluatePromoteKill({
      factories: [stats({ factoryId: 'e1' })],
      thresholds
    })
    expect(result.find((r) => r.factoryId === 'e1')?.action).toBe('promote')
  })
})

describe('evaluatePromoteKill session counts', () => {
  it('excludes infra_skip days from session counts', () => {
    const result = evaluatePromoteKill({
      factories: [
        stats({
          factoryId: 'e2',
          sessionsExInfra: 2,
          avgNetExcessVsSpy: 0.05,
          avgNetExcessVsControl: 0.05
        })
      ],
      thresholds
    })
    expect(result.find((r) => r.factoryId === 'e2')?.action).toBe('hold')
    expect(result.find((r) => r.factoryId === 'e2')?.reason).toMatch(/sessions/i)
  })
})

describe('evaluatePromoteKill kill', () => {
  it('recommends kill on excessive drawdown', () => {
    const result = evaluatePromoteKill({
      factories: [
        stats({
          factoryId: 'e3',
          maxDrawdown: 0.2,
          avgNetExcessVsSpy: 0.02,
          avgNetExcessVsControl: 0.01
        })
      ],
      thresholds
    })
    expect(result.find((r) => r.factoryId === 'e3')?.action).toBe('kill')
  })
})

describe('evaluatePromoteKill control protection', () => {
  it('never auto-kills or promotes Control', () => {
    const result = evaluatePromoteKill({
      factories: [
        stats({
          factoryId: 'c',
          role: 'Control',
          maxDrawdown: 0.5,
          avgNetExcessVsSpy: 0.1,
          avgNetExcessVsControl: 0
        })
      ],
      thresholds
    })
    expect(result.find((r) => r.factoryId === 'c')?.action).toBe('hold')
  })
})

describe('evaluatePromoteKill killed factories', () => {
  it('skips already killed factories', () => {
    const result = evaluatePromoteKill({
      factories: [stats({ factoryId: 'k', role: 'Killed' })],
      thresholds
    })
    expect(result.find((r) => r.factoryId === 'k')?.action).toBe('hold')
  })
})

describe('evaluatePromoteKill threshold boundaries', () => {
  it('promotes when sessions and both excess values equal their minimums', () => {
    const result = evaluatePromoteKill({
      factories: [
        stats({
          factoryId: 'boundary',
          sessionsExInfra: 3,
          avgNetExcessVsSpy: 0.01,
          avgNetExcessVsControl: 0.005,
          maxDrawdown: 0.08
        })
      ],
      thresholds
    })

    expect(result[0]).toEqual({
      factoryId: 'boundary',
      action: 'promote',
      reason: 'thresholds met'
    })
  })

  it('holds when either excess value is below its minimum', () => {
    const result = evaluatePromoteKill({
      factories: [
        stats({ factoryId: 'spy-low', avgNetExcessVsSpy: 0.009 }),
        stats({ factoryId: 'control-low', avgNetExcessVsControl: 0.004 })
      ],
      thresholds
    })

    expect(result).toEqual([
      { factoryId: 'spy-low', action: 'hold', reason: 'excess below threshold' },
      { factoryId: 'control-low', action: 'hold', reason: 'excess below threshold' }
    ])
  })
})
