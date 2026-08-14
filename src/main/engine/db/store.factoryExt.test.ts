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

function createSession() {
  const factory = store.createFactory({ name: 'E', role: 'Explorer', evidenceWeight: 1 })
  return store.createSession({
    factoryId: factory.id,
    sessionDate: '2024-06-03',
    dailyLimitUsd: 1_000
  })
}

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

describe('dashboard store idempotency', () => {
  it('returns the original fill for a duplicate idempotency key', () => {
    const session = createSession()
    const first = store.insertFill({
      sessionId: session.id,
      symbol: 'AAPL',
      side: 'buy',
      shares: 2,
      fillPrice: 100,
      midPrice: 99,
      commission: 0.02,
      idempotencyKey: 'same-key',
      filledAt: '2024-06-03T14:00:00.000Z'
    })
    const duplicate = store.insertFill({
      sessionId: session.id,
      symbol: 'MSFT',
      side: 'buy',
      shares: 9,
      fillPrice: 50,
      midPrice: 49,
      commission: 0.09,
      idempotencyKey: 'same-key',
      filledAt: '2024-06-03T14:01:00.000Z'
    })

    expect(duplicate).toEqual(first)
    expect(store.listFills(session.id)).toEqual([first])
  })

  it('updates an existing same-time snapshot without adding a row', () => {
    const session = createSession()
    const first = store.insertSnapshot({
      sessionId: session.id,
      asOf: '2024-06-03T15:00:00.000Z',
      marksJson: '{"AAPL":100}',
      unrealizedNet: 1
    })
    const updated = store.insertSnapshot({
      sessionId: session.id,
      asOf: '2024-06-03T15:00:00.000Z',
      marksJson: '{"AAPL":105}',
      unrealizedNet: 6
    })

    expect(updated.id).toBe(first.id)
    expect(store.listSnapshots(session.id)).toEqual([updated])
  })
})

describe('dashboard store aggregate reads', () => {
  it('returns no outcomes for an empty session id list', () => {
    expect(store.listOutcomesBySessionIds([])).toEqual([])
  })

  it('returns only outcomes belonging to requested session ids', () => {
    const included = createSession()
    const excluded = createSession()
    const outcome = store.insertOutcome({
      sessionId: included.id,
      grossPnl: 12,
      netPnl: 10,
      fullLimitReturn: 0.01,
      deployedReturn: 0.02,
      spyReturn: 0.005,
      cashResidual: 100
    })
    store.insertOutcome({
      sessionId: excluded.id,
      grossPnl: 99,
      netPnl: 90,
      fullLimitReturn: 0.09,
      deployedReturn: 0.1,
      spyReturn: 0.005,
      cashResidual: 0
    })

    expect(store.listOutcomesBySessionIds([included.id])).toEqual([outcome])
  })
})

describe('dashboard store usage reads', () => {
  it('preserves null and numeric agent usage values distinctly', () => {
    const session = createSession()
    store.insertUsage({
      factoryId: session.factoryId,
      sessionId: session.id,
      stage: 'research',
      usage: null
    })
    store.insertUsage({
      factoryId: session.factoryId,
      sessionId: session.id,
      stage: 'lessons',
      usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, costUsd: 0.02 }
    })

    const usage = store.listUsageBySessionDate(session.sessionDate)
    expect(usage[0]).toMatchObject({
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      costUsd: null
    })
    expect(usage[1]).toMatchObject({
      inputTokens: 10,
      outputTokens: 4,
      totalTokens: 14,
      costUsd: 0.02
    })
  })
})
