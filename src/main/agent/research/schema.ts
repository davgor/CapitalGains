import { z } from 'zod'

export const researchAllocationSchema = z.object({
  symbol: z.string().min(1),
  weight: z.number().positive().max(1),
  sector: z.string().min(1),
  stopLossPercent: z.number().positive().optional()
})

export const researchPlanSchema = z
  .object({
    sitOut: z.boolean(),
    allocations: z.array(researchAllocationSchema),
    stopLossPercent: z.number().positive()
  })
  .superRefine((plan, ctx) => {
    if (plan.sitOut && plan.allocations.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'sitOut plans must not include allocations'
      })
    }
    if (!plan.sitOut && plan.allocations.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'non-sitOut plans require allocations'
      })
    }
  })

export type ResearchAgentPlan = z.infer<typeof researchPlanSchema>

export function parseResearchPlan(raw: unknown): ResearchAgentPlan {
  return researchPlanSchema.parse(normalizeResearchKeys(raw))
}

export function safeParseResearchPlan(
  raw: unknown
): { success: true; data: ResearchAgentPlan } | { success: false; error: z.ZodError } {
  const result = researchPlanSchema.safeParse(normalizeResearchKeys(raw))
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}

function normalizeResearchKeys(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw
  }
  const o = raw as Record<string, unknown>
  return {
    sitOut: o.sitOut ?? o.sit_out,
    allocations: o.allocations,
    stopLossPercent: o.stopLossPercent ?? o.stop_loss_percent
  }
}
