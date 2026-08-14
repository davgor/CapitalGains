import { describe, expect, it } from 'vitest'
import type { FactoryRowView } from '../../../shared/engine/dashboardApi'
import { emptySnapshot } from '../dashboardClient'
import { FactoryBoardSection } from './FactoryBoardSection'

function row(id: string): FactoryRowView {
  return {
    id,
    name: 'Alpha',
    role: 'Explorer',
    evidenceWeight: 1,
    queuedNextOpen: false,
    lineageParentId: null,
    netDailyProfit: 0,
    allocatedCash: 500,
    sessionId: null,
    sessionStage: null,
    stageNodes: [],
    failureLabel: null,
    protectedControl: false
  }
}

describe('FactoryBoardSection empty state', () => {
  it('renders the exact empty hint and forwards add', () => {
    let adds = 0
    const node = FactoryBoardSection({
      snapshot: emptySnapshot(),
      onAddFactory: () => {
        adds += 1
      },
      onRename: () => undefined,
      onOpenStage: () => undefined,
      onPromote: () => undefined
    })

    node.props.children[0].props.children[1].props.onClick()

    expect(adds).toBe(1)
    expect(node.props.children[1].props.children).toBe(
      'No factories yet. Add Control/explorers to begin a paper day.'
    )
  })
})

describe('FactoryBoardSection rows', () => {
  it('matches each factory recommendation and forwards row identifiers', () => {
    const calls: string[] = []
    const snapshot = {
      ...emptySnapshot(),
      factories: [row('alpha')],
      promoteRecommendations: [
        { factoryId: 'other', action: 'hold' as const, reason: 'other' },
        { factoryId: 'alpha', action: 'promote' as const, reason: 'ready' }
      ]
    }
    const node = FactoryBoardSection({
      snapshot,
      onAddFactory: () => undefined,
      onRename: (id, name) => calls.push(`rename:${id}:${name}`),
      onOpenStage: (id, name, stage) => calls.push(`stage:${id}:${name}:${stage}`),
      onPromote: (id, action) => calls.push(`promote:${id}:${action}`)
    })
    const factoryRows = node.props.children[1]
    const factory = factoryRows[0]

    factory.props.onRename()
    factory.props.onOpenStage('research')
    factory.props.onPromote('kill')

    expect(factory.props.recommendation).toEqual({
      factoryId: 'alpha',
      action: 'promote',
      reason: 'ready'
    })
    expect(calls).toEqual([
      'rename:alpha:Alpha',
      'stage:alpha:Alpha:research',
      'promote:alpha:kill'
    ])
  })
})
