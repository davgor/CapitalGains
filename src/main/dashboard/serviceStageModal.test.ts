import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StageModalPayload } from '../../shared/engine/dashboardApi'
import { openEngineStore, type EngineStore } from '../engine/db/store'
import {
  buildStageModal,
  emptyStageModal,
  openStageModalForFactory
} from './serviceStageModal'

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-stage-modal-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

function createSession(factoryName = 'Alpha') {
  const factory = store.createFactory({
    name: factoryName,
    role: 'Explorer',
    evidenceWeight: 1
  })
  const session = store.createSession({
    factoryId: factory.id,
    sessionDate: '2024-06-03',
    dailyLimitUsd: 1_000
  })
  return { factory, session }
}

describe('emptyStageModal', () => {
  it('returns stage-specific locked payloads', () => {
    const stages: StageModalPayload['stage'][] = [
      'kickoff',
      'research',
      'purchases',
      'monitoring',
      'outcome',
      'lessons'
    ]

    expect(stages.map((stage) => emptyStageModal(stage))).toEqual([
      { stage: 'kickoff', view: expect.objectContaining({ status: 'locked', message: 'Kickoff artifact not available yet' }) },
      { stage: 'research', view: expect.objectContaining({ status: 'locked', message: 'Research artifact not available yet' }) },
      { stage: 'purchases', view: expect.objectContaining({ status: 'locked', message: 'Purchases not available yet' }) },
      { stage: 'monitoring', view: expect.objectContaining({ status: 'locked', message: 'Monitoring data not available yet' }) },
      { stage: 'outcome', view: expect.objectContaining({ status: 'locked', message: 'Outcome not available yet' }) },
      { stage: 'lessons', view: expect.objectContaining({ status: 'locked', message: 'Lessons artifact not available yet' }) }
    ])
  })
})

describe('buildStageModal artifacts', () => {
  it('maps kickoff and research records exactly', () => {
    const { session } = createSession()
    store.commitStage({
      sessionId: session.id,
      stage: 'kickoff',
      artifactJson: JSON.stringify({
        hypothesis: 'gap fade',
        style: 'mean revert',
        searchDirective: 'liquid only',
        generatedKickoffPrompt: 'prompt text'
      })
    })
    store.commitStage({
      sessionId: session.id,
      stage: 'research',
      artifactJson: JSON.stringify({
        sitOut: false,
        allocations: [{ symbol: 'AAPL', weight: 0.6, sector: 'Tech' }]
      })
    })

    expect(buildStageModal(store, session, 'kickoff').view).toMatchObject({
      status: 'ready',
      hypothesis: 'gap fade',
      style: 'mean revert',
      searchDirective: 'liquid only',
      generatedKickoffPrompt: 'prompt text'
    })
    expect(buildStageModal(store, session, 'research').view).toMatchObject({
      status: 'ready',
      sitOut: false,
      allocations: [{ symbol: 'AAPL', weight: 0.6, sector: 'Tech' }]
    })
  })
})

describe('buildStageModal purchases', () => {
  it('uses only buy fills and computes exact purchase totals', () => {
    const { session } = createSession()
    store.insertFill({
      sessionId: session.id,
      symbol: 'AAPL',
      side: 'buy',
      shares: 3,
      fillPrice: 101,
      midPrice: 100,
      commission: 0.03,
      idempotencyKey: 'buy-aapl',
      filledAt: '2024-06-03T14:00:00.000Z'
    })
    store.insertFill({
      sessionId: session.id,
      symbol: 'MSFT',
      side: 'sell',
      shares: 2,
      fillPrice: 50,
      midPrice: 51,
      commission: 0.02,
      idempotencyKey: 'sell-msft',
      filledAt: '2024-06-03T14:01:00.000Z'
    })
    store.insertOutcome({
      sessionId: session.id,
      grossPnl: 10,
      netPnl: 9,
      spyReturn: 0,
      fullLimitReturn: 0.009,
      deployedReturn: 0.01,
      cashResidual: 697
    })

    const payload = buildStageModal(store, session, 'purchases')

    expect(payload.view).toMatchObject({
      status: 'ready',
      lines: [{ symbol: 'AAPL', shares: 3, rawQuote: 100, frictionFill: 101, notional: 303 }],
      cashResidual: 697,
      totals: { notional: 303, commission: 0.03 }
    })
  })
})

