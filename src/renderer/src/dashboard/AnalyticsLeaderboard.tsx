import type { LeaderboardRow } from '../../../shared/engine/analytics'
import type { PromoteEvent } from '../../../shared/engine/types'

export function AnalyticsLeaderboard(props: {
  rows: LeaderboardRow[]
  history: PromoteEvent[]
}): JSX.Element {
  return (
    <section className="analytics" aria-label="Analytics leaderboard">
      <h2>Leaderboard · net excess</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Factory</th>
            <th>Role</th>
            <th>Net excess vs SPY</th>
            <th>vs Control</th>
            <th>Win rate ex-infra</th>
            <th>Weight</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={row.factoryId} data-control={row.isControlBaseline ? '1' : '0'}>
              <td>{row.name}</td>
              <td>{row.role}</td>
              <td>{row.netExcessVsSpy.toFixed(2)}</td>
              <td>{row.netExcessVsControl.toFixed(2)}</td>
              <td>
                {row.winRateExInfra === null ? '—' : `${(row.winRateExInfra * 100).toFixed(0)}%`}
              </td>
              <td>{row.evidenceWeight.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Promote / kill history</h3>
      {props.history.length === 0 ? (
        <p className="empty-hint">No promote/kill events yet.</p>
      ) : (
        <ul className="history-list">
          {props.history.map((ev) => (
            <li key={ev.id}>
              {ev.createdAt} · {ev.action} · {ev.factoryId.slice(0, 8)} — {ev.note}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
