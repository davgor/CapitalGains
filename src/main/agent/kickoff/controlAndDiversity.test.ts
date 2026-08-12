import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentError } from '../../../shared/agent/errors'
import { createMockAgentPort } from '../createAgentPort'
import { openEngineStore, type EngineStore } from '../../engine/db/store'
import {
  applySuggestedSeedToFactoryPrompt,
  loadControlFrozenKickoff,
  saveControlFrozenKickoff,
  shouldRunKickoffAgent
} from './controlFrozen'
import {
  assembleKickoffInputPacket,
  assertExplorerDiversity
} from './assemblePacket'
import { runFactoryKickoff } from './runFactoryKickoff'
import { appendLessonToPool, queryGlobalLessonsPool } from '../lessons/pool'
import type { KickoffArtifact } from './schema'
import type { FeatureRow } from '../../../shared/engine/types'

const FROZEN: KickoffArtifact = {
  hypothesis: 'Control baseline mean-reversion',
  hypothesis_tested: 'control-baseline',
  style: 'baseline',
  searchDirective: 'fixed control scan',
  negativeConstraints: ['no leveraged ETFs', 'no penny names'],
  allowFullCash: true,
  generatedKickoffPrompt: 'FROZEN CONTROL PROMPT — do not mutate'
}

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
  }
]

let dir: string
let store: EngineStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-kickoff-'))
  store = openEngineStore(join(dir, 'engine.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('Control frozen prompt load', () => {
  it('skips Kickoff agent and loads frozen prompt from store', async () => {
    saveControlFrozenKickoff(store, FROZEN)
    expect(shouldRunKickoffAgent('Control')).toBe(false)
    const agent = createMockAgentPort({
      handler: async () => {
        throw new Error('should not call agent for Control')
      }
    })
    const packet = assembleKickoffInputPacket({
      regimeSummary: 'risk-on',
      lessons: [],
      ownRecap: '',
      tape: TAPE,
      siblingHypotheses: [],
      diversityMode: 'explore',
      factoryRole: 'Control'
    })
    const result = await runFactoryKickoff({
      agent,
      role: 'Control',
      factoryId: 'f',
      sessionId: 's',
      packet,
      frozenStore: store,
      siblingHypotheses: [],
      diversityMode: 'explore'
    })
    expect(result.fromFrozen).toBe(true)
    expect(result.artifact.generatedKickoffPrompt).toContain('FROZEN CONTROL')
  })
})

describe('Control frozen prompt mutation', () => {
  it('Lessons mutate of Control prompt is a no-op', () => {
    saveControlFrozenKickoff(store, FROZEN)
    const before = loadControlFrozenKickoff(store)
    const result = applySuggestedSeedToFactoryPrompt({
      store,
      role: 'Control',
      suggestedSeed: 'brand new explorer seed'
    })
    expect(result.applied).toBe(false)
    expect(loadControlFrozenKickoff(store)).toEqual(before)
  })
})

describe('Explorer Kickoff packet assembly', () => {
  it('assembles Kickoff input packet from store-shaped inputs', () => {
    const factory = store.createFactory({ name: 'C', role: 'Control', evidenceWeight: 1 })
    const session = store.createSession({
      factoryId: factory.id,
      sessionDate: '2024-06-03',
      dailyLimitUsd: 10_000
    })
    appendLessonToPool(store, {
      sessionId: session.id,
      role: 'Control',
      body: { failureMode: 'baseline', winLossFactor: 'n/a', suggestedSeed: 'x' }
    })
    const packet = assembleKickoffInputPacket({
      regimeSummary: 'risk-on',
      lessons: queryGlobalLessonsPool(store),
      ownRecap: 'prior day flat',
      tape: TAPE,
      siblingHypotheses: ['other-hyp'],
      diversityMode: 'explore',
      factoryRole: 'Explorer'
    })
    expect(packet.globalLessons[0]?.roleTag).toBe('Control')
    expect(JSON.stringify(packet)).not.toContain('FROZEN CONTROL PROMPT')
    expect(packet.siblingExclusions).toEqual(['other-hyp'])
  })
})

describe('Explorer diversity collision', () => {
  it('Explore mode rejects duplicate hypotheses after retry', async () => {
    let calls = 0
    const agent = createMockAgentPort({
      handler: async () => {
        calls += 1
        return {
          text: JSON.stringify({
            hypothesis: 'Same idea',
            hypothesis_tested: 'same-idea',
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
    })
    const packet = assembleKickoffInputPacket({
      regimeSummary: 'r',
      lessons: [],
      ownRecap: '',
      tape: TAPE,
      siblingHypotheses: ['same-idea'],
      diversityMode: 'explore',
      factoryRole: 'Explorer'
    })
    await expect(
      runFactoryKickoff({
        agent,
        role: 'Explorer',
        factoryId: 'f',
        sessionId: 's',
        packet,
        frozenStore: store,
        siblingHypotheses: ['same-idea'],
        diversityMode: 'explore'
      })
    ).rejects.toMatchObject({ kind: 'DiversityCollision' } satisfies Partial<AgentError>)
    expect(calls).toBeGreaterThanOrEqual(2)
  })
})

describe('Explorer exploit mode', () => {
  it('Exploit mode disables diversity requirement', () => {
    const check = assertExplorerDiversity({
      mode: 'exploit',
      candidate: { ...FROZEN, hypothesis_tested: 'same-idea' },
      siblingHypotheses: ['same-idea']
    })
    expect(check.ok).toBe(true)
  })
})
