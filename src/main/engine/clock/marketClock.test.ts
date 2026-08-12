import { describe, expect, it } from 'vitest'
import { purchasesWindowMissed, sessionPhaseAt, toNyWallTime } from './marketClock'
import { superviseSession } from './supervisor'
import type { Clock } from '../../../shared/engine/ports'

function atNy(isoUtc: string): Date {
  return new Date(isoUtc)
}

describe('marketClock phases', () => {
  it('classifies open, mid-day, close, and weekend without wall-clock', () => {
    // 2024-06-03 Monday. EDT = UTC-4.
    expect(sessionPhaseAt(atNy('2024-06-03T13:04:00.000Z'))).toBe('preopen') // 09:04
    expect(sessionPhaseAt(atNy('2024-06-03T13:05:00.000Z'))).toBe('regime') // 09:05
    expect(sessionPhaseAt(atNy('2024-06-03T13:14:00.000Z'))).toBe('regime')
    expect(sessionPhaseAt(atNy('2024-06-03T13:15:00.000Z'))).toBe('research')
    expect(sessionPhaseAt(atNy('2024-06-03T13:34:00.000Z'))).toBe('research')
    expect(sessionPhaseAt(atNy('2024-06-03T13:35:00.000Z'))).toBe('purchases')
    expect(sessionPhaseAt(atNy('2024-06-03T13:44:00.000Z'))).toBe('purchases')
    expect(sessionPhaseAt(atNy('2024-06-03T13:45:00.000Z'))).toBe('monitoring')
    expect(sessionPhaseAt(atNy('2024-06-03T19:59:00.000Z'))).toBe('monitoring') // 15:59
    expect(sessionPhaseAt(atNy('2024-06-03T20:00:00.000Z'))).toBe('closed') // 16:00
    expect(sessionPhaseAt(atNy('2024-06-01T15:00:00.000Z'))).toBe('weekend')
  })

  it('marks holiday and half-day stubs as holiday/closed', () => {
    expect(sessionPhaseAt(atNy('2024-07-04T14:00:00.000Z'))).toBe('holiday')
    expect(sessionPhaseAt(atNy('2024-07-03T14:00:00.000Z'))).toBe('holiday')
  })
})

describe('marketClock helpers', () => {
  it('toNyWallTime returns Eastern date parts', () => {
    const ny = toNyWallTime(atNy('2024-06-03T13:40:00.000Z'))
    expect(ny.dateKey).toBe('2024-06-03')
    expect(ny.year).toBe(2024)
    expect(ny.month).toBe(6)
    expect(ny.day).toBe(3)
    expect(ny.hour).toBe(9)
    expect(ny.minute).toBe(40)
    expect(ny.weekday).toBe('Mon')
  })

  it('flags missed purchases window for infra_skip', () => {
    expect(purchasesWindowMissed(atNy('2024-06-03T14:00:00.000Z'), false)).toBe(true)
    expect(purchasesWindowMissed(atNy('2024-06-03T20:05:00.000Z'), false)).toBe(true)
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
    const ok = superviseSession({ clock, purchasesStarted: true })
    expect(ok.infraSkip).toBe(false)
    expect(ok.opsAlarm).toBe(false)
  })
})
