import type { StageName } from '../../../shared/engine/types'

const ORDER: StageName[] = [
  'kickoff',
  'regime',
  'research',
  'purchases',
  'monitoring',
  'outcome',
  'lessons',
  'done'
]

const INDEX = new Map(ORDER.map((s, i) => [s, i]))

export function assertLegalTransition(from: StageName, to: StageName): void {
  const a = INDEX.get(from)
  const b = INDEX.get(to)
  if (a === undefined || b === undefined) {
    throw new Error(`unknown stage transition ${from} -> ${to}`)
  }
  if (b !== a && b !== a + 1) {
    throw new Error(`illegal stage jump ${from} -> ${to}`)
  }
}

export function nextStage(from: StageName): StageName {
  const i = INDEX.get(from)
  if (i === undefined || i >= ORDER.length - 1) {
    throw new Error(`no next stage after ${from}`)
  }
  return ORDER[i + 1]!
}
