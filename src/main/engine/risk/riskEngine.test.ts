import { describe, expect, it } from 'vitest'
import {
  effectiveStopPercent,
  shouldDailyLossHalt,
  shouldTriggerStop,
  validateBasket
} from './riskEngine'
import { DEFAULT_RISK_LIMITS } from '../../../shared/engine/types'

describe('validateBasket', () => {
  it('rejects over-name / over-sector / over-sum weights', () => {
    const overName = validateBasket([
      { symbol: 'NVDA', weight: 0.5, sector: 'Tech' },
      { symbol: 'GOOGL', weight: 0.3, sector: 'Tech' }
    ])
    expect(overName.ok).toBe(false)
    expect(overName.reasons.some((r) => r.includes('NVDA'))).toBe(true)

    const overSector = validateBasket([
      { symbol: 'NVDA', weight: 0.35, sector: 'Tech' },
      { symbol: 'GOOGL', weight: 0.35, sector: 'Tech' }
    ])
    expect(overSector.ok).toBe(false)
    expect(overSector.reasons.some((r) => r.includes('sector Tech'))).toBe(true)

    const overSum = validateBasket([
      { symbol: 'NVDA', weight: 0.4, sector: 'Tech' },
      { symbol: 'XOM', weight: 0.4, sector: 'Energy' },
      { symbol: 'JPM', weight: 0.3, sector: 'Finance' }
    ])
    expect(overSum.ok).toBe(false)
  })
})

describe('stops and daily halt', () => {
  it('triggers stop when mark breaches stop from fill', () => {
    expect(
      shouldTriggerStop({
        side: 'long',
        fillPrice: 100,
        mark: 97.5,
        stopLossPercent: 2
      })
    ).toBe(true)
    expect(
      shouldTriggerStop({
        side: 'long',
        fillPrice: 100,
        mark: 99,
        stopLossPercent: 2
      })
    ).toBe(false)
  })

  it('daily loss halt uses configurable limits', () => {
    const limits = { ...DEFAULT_RISK_LIMITS, dailyLossHaltPercent: 3 }
    expect(
      shouldDailyLossHalt({ startingEquity: 10_000, equity: 9_600, limits })
    ).toBe(true)
    expect(
      shouldDailyLossHalt({ startingEquity: 10_000, equity: 9_800, limits })
    ).toBe(false)
  })

  it('research may tighten stops but not loosen default', () => {
    expect(
      effectiveStopPercent({
        allocationStop: 1.5,
        planStop: 3,
        limits: DEFAULT_RISK_LIMITS
      })
    ).toBe(1.5)
    expect(
      effectiveStopPercent({
        planStop: 5,
        limits: DEFAULT_RISK_LIMITS
      })
    ).toBe(2)
  })
})
