import { describe, expect, it } from 'vitest'
import { purchasesWindowMissed, sessionPhaseAt, toNyWallTime } from './marketClock'
import { superviseSession } from './supervisor'
import type { Clock } from '../../../shared/engine/ports'

/** Build a Date that is the given NY wall time on a known weekday. */
function atNy(isoUtc: string): Date {
  return new Date(isoUtc)
}

describe('marketClock (America/New_York)', () => {
  it('classifies open, mid-day, close, and weekend without wall-clock', () => {
    // 2024-06-03 is a Monday. 13:10 UTC = 09:10 EDT.
    expect(sessionPhaseAt(atNy('2024-06-03T13:10:00.000Z'))).toBe('regime')
    // 13:20 UTC = 09:20 EDT research
    expect(sessionPhaseAt(atNy('2024-06-03T13:20:00.000Z'))).toBe('research')
    // 13:40 UTC = 09:40 EDT purchases
    expect(sessionPhaseAt(atNy('2024-06-03T13:40:00.000Z'))).toBe('purchases')
    // 14:00 UTC = 10:00 EDT monitoring
    expect(sessionPhaseAt(atNy('2024-06-03T14:00:00.000Z'))).toBe('monitoring')
    // 20:05 UTC = 16:05 EDT closed
    expect(sessionPhaseAt(atNy('2024-06-03T20:05:00.000Z'))).toBe('closed')
    // Saturday
    expect(sessionPhaseAt(atNy('2024-06-01T15:00:00.000Z'))).toBe('weekend')
  })

  it('marks holiday stubs as closed/holiday', () => {
    expect(sessionPhaseAt(atNy('2024-07-04T14:00:00.000Z'))).toBe('holiday')
    expect(sessionPhaseAt(atNy('2024-07-03T14:00:00.000Z'))).toBe('holiday')
  })

  it('toNyWallTime returns Eastern date key', () => {
    const ny = toNyWallTime(atNy('2024-06-03T13:40:00.000Z'))
    expect(ny.dateKey).toBe('2024-06-03')
    expect(ny.hour).toBe(9)
    expect(ny.minute).toBe(40)
  })

  it('flags missed purchases window for infra_skip', () => {
    expect(purchasesWindowMissed(atNy('2024-06-03T14:00:00.000Z'), false)).toBe(true)
    expect(purchasesWindowMissed(atNy('2024-06-03T14:00:00.000Z'), true)).toBe(false)
    expect(purchasesWindowMissed(atNy('2024-06-03T13:40:00.000Z'), false)).toBe(false)
  })
})

describe('superviseSession', () => {
  it('sets infra_skip and opsAlarm when purchases missed', () => {
    const clock: Clock = { now: () => atNy('2024-06-03T15:00:00.000Z') }
    const result = superviseSession({ clock, purchasesStarted: false })
    expect(result.infraSkip).toBe(true)
    expect(result.opsAlarm).toBe(true)
    expect(result.phase).toBe('monitoring')
  })
})
