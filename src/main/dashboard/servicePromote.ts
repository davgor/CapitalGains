import type { DashboardSnapshot } from '../../shared/engine/dashboardApi'
import { shouldQueueUntilNextOpen } from '../../shared/engine/queueEligibility'
import { sessionPhaseAt } from '../engine/clock/marketClock'
import type { EngineStore } from '../engine/db/store'
import type { SecureSecretsStore } from '../secrets/secureStore'
import { buildDashboardSnapshot } from './serviceSnapshot'

export function confirmPromoteAction(opts: {
  store: EngineStore
  secrets: SecureSecretsStore
  now: () => Date
  factoryId: string
  action: 'promote' | 'kill' | 'clone'
}): DashboardSnapshot {
  const { store, secrets, now, factoryId, action } = opts
  const factory = store.getFactory(factoryId)
  if (!factory) {
    throw new Error(`factory not found: ${factoryId}`)
  }
  if (factory.role === 'Control') {
    throw new Error('Control factory cannot be promoted, killed, or cloned without explicit policy')
  }
  if (action === 'promote') {
    store.updateFactory(factoryId, {
      role: 'Promoted',
      evidenceWeight: Math.max(factory.evidenceWeight, 2)
    })
    store.insertPromoteEvent({
      factoryId,
      action: 'promote',
      note: 'manual confirm'
    })
    store.setConfig('diversity.mode', 'exploit')
  } else if (action === 'kill') {
    store.updateFactory(factoryId, { role: 'Killed', evidenceWeight: 0 })
    store.insertPromoteEvent({
      factoryId,
      action: 'kill',
      note: 'manual confirm'
    })
  } else {
    const clone = store.createFactory({
      name: `${factory.name}-clone`,
      role: 'Explorer',
      evidenceWeight: 0,
      lineageParentId: factoryId,
      queuedNextOpen: shouldQueueUntilNextOpen({ phase: sessionPhaseAt(now()) })
    })
    store.insertPromoteEvent({
      factoryId,
      action: 'clone',
      note: 'spawn explorer from lineage',
      cloneFactoryId: clone.id
    })
  }
  return buildDashboardSnapshot(store, secrets, now)
}
