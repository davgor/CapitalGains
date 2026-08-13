import type { ReactNode } from 'react'

export function ModalShell(props: {
  title: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}): JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="modal-panel"
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
        {props.children}
        <footer className="modal-foot">{props.footer}</footer>
      </div>
    </div>
  )
}
