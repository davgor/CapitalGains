import { AppVersionLabel } from '../autoUpdate/AppVersionLabel'

export function HeaderBar(props: {
  dailyLimitUsd: number
  dailyProfitNet: number
  sessionDate: string
  version: string | null
  onDailyLimitChange: (value: number) => void
  onOpenSettings: () => void
}): JSX.Element {
  return (
    <header className="dash-header">
      <div className="brand-block">
        <p className="brand-kicker">ops console // session {props.sessionDate || '—'}</p>
        <h1 className="brand-title">CapitalGains</h1>
      </div>
      <div className="header-metrics">
        <label className="metric">
          <span>Daily Limit</span>
          <input
            type="number"
            min={0}
            step={100}
            value={props.dailyLimitUsd}
            onChange={(e) => props.onDailyLimitChange(Number(e.target.value))}
          />
        </label>
        <div className="metric metric-readonly">
          <span>Daily Profit (net)</span>
          <strong data-testid="daily-profit">{formatUsd(props.dailyProfitNet)}</strong>
        </div>
        <button type="button" className="btn-gear" onClick={props.onOpenSettings} aria-label="Settings">
          ⚙
        </button>
        <AppVersionLabel version={props.version ?? 'unknown'} />
      </div>
    </header>
  )
}

function formatUsd(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}
