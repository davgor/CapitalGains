/** Session phases from market clock that count as "after morning window". */
const LATE_PHASES = new Set([
  'purchases',
  'monitoring',
  'closed',
  'weekend',
  'holiday'
])

export function isLateFactoryAdd(phase: string): boolean {
  return LATE_PHASES.has(phase)
}

/** Factories added after the morning window are queued until next open. */
export function shouldQueueUntilNextOpen(opts: { phase: string }): boolean {
  return isLateFactoryAdd(opts.phase)
}
