import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openEngineStore, type EngineStore } from '../engine/db/store'
import { addFactory, renameFactory } from './serviceFactoryActions'

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-factory-actions-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('addFactory Control selection', () => {
  it('creates the first case-insensitive Control with protected defaults', () => {
    const created = addFactory(store, () => new Date('2024-06-03T14:00:00.000Z'), 'CONTROL')

    expect(created).toMatchObject({
      name: 'CONTROL',
      role: 'Control',
      evidenceWeight: 1,
      queuedNextOpen: false
    })
  })

  it('uses roles, not names, to determine whether Control exists', () => {
    store.createFactory({ name: 'Control', role: 'Explorer', evidenceWeight: 0 })
    const created = addFactory(store, () => new Date('2024-06-03T14:00:00.000Z'), 'control')

    expect(created.role).toBe('Control')
    expect(store.listFactories().filter((factory) => factory.role === 'Control')).toHaveLength(1)
  })

  it('creates a second Control-named factory as an Explorer', () => {
    store.createFactory({ name: 'Benchmark', role: 'Control', evidenceWeight: 1 })
    const created = addFactory(store, () => new Date('2024-06-03T13:20:00.000Z'), 'Control')

    expect(created.role).toBe('Explorer')
    expect(created.evidenceWeight).toBe(0)
    expect(created.queuedNextOpen).toBe(false)
  })
})

describe('renameFactory validation', () => {
  it('throws the missing factory id in the error', () => {
    expect(() => renameFactory(store, 'missing-id', 'New')).toThrow(
      'factory not found: missing-id'
    )
  })

  it('rejects an empty or whitespace-only Control name', () => {
    const control = store.createFactory({
      name: 'Control',
      role: 'Control',
      evidenceWeight: 1
    })

    expect(() => renameFactory(store, control.id, '   ')).toThrow(
      'Control factory name required'
    )
  })

  it('allows a nonempty Control name and an empty Explorer name', () => {
    const control = store.createFactory({ name: 'C', role: 'Control', evidenceWeight: 1 })
    const explorer = store.createFactory({ name: 'E', role: 'Explorer', evidenceWeight: 1 })

    expect(renameFactory(store, control.id, 'Benchmark').name).toBe('Benchmark')
    expect(renameFactory(store, explorer.id, '').name).toBe('')
  })
})
