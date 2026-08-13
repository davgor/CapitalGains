import type { StageModalPayload } from '../../../shared/engine/dashboardApi'

type KickoffView = Extract<StageModalPayload, { stage: 'kickoff' }>['view']
type ResearchView = Extract<StageModalPayload, { stage: 'research' }>['view']
type PurchasesView = Extract<StageModalPayload, { stage: 'purchases' }>['view']
type MonitoringView = Extract<StageModalPayload, { stage: 'monitoring' }>['view']
type OutcomeView = Extract<StageModalPayload, { stage: 'outcome' }>['view']
type LessonsView = Extract<StageModalPayload, { stage: 'lessons' }>['view']

export function renderLockedBody(message?: string): JSX.Element {
  return <p className="locked-msg">{message ?? 'Locked / incomplete'}</p>
}

export function renderKickoffBody(view: KickoffView): JSX.Element {
  if (view.status === 'locked') {
    return renderLockedBody(view.message)
  }
  return (
    <pre>
      {JSON.stringify(
        {
          hypothesis: view.hypothesis,
          style: view.style,
          searchDirective: view.searchDirective,
          generatedKickoffPrompt: view.generatedKickoffPrompt
        },
        null,
        2
      )}
    </pre>
  )
}

export function renderResearchBody(view: ResearchView): JSX.Element {
  if (view.status === 'locked') {
    return renderLockedBody(view.message)
  }
  return (
    <pre>
      {JSON.stringify({ sitOut: view.sitOut, allocations: view.allocations }, null, 2)}
    </pre>
  )
}

export function renderPurchasesBody(view: PurchasesView): JSX.Element {
  if (view.status === 'locked') {
    return renderLockedBody(view.message)
  }
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
          {view.lines.map((line) => (
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
        Residual cash: ${view.cashResidual.toFixed(2)} · Totals notional $
        {view.totals.notional.toFixed(2)}
      </p>
    </>
  )
}

export function renderMonitoringBody(view: MonitoringView): JSX.Element {
  if (view.status === 'locked') {
    return renderLockedBody(view.message)
  }
  return (
    <pre>
      {JSON.stringify(
        {
          marks: view.marks,
          deltas: view.deltas,
          stops: view.stops,
          unrealizedNet: view.unrealizedNet,
          lastRefresh: view.lastRefresh
        },
        null,
        2
      )}
    </pre>
  )
}

export function renderOutcomeBody(view: OutcomeView): JSX.Element {
  if (view.status === 'locked') {
    return renderLockedBody(view.message)
  }
  return (
    <pre>
      {JSON.stringify(
        {
          grossPnl: view.grossPnl,
          netPnl: view.netPnl,
          vsSpy: view.vsSpy,
          vsControl: view.vsControl,
          fullLimitReturn: view.fullLimitReturn,
          deployedReturn: view.deployedReturn
        },
        null,
        2
      )}
    </pre>
  )
}

export function renderLessonsBody(view: LessonsView): JSX.Element {
  if (view.status === 'locked') {
    return renderLockedBody(view.message)
  }
  return (
    <pre>
      {JSON.stringify(
        {
          thoughtProcess: view.thoughtProcess,
          nextSeed: view.nextSeed,
          promoteKillNote: view.promoteKillNote
        },
        null,
        2
      )}
    </pre>
  )
}

export function renderStageBody(payload: StageModalPayload): JSX.Element {
  switch (payload.stage) {
    case 'kickoff':
      return renderKickoffBody(payload.view)
    case 'research':
      return renderResearchBody(payload.view)
    case 'purchases':
      return renderPurchasesBody(payload.view)
    case 'monitoring':
      return renderMonitoringBody(payload.view)
    case 'outcome':
      return renderOutcomeBody(payload.view)
    case 'lessons':
      return renderLessonsBody(payload.view)
  }
}
