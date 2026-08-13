import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openEngineStore } from './store'
import type { EngineStore } from './store'

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-factory-ext-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('factory rename / queue / lineage', () => {
  it('renames a factory and persists', () => {
    const f = store.createFactory({ name: 'Old', role: 'Explorer', evidenceWeight: 1 })
    const renamed = store.renameFactory(f.id, 'New Name')
    expect(renamed.name).toBe('New Name')
    expect(store.getFactory(f.id)?.name).toBe('New Name')
  })

  it('sets queued_next_open for late-add explorers', () => {
    const f = store.createFactory({
      name: 'Late',
      role: 'Explorer',
      evidenceWeight: 0,
      queuedNextOpen: true
    })
    expect(f.queuedNextOpen).toBe(true)
    expect(store.getFactory(f.id)?.queuedNextOpen).toBe(true)
  })

  it('clones with lineage parent id', () => {
    const parent = store.createFactory({
      name: 'Promoted',
      role: 'Promoted',
      evidenceWeight: 2
    })
    const clone = store.createFactory({
      name: 'Clone-1',
      role: 'Explorer',
      evidenceWeight: 0,
      lineageParentId: parent.id
    })
    expect(clone.lineageParentId).toBe(parent.id)
  })

  it('records promote events', () => {
    const f = store.createFactory({ name: 'E', role: 'Explorer', evidenceWeight: 1 })
    store.insertPromoteEvent({ factoryId: f.id, action: 'promote', note: 'ok' })
    expect(store.listPromoteEvents()).toHaveLength(1)
    expect(store.listPromoteEvents()[0]?.action).toBe('promote')
  })
})
