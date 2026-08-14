import type { StageModalPayload } from '../../../shared/engine/dashboardApi'
import { renderStageBody } from './StageDetailBodies'

export function StageDetailModal(props: {
  title: string
  payload: StageModalPayload
  onClose: () => void
}): JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="modal-panel wide"
        role="dialog"
        aria-label={props.title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{props.title}</h2>
          <button type="button" className="btn-ghost" onClick={props.onClose}>
            close
          </button>
        </header>
        <div className="modal-body mono">{renderStageBody(props.payload)}</div>
      </div>
    </div>
  )
}
