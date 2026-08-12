import { z } from 'zod'

export const KICKOFF_SOFT_WORD_LIMIT = 300
export const KICKOFF_HARD_WORD_LIMIT = 350

export const kickoffArtifactSchema = z.object({
  hypothesis: z.string().min(1),
  hypothesis_tested: z.string().min(1).optional(),
  style: z.string().min(1),
  searchDirective: z.string().min(1),
  negativeConstraints: z.array(z.string().min(1)).min(2),
  allowFullCash: z.boolean(),
  generatedKickoffPrompt: z.string().min(1)
})

export type KickoffArtifact = z.infer<typeof kickoffArtifactSchema>

export function parseKickoffArtifact(raw: unknown): KickoffArtifact {
  return kickoffArtifactSchema.parse(normalizeKickoffKeys(raw))
}

export function safeParseKickoffArtifact(
  raw: unknown
): { success: true; data: KickoffArtifact } | { success: false; error: z.ZodError } {
  const result = kickoffArtifactSchema.safeParse(normalizeKickoffKeys(raw))
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}

function pick(o: Record<string, unknown>, camel: string, snake: string): unknown {
  return o[camel] ?? o[snake]
}

function normalizeKickoffKeys(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw
  }
  const o = raw as Record<string, unknown>
  return {
    hypothesis: o.hypothesis ?? o.Hypothesis,
    hypothesis_tested: pick(o, 'hypothesis_tested', 'hypothesisTested'),
    style: o.style ?? o.Style,
    searchDirective: pick(o, 'searchDirective', 'search_directive'),
    negativeConstraints: pick(o, 'negativeConstraints', 'negative_constraints'),
    allowFullCash: pick(o, 'allowFullCash', 'allow_full_cash'),
    generatedKickoffPrompt: pick(o, 'generatedKickoffPrompt', 'generated_kickoff_prompt')
  }
}
