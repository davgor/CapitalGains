/**
 * US equities session helpers.
 * Timezone assumption: America/New_York (US/Eastern). All stage windows are
 * interpreted in that zone regardless of host TZ. See docs/runbooks/market-clock.md.
 */

type SessionPhase =
  | 'preopen'
  | 'regime'
  | 'research'
  | 'purchases'
  | 'monitoring'
  | 'closed'
  | 'weekend'
  | 'holiday'

interface NyWallTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: string
  dateKey: string
}

const HALF_DAYS = new Set(['2024-07-03', '2024-11-29', '2025-07-03'])
const HOLIDAYS = new Set(['2024-07-04', '2024-12-25', '2025-01-01', '2025-12-25'])

export function toNyWallTime(now: Date): NyWallTime {
  const parts = nyParts(now)
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    weekday: parts.weekday,
    dateKey: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
  }
}

export function sessionPhaseAt(now: Date): SessionPhase {
  const ny = toNyWallTime(now)
  if (isWeekend(ny.weekday)) {
    return 'weekend'
  }
  // Phase 1 stubs: holidays and half-days are treated as closed (enriched in 010.1).
  if (HOLIDAYS.has(ny.dateKey) || HALF_DAYS.has(ny.dateKey)) {
    return 'holiday'
  }
  return phaseForMinutes(minutesOfDay(ny), 16 * 60)
}

export function purchasesWindowMissed(now: Date, purchasesStarted: boolean): boolean {
  if (purchasesStarted) {
    return false
  }
  const phase = sessionPhaseAt(now)
  return phase === 'monitoring' || phase === 'closed'
}

function phaseForMinutes(mins: number, closeMins: number): SessionPhase {
  if (mins < 9 * 60 + 5) {
    return 'preopen'
  }
  if (mins < 9 * 60 + 15) {
    return 'regime'
  }
  if (mins < 9 * 60 + 35) {
    return 'research'
  }
  if (mins < 9 * 60 + 45) {
    return 'purchases'
  }
  if (mins < closeMins) {
    return 'monitoring'
  }
  return 'closed'
}

function minutesOfDay(ny: NyWallTime): number {
  return ny.hour * 60 + ny.minute
}

function isWeekend(weekday: string): boolean {
  return weekday === 'Sat' || weekday === 'Sun'
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function nyParts(now: Date): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: string
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  })
  const bag: Record<string, string> = {}
  for (const part of fmt.formatToParts(now)) {
    if (part.type !== 'literal') {
      bag[part.type] = part.value
    }
  }
  return {
    year: Number(bag['year']),
    month: Number(bag['month']),
    day: Number(bag['day']),
    hour: Number(bag['hour'] === '24' ? '0' : bag['hour']),
    minute: Number(bag['minute']),
    weekday: String(bag['weekday'])
  }
}
