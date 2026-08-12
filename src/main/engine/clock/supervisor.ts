import { purchasesWindowMissed, sessionPhaseAt } from './marketClock'
import type { Clock } from '../../../shared/engine/ports'

interface SupervisorResult {
  phase: ReturnType<typeof sessionPhaseAt>
  infraSkip: boolean
  opsAlarm: boolean
}

/**
 * Session supervisor: marks infra_skip when the purchases window was missed,
 * and raises an ops alarm rather than silently sleeping through purchases.
 */
export function superviseSession(opts: {
  clock: Clock
  purchasesStarted: boolean
}): SupervisorResult {
  const now = opts.clock.now()
  const phase = sessionPhaseAt(now)
  const missed = purchasesWindowMissed(now, opts.purchasesStarted)
  return {
    phase,
    infraSkip: missed,
    opsAlarm: missed
  }
}
