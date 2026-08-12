import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openEngineStore, type EngineStore } from '../engine/db/store'
import { aggregateDailySdkSpend, recordAgentUsage } from './usage'

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-usage-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

function seedFactorySession(date = '2024-06-03') {
  const factory = store.createFactory({ name: 'E', role: 'Explorer', evidenceWeight: 1 })
  const session = store.createSession({
    factoryId: factory.id,
    sessionDate: date,
    dailyLimitUsd: 10_000
  })
  return { factory, session }
}

describe('usage row persistence', () => {
  it('persists usage rows keyed by factory + session + stage', () => {
    const { factory, session } = seedFactorySession()
    const row = recordAgentUsage(store, {
      factoryId: factory.id,
      sessionId: session.id,
      stage: 'kickoff',
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        costUsd: 0.02
      }
    })
    expect(row.factoryId).toBe(factory.id)
    expect(row.stage).toBe('kickoff')
    expect(store.listUsageBySessionDate('2024-06-03')[0]?.costUsd).toBe(0.02)
  })

  it('missing usage from mock/local leaves null cost without crashing', () => {
    const { factory, session } = seedFactorySession()
    const row = recordAgentUsage(store, {
      factoryId: factory.id,
      sessionId: session.id,
      stage: 'research',
      usage: null
    })
    expect(row.costUsd).toBeNull()
    expect(row.totalTokens).toBeNull()
  })
})

describe('usage aggregation', () => {
  it('aggregates daily SDK spend across factories', () => {
    const a = store.createFactory({ name: 'A', role: 'Explorer', evidenceWeight: 1 })
    const b = store.createFactory({ name: 'B', role: 'Control', evidenceWeight: 1 })
    const sa = store.createSession({ factoryId: a.id, sessionDate: '2024-06-03', dailyLimitUsd: 1 })
    const sb = store.createSession({ factoryId: b.id, sessionDate: '2024-06-03', dailyLimitUsd: 1 })
    recordAgentUsage(store, {
      factoryId: a.id,
      sessionId: sa.id,
      stage: 'kickoff',
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20, costUsd: 0.1 }
    })
    recordAgentUsage(store, {
      factoryId: b.id,
      sessionId: sb.id,
      stage: 'lessons',
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10, costUsd: 0.05 }
    })
    const agg = aggregateDailySdkSpend(store.listUsageBySessionDate('2024-06-03'))
    expect(agg.totalCostUsd).toBeCloseTo(0.15)
    expect(agg.totalTokens).toBe(30)
    expect(agg.byFactory[a.id]?.costUsd).toBeCloseTo(0.1)
  })
})