describe('buildStageModal monitoring', () => {
  it('uses the latest snapshot and an exact parsed marks map', () => {
    const { session } = createSession()
    store.insertSnapshot({
      sessionId: session.id,
      asOf: '2024-06-03T15:00:00.000Z',
      marksJson: JSON.stringify({ AAPL: 100 }),
      unrealizedNet: 4
    })
    store.insertSnapshot({
      sessionId: session.id,
      asOf: '2024-06-03T15:05:00.000Z',
      marksJson: JSON.stringify({ AAPL: 102 }),
      unrealizedNet: 8
    })

    expect(buildStageModal(store, session, 'monitoring').view).toMatchObject({
      status: 'ready',
      marks: { AAPL: 102 },
      unrealizedNet: 8,
      lastRefresh: '2024-06-03T15:05:00.000Z'
    })
  })

  it('locks monitoring when no snapshots exist', () => {
    const { session } = createSession()

    expect(buildStageModal(store, session, 'monitoring').view).toMatchObject({
      status: 'locked',
      message: 'Monitoring data not available yet'
    })
  })
})

describe('buildStageModal outcome', () => {
  it('computes exact SPY and same-day Control comparisons', () => {
    const control = store.createFactory({ name: 'Control', role: 'Control', evidenceWeight: 1 })
    const explorer = store.createFactory({ name: 'Alpha', role: 'Explorer', evidenceWeight: 1 })
    const controlSession = store.createSession({ factoryId: control.id, sessionDate: '2024-06-03', dailyLimitUsd: 1_000 })
    const session = store.createSession({ factoryId: explorer.id, sessionDate: '2024-06-03', dailyLimitUsd: 1_000 })
    store.insertOutcome({
      sessionId: controlSession.id,
      grossPnl: 21,
      netPnl: 20,
      spyReturn: 0.01,
      fullLimitReturn: 0.02,
      deployedReturn: 0.02,
      cashResidual: 0
    })
    store.insertOutcome({
      sessionId: session.id,
      grossPnl: 55,
      netPnl: 50,
      spyReturn: 0.01,
      fullLimitReturn: 0.05,
      deployedReturn: 0.06,
      cashResidual: 0
    })

    expect(buildStageModal(store, session, 'outcome').view).toMatchObject({
      status: 'ready',
      grossPnl: 55,
      netPnl: 50,
      vsSpy: 40,
      vsControl: 30,
      fullLimitReturn: 0.05,
      deployedReturn: 0.06
    })
  })
})

describe('buildStageModal lessons', () => {
  it('prefers the stage artifact over the lessons pool', () => {
    const { session } = createSession()
    store.insertLesson({
      sessionId: session.id,
      roleTag: 'Explorer',
      bodyJson: JSON.stringify({ thoughtProcess: 'pool copy' })
    })
    store.commitStage({
      sessionId: session.id,
      stage: 'lessons',
      artifactJson: JSON.stringify({
        thoughtProcess: 'stage copy',
        nextSeed: 'new seed',
        promoteKillNote: 'hold'
      })
    })

    expect(buildStageModal(store, session, 'lessons').view).toMatchObject({
      status: 'ready',
      thoughtProcess: 'stage copy',
      nextSeed: 'new seed',
      promoteKillNote: 'hold'
    })
  })

  it('falls back to the matching lessons-pool row after malformed stage JSON', () => {
    const { session } = createSession()
    const { session: otherSession } = createSession('Other')
    store.insertLesson({
      sessionId: otherSession.id,
      roleTag: 'Explorer',
      bodyJson: JSON.stringify({ thoughtProcess: 'wrong row' })
    })
    store.insertLesson({
      sessionId: session.id,
      roleTag: 'Explorer',
      bodyJson: JSON.stringify({ thoughtProcess: 'matching row', nextSeed: 'seed' })
    })
    store.commitStage({ sessionId: session.id, stage: 'lessons', artifactJson: '{bad' })

    expect(buildStageModal(store, session, 'lessons').view).toMatchObject({
      status: 'ready',
      thoughtProcess: 'matching row',
      nextSeed: 'seed'
    })
  })
})

describe('openStageModalForFactory', () => {
  it('locks absent sessions and future stage nodes', () => {
    const now = () => new Date('2024-06-03T14:00:00.000Z')
    const { factory } = createSession()

    expect(openStageModalForFactory(store, now, 'missing', 'kickoff').view.status).toBe('locked')
    expect(openStageModalForFactory(store, now, factory.id, 'outcome').view.status).toBe('locked')
  })

  it('opens the matching active stage artifact', () => {
    const now = () => new Date('2024-06-03T14:00:00.000Z')
    const { factory, session } = createSession()
    store.commitStage({
      sessionId: session.id,
      stage: 'kickoff',
      artifactJson: JSON.stringify({ hypothesis: 'open me' })
    })

    expect(openStageModalForFactory(store, now, factory.id, 'kickoff').view).toMatchObject({
      status: 'ready',
      hypothesis: 'open me'
    })
  })
})
