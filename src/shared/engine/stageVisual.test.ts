import { describe, expect, it } from 'vitest'
import { mapStageNodeState, UI_STAGE_ORDER } from './stageVisual'

describe('stageVisual', () => {
  it('exposes wireframe stage order without regime/done', () => {
    expect(UI_STAGE_ORDER).toEqual([
      'kickoff',
      'research',
      'purchases',
      'monitoring',
      'outcome',
      'lessons'
    ])
  })

  it('maps incomplete stages to grey / non-actionable', () => {
    const nodes = mapStageNodeState({
      sessionStage: 'research',
      failureLabel: null
    })
    expect(nodes.find((n) => n.stage === 'purchases')?.visual).toBe('grey')
    expect(nodes.find((n) => n.stage === 'purchases')?.opensModal).toBe(false)
    expect(nodes.find((n) => n.stage === 'research')?.visual).toBe('active')
    expect(nodes.find((n) => n.stage === 'kickoff')?.visual).toBe('completed')
    expect(nodes.find((n) => n.stage === 'kickoff')?.opensModal).toBe(true)
  })

  it('marks failed with error affordance and selectable', () => {
    const nodes = mapStageNodeState({
      sessionStage: 'research',
      failureLabel: 'Failed/timeout'
    })
    const research = nodes.find((n) => n.stage === 'research')
    expect(research?.visual).toBe('failed')
    expect(research?.opensModal).toBe(true)
    expect(research?.errorAffordance).toBe(true)
  })

  it('marks skipped distinctly when stage is done after infra skip path', () => {
    const nodes = mapStageNodeState({
      sessionStage: 'done',
      failureLabel: null,
      skippedStages: ['purchases']
    })
    expect(nodes.find((n) => n.stage === 'purchases')?.visual).toBe('skipped')
    expect(nodes.find((n) => n.stage === 'purchases')?.opensModal).toBe(true)
  })
})
