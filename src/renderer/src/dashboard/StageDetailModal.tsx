import type { StageModalPayload } from '../../../shared/engine/dashboardApi'

export function StageDetailModal(props: {
  title: string
  payload: StageModalPayload
  onClose: () => void
}): JSX.Element {
  const { payload } = props
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
        <div className="modal-body mono">{renderBody(payload)}</div>
      </div>
    </div>
  )
}

function renderBody(payload: StageModalPayload): JSX.Element {
  const view = payload.view
  if (view.status === 'locked') {
    return <p className="locked-msg">{view.message ?? 'Locked / incomplete'}</p>
  }

  switch (payload.stage) {
    case 'kickoff':
      return (
        <pre>{JSON.stringify({
          hypothesis: payload.view.hypothesis,
          style: payload.view.style,
          searchDirective: payload.view.searchDirective,
          generatedKickoffPrompt: payload.view.generatedKickoffPrompt
        }, null, 2)}</pre>
      )
    case 'research':
      return (
        <pre>{JSON.stringify({
          sitOut: payload.view.sitOut,
          allocations: payload.view.allocations
        }, null, 2)}</pre>
      )
    case 'purchases':
      return (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Shares</th>
                <th>Raw quote</th>
                <th>Friction fill</th>
                <th>Notional</th>
              </tr>
            </thead>
            <tbody>
              {payload.view.lines.map((line) => (
                <tr key={line.symbol}>
                  <td>{line.symbol}</td>
                  <td>{line.shares}</td>
                  <td>{line.rawQuote.toFixed(2)}</td>
                  <td>{line.frictionFill.toFixed(2)}</td>
                  <td>{line.notional.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Residual cash: ${payload.view.cashResidual.toFixed(2)} · Totals notional $
            {payload.view.totals.notional.toFixed(2)}
          </p>
        </>
      )
    case 'monitoring':
      return (
        <pre>{JSON.stringify({
          marks: payload.view.marks,
          deltas: payload.view.deltas,
          stops: payload.view.stops,
          unrealizedNet: payload.view.unrealizedNet,
          lastRefresh: payload.view.lastRefresh
        }, null, 2)}</pre>
      )
    case 'outcome':
      return (
        <pre>{JSON.stringify({
          grossPnl: payload.view.grossPnl,
          netPnl: payload.view.netPnl,
          vsSpy: payload.view.vsSpy,
          vsControl: payload.view.vsControl,
          fullLimitReturn: payload.view.fullLimitReturn,
          deployedReturn: payload.view.deployedReturn
        }, null, 2)}</pre>
      )
    case 'lessons':
      return (
        <pre>{JSON.stringify({
          thoughtProcess: payload.view.thoughtProcess,
          nextSeed: payload.view.nextSeed,
          promoteKillNote: payload.view.promoteKillNote
        }, null, 2)}</pre>
      )
  }
}
