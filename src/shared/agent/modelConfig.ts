/** Fixed model id for Kickoff / Research / Lessons — never Auto/router. */
export const CURSOR_MODEL_ID = 'composer-2.5' as const

export const CURSOR_API_KEY_ENV = 'CURSOR_API_KEY' as const

export type CursorModelId = typeof CURSOR_MODEL_ID

export function resolveCursorApiKey(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const raw = env[CURSOR_API_KEY_ENV]
  if (typeof raw !== 'string') {
    return undefined
  }
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}
