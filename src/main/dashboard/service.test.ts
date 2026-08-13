import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openEngineStore } from '../engine/db/store'
import type { EngineStore } from '../engine/db/store'
import { createSecureSecretsStore, type CryptoPort } from '../secrets/secureStore'
import { createDashboardService } from './service'

let dir: string
let store: EngineStore

const cryptoPort: CryptoPort = {
  isEncryptionAvailable: () => true,
  encryptString: (plain) => Buffer.from(`enc:${plain}`, 'utf8'),
  decryptString: (blob) => blob.toString('utf8').slice(4)
}

function createDash(now?: () => Date) {
  const secrets = createSecureSecretsStore({
    filePath: join(dir, 'keys.enc.json'),
    crypto: cryptoPort
  })
  return createDashboardService({ store, secrets, now })
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-dash-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('dashboard service snapshot', () => {
  it('aggregates net daily profit and persists daily limit', () => {
    const dash = createDash(() => new Date('2024-06-03T14:00:00.000Z'))
    const control = store.createFactory({ name: 'Control', role: 'Control', evidenceWeight: 1 })
    const explorer = store.createFactory({ name: 'E1', role: 'Explorer', evidenceWeight: 1 })
    const cSession = store.createSession({
      factoryId: control.id,
      sessionDate: '2024-06-03',
      dailyLimitUsd: 5_000
    })
    const eSession = store.createSession({
      factoryId: explorer.id,
      sessionDate: '2024-06-03',
      dailyLimitUsd: 5_000
    })
    store.insertOutcome({
      sessionId: cSession.id,
      grossPnl: 20,
      netPnl: 10,
      fullLimitReturn: 0.002,
      deployedReturn: 0.002,
      spyReturn: 0.001,
      cashResidual: 0
    })
    store.insertOutcome({
      sessionId: eSession.id,
      grossPnl: 30,
      netPnl: 15,
      fullLimitReturn: 0.003,
      deployedReturn: 0.003,
      spyReturn: 0.001,
      cashResidual: 0
    })
    const snap = dash.getSnapshot()
    expect(snap.dailyProfitNet).toBe(25)
    expect(snap.factories).toHaveLength(2)
    expect(snap.allocations[control.id]).toBeGreaterThan(0)

    dash.setDailyLimit(12_000)
    expect(dash.getSnapshot().dailyLimitUsd).toBe(12_000)
  })
})

describe('dashboard service factory actions', () => {
  it('queues late factory adds and protects control identity', () => {
    const dash = createDash(() => new Date('2024-06-03T18:00:00.000Z'))
    store.createFactory({ name: 'Control', role: 'Control', evidenceWeight: 1 })
    const late = dash.addFactory('LateBird')
    expect(late.queuedNextOpen).toBe(true)
    expect(late.role).toBe('Explorer')
  })
})

describe('dashboard service settings', () => {
  it('saves secrets without exposing them in settings payload', () => {
    const dash = createDash()
    const settings = dash.saveSettings({ cursorApiKey: 'sk-test' })
    expect(settings.hasCursorApiKey).toBe(true)
    expect(JSON.stringify(settings)).not.toContain('sk-test')
  })

  it('does not replace stored secrets with empty strings', () => {
    const secrets = createSecureSecretsStore({
      filePath: join(dir, 'keys.enc.json'),
      crypto: cryptoPort
    })
    const dash = createDashboardService({ store, secrets })
    dash.saveSettings({ cursorApiKey: 'cursor-secret', marketDataKey: 'market-secret' })

    const settings = dash.saveSettings({ cursorApiKey: '', marketDataKey: '' })

    expect(settings.hasCursorApiKey).toBe(true)
    expect(settings.hasMarketDataKey).toBe(true)
    expect(secrets.get('cursorApiKey')).toBe('cursor-secret')
    expect(secrets.get('marketDataKey')).toBe('market-secret')
  })
})

describe('dashboard service promote actions', () => {
  it('promote / kill / clone update store and history', () => {
    const dash = createDash()
    const explorer = store.createFactory({ name: 'E', role: 'Explorer', evidenceWeight: 1 })
    dash.confirmPromoteAction(explorer.id, 'promote')
    expect(store.getFactory(explorer.id)?.role).toBe('Promoted')
    dash.confirmPromoteAction(explorer.id, 'clone')
    expect(store.listFactories().some((f) => f.lineageParentId === explorer.id)).toBe(true)
    dash.confirmPromoteAction(explorer.id, 'kill')
    expect(store.getFactory(explorer.id)?.role).toBe('Killed')
    expect(store.listPromoteEvents().length).toBeGreaterThanOrEqual(3)
  })
})

describe('dashboard service leaderboard', () => {
  it('builds leaderboard sorted by net excess vs SPY with Control visible', () => {
    const dash = createDash(() => new Date('2024-06-03T14:00:00.000Z'))
    const control = store.createFactory({ name: 'Control', role: 'Control', evidenceWeight: 1 })
    const explorer = store.createFactory({ name: 'Alpha', role: 'Explorer', evidenceWeight: 2 })
    const cSession = store.createSession({
      factoryId: control.id,
      sessionDate: '2024-06-03',
      dailyLimitUsd: 10_000
    })
    const eSession = store.createSession({
      factoryId: explorer.id,
      sessionDate: '2024-06-03',
      dailyLimitUsd: 10_000
    })
    store.insertOutcome({
      sessionId: cSession.id,
      grossPnl: 50,
      netPnl: 40,
      fullLimitReturn: 0.004,
      deployedReturn: 0.004,
      spyReturn: 0.002,
      cashResidual: 0
    })
    store.insertOutcome({
      sessionId: eSession.id,
      grossPnl: 100,
      netPnl: 90,
      fullLimitReturn: 0.009,
      deployedReturn: 0.009,
      spyReturn: 0.002,
      cashResidual: 0
    })
    const board = dash.getSnapshot().leaderboard
    expect(board[0]?.factoryId).toBe(explorer.id)
    expect(board.some((r) => r.role === 'Control')).toBe(true)
  })
})
