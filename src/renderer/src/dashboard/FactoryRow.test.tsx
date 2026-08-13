import { describe, expect, it } from 'vitest'
import type { FactoryRowView } from '../../../shared/engine/dashboardApi'
import { FactoryRow } from './FactoryRow'

function factory(overrides: Partial<FactoryRowView> = {}): FactoryRowView {
  return {
    id: 'factory-1',
    name: 'Alpha',
    role: 'Explorer',
    evidenceWeight: 1.25,
    queuedNextOpen: false,
    lineageParentId: null,
    netDailyProfit: 42.4,
    allocatedCash: 1_234.5,
    sessionId: 'session-1',
    sessionStage: 'research',
    stageNodes: [
      {
        stage: 'research',
        visual: 'active',
        opensModal: true,
        errorAffordance: false
      }
    ],
    failureLabel: null,
    protectedControl: false,
    ...overrides
  }
}

describe('FactoryRow Control rendering', () => {
  it('shows queue and protection badges without promote controls', () => {
    const node = FactoryRow({
      factory: factory({
        name: 'Control',
        role: 'Control',
        evidenceWeight: 1,
        queuedNextOpen: true,
        protectedControl: true
      }),
      recommendation: null,
      onRename: () => undefined,
      onOpenStage: () => undefined,
      onPromote: () => undefined
    })
    const children = node.props.children
    const meta = children[0]

    expect(node.props['data-role']).toBe('Control')
    expect(meta.props.children[1].props.children).toBe('Control')
    expect(meta.props.children[2].props.children).toEqual(['wt ', '1.00'])
    expect(meta.props.children[3].props.children).toEqual(['$1235', ' pile'])
    expect(meta.props.children[4].props.children).toEqual(['$42', ' net'])
    expect(meta.props.children[5].props.children).toBe('queued next open')
    expect(meta.props.children[6].props.children).toBe('protected')
    expect(children[2]).toBeNull()
  })
})

describe('FactoryRow explorer controls', () => {
  it('forwards only open stage selections and exact promote actions', () => {
    const opened: string[] = []
    const promoted: string[] = []
    const node = FactoryRow({
      factory: factory(),
      recommendation: {
        factoryId: 'factory-1',
        action: 'promote',
        reason: 'thresholds met'
      },
      onRename: () => undefined,
      onOpenStage: (stage) => opened.push(stage),
      onPromote: (action) => promoted.push(action)
    })
    const children = node.props.children
    const stageChips = children[1]
    const controls = children[2]

    stageChips.props.onSelect('research', false)
    stageChips.props.onSelect('research', true)
    controls.props.children[1].props.onClick()
    controls.props.children[2].props.onClick()
    controls.props.children[3].props.onClick()

    expect(opened).toEqual(['research'])
    expect(promoted).toEqual(['promote', 'kill', 'clone'])
    expect(controls.props.children[0].props.children).toEqual([
      'pending: ',
      'promote',
      ' — ',
      'thresholds met'
    ])
  })

  it('omits optional badges and recommendation text', () => {
    const node = FactoryRow({
      factory: factory(),
      recommendation: null,
      onRename: () => undefined,
      onOpenStage: () => undefined,
      onPromote: () => undefined
    })
    const children = node.props.children

    expect(children[0].props.children[5]).toBeNull()
    expect(children[0].props.children[6]).toBeNull()
    expect(children[2].props.children[0]).toBeNull()
  })
})
