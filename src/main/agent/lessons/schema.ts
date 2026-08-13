import { z } from 'zod'
import type { LessonRow } from '../../../shared/engine/types'

export type LessonEntry = LessonRow

export const lessonsInputSchema = z.object({
  hypothesis: z.string(),
  research: z.unknown(),
  frictionFillsSummary: z.string(),
  trajectorySummary: z.string(),
  netPnl: z.number(),
  fullLimitReturn: z.number(),
  deployedReturn: z.number(),
  spyReturn: z.number(),
  controlSameDayNet: z.number().nullable(),
  infraSkip: z.boolean()
})

export type LessonsInputPacket = z.infer<typeof lessonsInputSchema>

export const lessonsOutputSchema = z.object({
  failureMode: z.string().min(1),
  winLossFactor: z.string().min(1),
  suggestedSeed: z.string().min(1),
  excludeFromPromote: z.boolean().optional()
})

export type LessonsOutput = z.infer<typeof lessonsOutputSchema>

export function parseLessonsOutput(raw: unknown): LessonsOutput {
  return lessonsOutputSchema.parse(normalizeLessonsKeys(raw))
}

export function safeParseLessonsOutput(
  raw: unknown
): { success: true; data: LessonsOutput } | { success: false; error: z.ZodError } {
  const result = lessonsOutputSchema.safeParse(normalizeLessonsKeys(raw))
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}

function normalizeLessonsKeys(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw
  }
  const o = raw as Record<string, unknown>
  return {
    failureMode: o.failureMode ?? o.failure_mode,
    winLossFactor: o.winLossFactor ?? o.win_loss_factor,
    suggestedSeed: o.suggestedSeed ?? o.suggested_seed,
    excludeFromPromote: o.excludeFromPromote ?? o.exclude_from_promote
  }
}
