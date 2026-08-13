import type { FactoryRole } from '../../../shared/engine/types'
import type { LessonEntry } from './schema'

export const DEFAULT_LESSONS_POOL_CAP = 50

export interface LessonsPoolStore {
  insertLesson(input: {
    sessionId: string
    roleTag: string
    bodyJson: string
    excludeFromPromote?: boolean
  }): LessonEntry
  listLessonsPool(opts?: {
    limit?: number
    includeExcluded?: boolean
  }): LessonEntry[]
}

export function appendLessonToPool(
  store: LessonsPoolStore,
  input: {
    sessionId: string
    role: FactoryRole
    body: unknown
    excludeFromPromote?: boolean
  }
): LessonEntry {
  return store.insertLesson({
    sessionId: input.sessionId,
    roleTag: input.role,
    bodyJson: JSON.stringify(input.body),
    excludeFromPromote: input.excludeFromPromote ?? false
  })
}

export function queryGlobalLessonsPool(
  store: LessonsPoolStore,
  opts?: { limit?: number; forPromote?: boolean }
): LessonEntry[] {
  const limit = opts?.limit ?? DEFAULT_LESSONS_POOL_CAP
  return store.listLessonsPool({
    limit,
    includeExcluded: opts?.forPromote === true ? false : true
  })
}

/** Summaries for Kickoff packets — never copies Control prompt text. */
export function summarizeLessonsForKickoff(entries: LessonEntry[]): Array<{
  roleTag: string
  failureMode: string | undefined
  winLossFactor: string | undefined
  createdAt: string
}> {
  return entries.map((e) => {
    let failureMode: string | undefined
    let winLossFactor: string | undefined
    try {
      const body = JSON.parse(e.bodyJson) as Record<string, unknown>
      failureMode = typeof body.failureMode === 'string' ? body.failureMode : undefined
      winLossFactor = typeof body.winLossFactor === 'string' ? body.winLossFactor : undefined
    } catch {
      // ignore malformed
    }
    return {
      roleTag: e.roleTag,
      failureMode,
      winLossFactor,
      createdAt: e.createdAt
    }
  })
}
