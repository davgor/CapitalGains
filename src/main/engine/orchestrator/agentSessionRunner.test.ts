import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openEngineStore, type EngineStore } from '../db/store'
import { createMockMarketData } from '../marketData/mockMarketData'
import { createMockAgentPort } from '../../agent/createAgentPort'
import { saveControlFrozenKickoff } from '../../agent/kickoff/controlFrozen'
import type { KickoffArtifact } from '../../agent/kickoff/schema'
import { runAgenticDay } from './agentSessionRunner'
import type { FeatureRow } from '../../../shared/engine/types'
import { AgentError } from '../../../shared/agent/errors'
import { queryGlobalLessonsPool } from '../../agent/lessons/pool'
import type { AgentPort } from '../../../shared/engine/ports'

const TAPE: FeatureRow[] = [
  {
    symbol: 'NVDA',
    sector: 'Tech',
    price: 100,
    premarketGapPct: 1,
    rvol: 1.2,
    adv: 5e6,
    marketCap: 1e12,
    spreadBps: 4,
    isLeveragedEtf: false
  },
  {
    symbol: 'GOOGL',
    sector: 'Tech',
    price: 200,
    premarketGapPct: 0.5,
    rvol: 1.1,
    adv: 4e6,
    marketCap: 1e12,
    spreadBps: 4,
    isLeveragedEtf: false
  }
]

const FROZEN: KickoffArtifact = {
  hypothesis: 'Control baseline',
  hypothesis_tested: 'control-baseline',
  style: 'baseline',
  searchDirective: 'fixed',
  negativeConstraints: ['no lev', 'no pennies'],
  allowFullCash: true,
  generatedKickoffPrompt: 'FROZEN'
}

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-agent-day-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
  saveControlFrozenKickoff(store, FROZEN)
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

function happyAgent(onKickoff?: () => void): AgentPort {
  return createMockAgentPort({
    handler: async (req) => {
      if (req.stage === 'kickoff') {
        onKickoff?.()
        return {
          text: JSON.stringify({
            hypothesis: 'Explorer momentum',
            hypothesis_tested: 'explorer-momentum',
            style: 'momentum',
            searchDirective: 'rvol spikes',
            negativeConstraints: ['no lev', 'no gaps>10'],
            allowFullCash: true,
            generatedKickoffPrompt: 'trade momentum'
          }),
          usage: {
            inputTokens: 10,
            outputTokens: 10,
            totalTokens: 20,
            costUsd: 0.01
          },
          modelId: 'composer-2.5'
        }
      }
      if (req.stage === 'research') {
        return {
          text: JSON.stringify({
            sitOut: false,
            allocations: [
              { symbol: 'NVDA', weight: 0.3, sector: 'Tech' },
              { symbol: 'GOOGL', weight: 0.2, sector: 'Tech' }
            ],
            stopLossPercent: 2
          }),
          usage: null,
          modelId: 'composer-2.5'
        }
      }
      return {
        text: JSON.stringify({
          failureMode: 'none',
          winLossFactor: 'execution',
          suggestedSeed: 'keep probing momentum'
        }),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: null },
        modelId: 'composer-2.5'
      }
    }
  })
}

function dayDeps(agent: AgentPort) {
  return {
    store,
    clock: { now: () => new Date('2024-06-03T13:40:00.000Z') },
    marketData: createMockMarketData([
      { symbol: 'NVDA', last: 100, bid: 99.95, ask: 100.05 },
      { symbol: 'GOOGL', last: 200, bid: 199.9, ask: 200.1 },
      { symbol: 'SPY', last: 500 }
    ]),
    agent,
    tape: TAPE,
    spyOpen: 500,
    spyClose: 502,
    regimeSummary: 'risk-on'
  }
}

describe('agentic day happy path', () => {
  it('runs Control frozen + Explorer through Research→Outcome→Lessons', async () => {
    const control = store.createFactory({ name: 'Control', role: 'Control', evidenceWeight: 1 })
    const explorer = store.createFactory({ name: 'Explorer-1', role: 'Explorer', evidenceWeight: 1 })
    let kickoffCalls = 0
    const results = await runAgenticDay({
      deps: dayDeps(happyAgent(() => {
        kickoffCalls += 1
      })),
      factories: [control, explorer],
      sessionDate: '2024-06-03',
      dailyLimitUsd: 10_000
    })
    expect(results.every((r) => r.ok && r.session.stage === 'done')).toBe(true)
    expect(kickoffCalls).toBe(1)
    expect(store.listFills(results[1]!.sessionId).filter((f) => f.side === 'buy')).toHaveLength(2)
    const pool = queryGlobalLessonsPool(store)
    expect(pool.some((l) => l.roleTag === 'Control')).toBe(true)
    expect(store.getConfig<KickoffArtifact>('control.frozenKickoff')?.generatedKickoffPrompt).toBe(
      'FROZEN'
    )
  })
})

function failingThenOkAgent(): AgentPort {
  let seen = 0
  return createMockAgentPort({
    handler: async (req) => {
      if (req.stage === 'kickoff') {
        seen += 1
        if (seen === 1) {
          throw new AgentError('Timeout', 'boom', { infraSkip: true })
        }
        return {
          text: JSON.stringify({
            hypothesis: 'ok',
            hypothesis_tested: 'ok-hyp',
            style: 's',
            searchDirective: 'd',
            negativeConstraints: ['a', 'b'],
            allowFullCash: true,
            generatedKickoffPrompt: 'p'
          }),
          usage: null,
          modelId: 'composer-2.5'
        }
      }
      if (req.stage === 'research') {
        return {
          text: JSON.stringify({ sitOut: true, allocations: [], stopLossPercent: 2 }),
          usage: null,
          modelId: 'composer-2.5'
        }
      }
      return {
        text: JSON.stringify({
          failureMode: 'infra_skip',
          winLossFactor: 'n/a',
          suggestedSeed: 'n/a',
          excludeFromPromote: true
        }),
        usage: null,
        modelId: 'composer-2.5'
      }
    }
  })
}

describe('agentic day failure isolation', () => {
  it('continues other factories when one fails', async () => {
    const a = store.createFactory({ name: 'A', role: 'Explorer', evidenceWeight: 1 })
    const b = store.createFactory({ name: 'B', role: 'Explorer', evidenceWeight: 1 })
    const results = await runAgenticDay({
      deps: { ...dayDeps(failingThenOkAgent()), spyClose: 500 },
      factories: [a, b],
      sessionDate: '2024-06-03',
      dailyLimitUsd: 5_000
    })
    expect(results[0]?.ok).toBe(false)
    expect(results[0]?.infraSkip).toBe(true)
    expect(results[0]?.error?.kind).toBe('Timeout')
    expect(results[1]?.ok).toBe(true)
    expect(results[1]?.session.stage).toBe('done')
  })
})
