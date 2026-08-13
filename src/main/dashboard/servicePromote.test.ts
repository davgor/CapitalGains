import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SecureSecretsStore } from '../secrets/secureStore'
import { openEngineStore, type EngineStore } from '../engine/db/store'
import { confirmPromoteAction } from './servicePromote'

let dir: string
let store: EngineStore

const secrets: SecureSecretsStore = {
  has: () => false,
  get: () => undefined,
  set: () => undefined,
  clear: () => undefined
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-promote-actions-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

function run(factoryId: string, action: 'promote' | 'kill' | 'clone', iso = '2024-06-03T14:00:00.000Z') {
  return confirmPromoteAction({
    store,
    secrets,
    now: () => new Date(iso),
    factoryId,
    action
  })
}

describe('confirmPromoteAction guards', () => {
  it('rejects a missing factory with its id', () => {
    expect(() => run('missing', 'promote')).toThrow('factory not found: missing')
  })

  it('rejects every manual action on Control', () => {
    const control = store.createFactory({ name: 'C', role: 'Control', evidenceWeight: 1 })

    expect(() => run(control.id, 'kill')).toThrow(
      'Control factory cannot be promoted, killed, or cloned without explicit policy'
    )
    expect(store.listPromoteEvents()).toEqual([])
  })
})

describe('confirmPromoteAction promote and kill', () => {
  it('promotes to a minimum weight of two and enters exploit mode', () => {
    const factory = store.createFactory({ name: 'E', role: 'Explorer', evidenceWeight: 0.5 })
    run(factory.id, 'promote')

    expect(store.getFactory(factory.id)).toMatchObject({ role: 'Promoted', evidenceWeight: 2 })
    expect(store.getConfig('diversity.mode')).toBe('exploit')
    expect(store.listPromoteEvents()[0]).toMatchObject({
      factoryId: factory.id,
      action: 'promote',
      note: 'manual confirm'
    })
  })

  it('preserves a promoted weight already above two', () => {
    const factory = store.createFactory({ name: 'E', role: 'Explorer', evidenceWeight: 3.5 })
    run(factory.id, 'promote')

    expect(store.getFactory(factory.id)?.evidenceWeight).toBe(3.5)
  })

  it('kills with zero weight and records the exact event', () => {
    const factory = store.createFactory({ name: 'E', role: 'Explorer', evidenceWeight: 4 })
    run(factory.id, 'kill')

    expect(store.getFactory(factory.id)).toMatchObject({ role: 'Killed', evidenceWeight: 0 })
    expect(store.listPromoteEvents()[0]).toMatchObject({
      factoryId: factory.id,
      action: 'kill',
      note: 'manual confirm'
    })
  })
})

describe('confirmPromoteAction clone', () => {
  it('spawns a queued lineage clone after the morning window', () => {
    const parent = store.createFactory({ name: 'Alpha', role: 'Promoted', evidenceWeight: 3 })
    run(parent.id, 'clone')
    const clone = store.listFactories().find((factory) => factory.lineageParentId === parent.id)

    expect(clone).toMatchObject({
      name: 'Alpha-clone',
      role: 'Explorer',
      evidenceWeight: 0,
      queuedNextOpen: true
    })
    expect(store.listPromoteEvents()[0]).toMatchObject({
      action: 'clone',
      note: 'spawn explorer from lineage',
      cloneFactoryId: clone?.id
    })
  })

  it('makes an early clone immediately eligible', () => {
    const parent = store.createFactory({ name: 'Alpha', role: 'Promoted', evidenceWeight: 3 })
    run(parent.id, 'clone', '2024-06-03T13:20:00.000Z')
    const clone = store.listFactories().find((factory) => factory.lineageParentId === parent.id)

    expect(clone?.queuedNextOpen).toBe(false)
  })
})
