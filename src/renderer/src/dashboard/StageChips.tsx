import type { StageNodeView, UiStageName } from '../../../shared/engine/stageVisual'

export function StageChips(props: {
  nodes: StageNodeView[]
  onSelect: (stage: UiStageName, opensModal: boolean) => void
}): JSX.Element {
  return (
    <div className="stage-chips" role="list">
      {props.nodes.map((node) => (
        <button
          key={node.stage}
          type="button"
          role="listitem"
          className={`stage-chip visual-${node.visual}${node.errorAffordance ? ' has-error' : ''}`}
          disabled={node.visual === 'grey'}
          title={node.errorAffordance ? 'Failed — open for detail' : node.stage}
          onClick={() => props.onSelect(node.stage, node.opensModal)}
        >
          {node.stage}
          {node.errorAffordance ? ' !' : ''}
        </button>
      ))}
    </div>
  )
}
