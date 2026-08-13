import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openEngineStore, type EngineStore } from '../../engine/db/store'
import { runLessons } from './runLessons'
import { appendLessonToPool, queryGlobalLessonsPool } from './pool'
import { createMockAgentPort } from '../createAgentPort'
import type { LessonsInputPacket } from './schema'

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-lessons-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

const PACKET: LessonsInputPacket = {
  hypothesis: 'fade gaps',
  research: { sitOut: false },
  frictionFillsSummary: 'buy:NVDA:10',
  trajectorySummary: 'flat then sell',
  netPnl: 12.5,
  fullLimitReturn: 0.001,
  deployedReturn: 0.002,
  spyReturn: 0.001,
  controlSameDayNet: 5,
  infraSkip: false
}

describe('Lessons contracts + pool append', () => {
  it('persists Lessons output and appends role-tagged pool entries', async () => {
    const factory = store.createFactory({ name: 'E', role: 'Explorer', evidenceWeight: 1 })
    const session = store.createSession({
      factoryId: factory.id,
      sessionDate: '2024-06-03',
      dailyLimitUsd: 10_000
    })
    const agent = createMockAgentPort({
      text: JSON.stringify({
        failureMode: 'late_entry',
        winLossFactor: 'spread',
        suggestedSeed: 'enter earlier'
      })
    })
    const result = await runLessons({
      agent,
      factoryId: factory.id,
      sessionId: session.id,
      role: 'Explorer',
      packet: PACKET
    })
    expect(result.output.failureMode).toBe('late_entry')
    appendLessonToPool(store, {
      sessionId: session.id,
      role: 'Explorer',
      body: result.output
    })
    expect(queryGlobalLessonsPool(store)[0]?.roleTag).toBe('Explorer')
  })
})

describe('Lessons infra_skip promote exclusion', () => {
  it('infra_skip sessions mark lessons excluded from promote feeds', async () => {
    const factory = store.createFactory({ name: 'E', role: 'Explorer', evidenceWeight: 1 })
    const session = store.createSession({
      factoryId: factory.id,
      sessionDate: '2024-06-03',
      dailyLimitUsd: 10_000
    })
    const agent = createMockAgentPort({
      handler: async () => {
        throw new Error('should skip agent on infra_skip')
      }
    })
    const result = await runLessons({
      agent,
      factoryId: factory.id,
      sessionId: session.id,
      role: 'Explorer',
      packet: { ...PACKET, infraSkip: true }
    })
    expect(result.skippedAgent).toBe(true)
    expect(result.output.excludeFromPromote).toBe(true)
    appendLessonToPool(store, {
      sessionId: session.id,
      role: 'Explorer',
      body: result.output,
      excludeFromPromote: true
    })
    expect(queryGlobalLessonsPool(store, { forPromote: true })).toHaveLength(0)
    expect(queryGlobalLessonsPool(store)).toHaveLength(1)
  })
})

describe('Lessons pool ordering', () => {
  it('global pool query returns capped newest-first role-tagged entries', () => {
    const factory = store.createFactory({ name: 'C', role: 'Control', evidenceWeight: 1 })
    const s1 = store.createSession({
      factoryId: factory.id,
      sessionDate: '2024-06-01',
      dailyLimitUsd: 1
    })
    const s2 = store.createSession({
      factoryId: factory.id,
      sessionDate: '2024-06-02',
      dailyLimitUsd: 1
    })
    appendLessonToPool(store, {
      sessionId: s1.id,
      role: 'Control',
      body: { failureMode: 'old', winLossFactor: 'x', suggestedSeed: 'a' }
    })
    appendLessonToPool(store, {
      sessionId: s2.id,
      role: 'Control',
      body: { failureMode: 'new', winLossFactor: 'y', suggestedSeed: 'b' }
    })
    const pool = queryGlobalLessonsPool(store, { limit: 1 })
    expect(pool).toHaveLength(1)
    expect(pool[0]?.bodyJson).toContain('new')
  })
})
