import type { FactoryRole } from '../../../shared/engine/types'
import type { KickoffArtifact } from './schema'

export const CONTROL_FROZEN_PROMPT_CONFIG_KEY = 'control.frozenKickoff'

export interface FrozenKickoffStore {
  getConfig<T>(key: string): T | undefined
  setConfig?(key: string, value: unknown): unknown
}

export function loadControlFrozenKickoff(
  store: FrozenKickoffStore,
  fallback?: KickoffArtifact
): KickoffArtifact {
  const stored = store.getConfig<KickoffArtifact>(CONTROL_FROZEN_PROMPT_CONFIG_KEY)
  if (stored) {
    return stored
  }
  if (fallback) {
    return fallback
  }
  throw new Error('Control frozen kickoff prompt is not configured')
}

export function saveControlFrozenKickoff(store: FrozenKickoffStore, artifact: KickoffArtifact): void {
  if (!store.setConfig) {
    throw new Error('store cannot persist Control frozen kickoff')
  }
  store.setConfig(CONTROL_FROZEN_PROMPT_CONFIG_KEY, artifact)
}

/**
 * Lessons may suggest a new seed; mutating Control's frozen prompt is a no-op.
 */
export function applySuggestedSeedToFactoryPrompt(opts: {
  store: FrozenKickoffStore
  role: FactoryRole
  suggestedSeed: string
}): { applied: boolean; prompt: KickoffArtifact | undefined } {
  if (opts.role === 'Control') {
    const prompt = opts.store.getConfig<KickoffArtifact>(CONTROL_FROZEN_PROMPT_CONFIG_KEY)
    return { applied: false, prompt }
  }
  return { applied: false, prompt: undefined }
}

export function shouldRunKickoffAgent(role: FactoryRole): boolean {
  return role !== 'Control'
}
