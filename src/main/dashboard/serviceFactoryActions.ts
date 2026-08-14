import { shouldQueueUntilNextOpen } from '../../shared/engine/queueEligibility'
import type { Factory } from '../../shared/engine/types'
import { sessionPhaseAt } from '../engine/clock/marketClock'
import type { EngineStore } from '../engine/db/store'

export function addFactory(store: EngineStore, now: () => Date, name: string): Factory {
  const phase = sessionPhaseAt(now())
  const queued = shouldQueueUntilNextOpen({ phase })
  const hasControl = store.listFactories().some((f) => f.role === 'Control')
  if (!hasControl && name.toLowerCase() === 'control') {
    return store.createFactory({
      name,
      role: 'Control',
      evidenceWeight: 1,
      queuedNextOpen: false
    })
  }
  return store.createFactory({
    name,
    role: 'Explorer',
    evidenceWeight: 0,
    queuedNextOpen: queued
  })
}

export function renameFactory(store: EngineStore, id: string, name: string): Factory {
  const current = store.getFactory(id)
  if (!current) {
    throw new Error(`factory not found: ${id}`)
  }
  if (current.role === 'Control' && name.trim().length === 0) {
    throw new Error('Control factory name required')
  }
  return store.renameFactory(id, name)
}
