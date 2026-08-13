import { describe, expect, it } from 'vitest'
import {
  applySuggestedSeedToFactoryPrompt,
  loadControlFrozenKickoff,
  saveControlFrozenKickoff,
  shouldRunKickoffAgent
} from './controlFrozen'
import type { KickoffArtifact } from './schema'

const ARTIFACT: KickoffArtifact = {
  hypothesis: 'h',
  style: 's',
  searchDirective: 'd',
  negativeConstraints: ['a', 'b'],
  allowFullCash: true,
  generatedKickoffPrompt: 'prompt'
}

describe('controlFrozen load/save', () => {
  it('loads stored artifact and throws when missing without fallback', () => {
    const store = {
      map: new Map<string, unknown>(),
      getConfig<T>(key: string) {
        return this.map.get(key) as T | undefined
      },
      setConfig(key: string, value: unknown) {
        this.map.set(key, value)
      }
    }
    expect(() => loadControlFrozenKickoff(store)).toThrow(/not configured/)
    expect(loadControlFrozenKickoff(store, ARTIFACT)).toEqual(ARTIFACT)
    saveControlFrozenKickoff(store, ARTIFACT)
    expect(loadControlFrozenKickoff(store).hypothesis).toBe('h')
  })

  it('saveControlFrozenKickoff throws when setConfig is unavailable', () => {
    const store = {
      getConfig<T>(_key: string): T | undefined {
        return undefined
      }
    }
    expect(() => saveControlFrozenKickoff(store, ARTIFACT)).toThrow(/cannot persist/)
  })
})

describe('controlFrozen mutation and role branch', () => {
  it('shouldRunKickoffAgent is false only for Control', () => {
    expect(shouldRunKickoffAgent('Control')).toBe(false)
    expect(shouldRunKickoffAgent('Explorer')).toBe(true)
    expect(shouldRunKickoffAgent('Promoted')).toBe(true)
  })

  it('applySuggestedSeed is a no-op for Control and Explorers alike today', () => {
    const store = {
      map: new Map<string, unknown>([['control.frozenKickoff', ARTIFACT]]),
      getConfig<T>(key: string) {
        return this.map.get(key) as T | undefined
      },
      setConfig(key: string, value: unknown) {
        this.map.set(key, value)
      }
    }
    expect(
      applySuggestedSeedToFactoryPrompt({
        store,
        role: 'Control',
        suggestedSeed: 'new'
      }).applied
    ).toBe(false)
    expect(
      applySuggestedSeedToFactoryPrompt({
        store,
        role: 'Explorer',
        suggestedSeed: 'new'
      })
    ).toEqual({ applied: false, prompt: undefined })
  })
})
