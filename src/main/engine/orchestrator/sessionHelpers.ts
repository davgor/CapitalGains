import type { Session, StageName } from '../../../shared/engine/types'

const STAGE_ORDER: StageName[] = [
  'kickoff',
  'regime',
  'research',
  'purchases',
  'monitoring',
  'outcome',
  'lessons',
  'done'
]

export function stageIndex(stage: StageName): number {
  return STAGE_ORDER.indexOf(stage)
}

export function createSessionForFactory(
  store: {
    createFactory: (i: {
      name: string
      role: 'Explorer'
      evidenceWeight: number
    }) => { id: string }
    createSession: (i: {
      factoryId: string
      sessionDate: string
      dailyLimitUsd: number
    }) => Session
  },
  opts: { factoryName: string; sessionDate: string; dailyLimitUsd: number }
): Session {
  const factory = store.createFactory({
    name: opts.factoryName,
    role: 'Explorer',
    evidenceWeight: 1
  })
  return store.createSession({
    factoryId: factory.id,
    sessionDate: opts.sessionDate,
    dailyLimitUsd: opts.dailyLimitUsd
  })
}

export function markInfraSkip(
  store: { updateSession: (id: string, patch: { infraSkip: boolean }) => Session },
  sessionId: string
): Session {
  return store.updateSession(sessionId, { infraSkip: true })
}

export function resumeSession(
  store: { getSession: (id: string) => Session | undefined },
  sessionId: string
): Session {
  const session = store.getSession(sessionId)
  if (!session) {
    throw new Error(`session not found: ${sessionId}`)
  }
  return session
}
