import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openEngineStore, type EngineStore } from './store'

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-store-agent-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('engine store lessons + usage + lists', () => {
  it('lists factories and sessions by date', () => {
    const f = store.createFactory({ name: 'A', role: 'Explorer', evidenceWeight: 1 })
    store.createSession({ factoryId: f.id, sessionDate: '2024-06-03', dailyLimitUsd: 1 })
    store.createSession({ factoryId: f.id, sessionDate: '2024-06-04', dailyLimitUsd: 1 })
    expect(store.listFactories()).toHaveLength(1)
    expect(store.listSessionsByDate('2024-06-03')).toHaveLength(1)
  })

  it('inserts lessons with exclude flag and filters promote feed', () => {
    const f = store.createFactory({ name: 'A', role: 'Control', evidenceWeight: 1 })
    const s = store.createSession({ factoryId: f.id, sessionDate: '2024-06-03', dailyLimitUsd: 1 })
    store.insertLesson({
      sessionId: s.id,
      roleTag: 'Control',
      bodyJson: '{"failureMode":"x"}',
      excludeFromPromote: true
    })
    store.insertLesson({
      sessionId: s.id,
      roleTag: 'Explorer',
      bodyJson: '{"failureMode":"y"}',
      excludeFromPromote: false
    })
    expect(store.listLessonsPool({ includeExcluded: false })).toHaveLength(1)
    expect(store.listLessonsPool({ limit: 1 })[0]?.roleTag).toBe('Explorer')
  })
})
