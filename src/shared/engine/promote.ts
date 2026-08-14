import type { FactoryRole } from './types'

export interface PromoteThresholds {
  minSessionsExInfra: number
  minNetExcessVsSpy: number
  minNetExcessVsControl: number
  maxDrawdown: number
}

export interface FactorySessionStats {
  factoryId: string
  role: FactoryRole
  /** Session count excluding infra_skip days. */
  sessionsExInfra: number
  avgNetExcessVsSpy: number
  avgNetExcessVsControl: number
  maxDrawdown: number
}

export type PromoteAction = 'promote' | 'kill' | 'hold'

export interface PromoteRecommendation {
  factoryId: string
  action: PromoteAction
  reason: string
}

export const DEFAULT_PROMOTE_THRESHOLDS: PromoteThresholds = {
  minSessionsExInfra: 5,
  minNetExcessVsSpy: 0.01,
  minNetExcessVsControl: 0.005,
  maxDrawdown: 0.1
}

/**
 * Pure promote/kill evaluation. infra_skip days must already be excluded from
 * `sessionsExInfra` by the caller.
 */
export function evaluatePromoteKill(opts: {
  factories: FactorySessionStats[]
  thresholds: PromoteThresholds
}): PromoteRecommendation[] {
  const t = opts.thresholds
  return opts.factories.map((f) => {
    if (f.role === 'Control' || f.role === 'Killed') {
      return { factoryId: f.factoryId, action: 'hold', reason: `role:${f.role}` }
    }
    if (f.maxDrawdown > t.maxDrawdown) {
      return {
        factoryId: f.factoryId,
        action: 'kill',
        reason: `drawdown ${f.maxDrawdown} > ${t.maxDrawdown}`
      }
    }
    if (f.sessionsExInfra < t.minSessionsExInfra) {
      return {
        factoryId: f.factoryId,
        action: 'hold',
        reason: `sessions ${f.sessionsExInfra} < ${t.minSessionsExInfra}`
      }
    }
    if (
      f.avgNetExcessVsSpy >= t.minNetExcessVsSpy &&
      f.avgNetExcessVsControl >= t.minNetExcessVsControl
    ) {
      return {
        factoryId: f.factoryId,
        action: 'promote',
        reason: 'thresholds met'
      }
    }
    return {
      factoryId: f.factoryId,
      action: 'hold',
      reason: 'excess below threshold'
    }
  })
}
