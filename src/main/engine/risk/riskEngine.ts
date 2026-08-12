import type { Allocation, RiskLimits } from '../../../shared/engine/types'
import { DEFAULT_RISK_LIMITS } from '../../../shared/engine/types'

interface BasketValidation {
  ok: boolean
  reasons: string[]
}

export function validateBasket(
  allocations: Allocation[],
  limits: RiskLimits = DEFAULT_RISK_LIMITS
): BasketValidation {
  const reasons: string[] = []
  const sum = allocations.reduce((acc, a) => acc + a.weight, 0)
  if (sum > 1 + 1e-9) {
    reasons.push(`weights sum ${sum} exceeds 1`)
  }
  for (const a of allocations) {
    if (a.weight > limits.maxSingleNameWeight + 1e-9) {
      reasons.push(`${a.symbol} weight ${a.weight} exceeds maxSingleNameWeight`)
    }
  }
  pushSectorBreaches(allocations, limits, reasons)
  return { ok: reasons.length === 0, reasons }
}

export function effectiveStopPercent(opts: {
  allocationStop?: number
  planStop?: number
  limits: RiskLimits
}): number {
  const candidates = [opts.limits.defaultStopLossPercent]
  if (opts.planStop !== undefined) {
    candidates.push(opts.planStop)
  }
  if (opts.allocationStop !== undefined) {
    candidates.push(opts.allocationStop)
  }
  return Math.min(...candidates)
}

export function shouldTriggerStop(opts: {
  side: 'long'
  fillPrice: number
  mark: number
  stopLossPercent: number
}): boolean {
  const stop = opts.fillPrice * (1 - opts.stopLossPercent / 100)
  return opts.mark <= stop
}

export function shouldDailyLossHalt(opts: {
  startingEquity: number
  equity: number
  limits: RiskLimits
}): boolean {
  const lossPct = ((opts.startingEquity - opts.equity) / opts.startingEquity) * 100
  return lossPct >= opts.limits.dailyLossHaltPercent
}

function pushSectorBreaches(
  allocations: Allocation[],
  limits: RiskLimits,
  reasons: string[]
): void {
  const bySector = new Map<string, number>()
  for (const a of allocations) {
    bySector.set(a.sector, (bySector.get(a.sector) ?? 0) + a.weight)
  }
  for (const [sector, weight] of bySector) {
    if (weight > limits.maxSectorWeight + 1e-9) {
      reasons.push(`sector ${sector} weight ${weight} exceeds maxSectorWeight`)
    }
  }
}
