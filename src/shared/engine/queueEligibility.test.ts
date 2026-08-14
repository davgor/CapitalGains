import { describe, expect, it } from 'vitest'
import { isLateFactoryAdd, shouldQueueUntilNextOpen } from './queueEligibility'

describe('queueEligibility', () => {
  it('treats preopen/regime/research as morning window (not late)', () => {
    expect(isLateFactoryAdd('preopen')).toBe(false)
    expect(isLateFactoryAdd('regime')).toBe(false)
    expect(isLateFactoryAdd('research')).toBe(false)
  })

  it('treats purchases and later phases as late', () => {
    expect(isLateFactoryAdd('purchases')).toBe(true)
    expect(isLateFactoryAdd('monitoring')).toBe(true)
    expect(isLateFactoryAdd('closed')).toBe(true)
    expect(isLateFactoryAdd('weekend')).toBe(true)
    expect(isLateFactoryAdd('holiday')).toBe(true)
  })

  it('queues when late so factory does not run Purchases same day', () => {
    expect(shouldQueueUntilNextOpen({ phase: 'monitoring' })).toBe(true)
    expect(shouldQueueUntilNextOpen({ phase: 'preopen' })).toBe(false)
  })
})
