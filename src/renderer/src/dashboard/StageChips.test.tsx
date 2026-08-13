import { describe, expect, it } from 'vitest'
import { mapStageNodeState } from '../../../shared/engine/stageVisual'
import { StageChips } from './StageChips'

describe('StageChips', () => {
  it('disables grey incomplete nodes so they do not act as complete modals', () => {
    const nodes = mapStageNodeState({
      sessionStage: 'research',
      failureLabel: null
    })
    const tree = StageChips({
      nodes,
      onSelect: () => undefined
    })
    const chips = tree.props.children as Array<{ props: { disabled?: boolean; className: string } }>
    const purchases = chips.find((c) => c.props.className.includes('visual-grey'))
    expect(purchases?.props.disabled).toBe(true)
    const active = chips.find((c) => c.props.className.includes('visual-active'))
    expect(active?.props.disabled).toBe(false)
  })
})
