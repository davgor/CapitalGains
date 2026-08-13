import type { StageName } from './types'

/** Wireframe stage chips (engine also has regime/done). */
export const UI_STAGE_ORDER = [
  'kickoff',
  'research',
  'purchases',
  'monitoring',
  'outcome',
  'lessons'
] as const

export type UiStageName = (typeof UI_STAGE_ORDER)[number]

export type StageVisualState = 'grey' | 'active' | 'completed' | 'failed' | 'skipped'

export interface StageNodeView {
  stage: UiStageName
  visual: StageVisualState
  /** Grey incomplete nodes must not open full artifact modals. */
  opensModal: boolean
  errorAffordance: boolean
}

const ENGINE_ORDER: StageName[] = [
  'kickoff',
  'regime',
  'research',
  'purchases',
  'monitoring',
  'outcome',
  'lessons',
  'done'
]

function engineIndex(stage: StageName): number {
  return ENGINE_ORDER.indexOf(stage)
}

export function mapStageNodeState(opts: {
  sessionStage: StageName
  failureLabel: string | null
  skippedStages?: UiStageName[]
}): StageNodeView[] {
  const current = engineIndex(opts.sessionStage)
  const skipped = new Set(opts.skippedStages ?? [])
  const failed = Boolean(opts.failureLabel)

  return UI_STAGE_ORDER.map((stage) => {
    if (skipped.has(stage)) {
      return {
        stage,
        visual: 'skipped',
        opensModal: true,
        errorAffordance: false
      }
    }
    const idx = engineIndex(stage)
    if (failed && idx === current) {
      return {
        stage,
        visual: 'failed',
        opensModal: true,
        errorAffordance: true
      }
    }
    if (opts.sessionStage === 'done' || idx < current) {
      return {
        stage,
        visual: 'completed',
        opensModal: true,
        errorAffordance: false
      }
    }
    if (idx === current) {
      return {
        stage,
        visual: 'active',
        opensModal: true,
        errorAffordance: false
      }
    }
    return {
      stage,
      visual: 'grey',
      opensModal: false,
      errorAffordance: false
    }
  })
}
