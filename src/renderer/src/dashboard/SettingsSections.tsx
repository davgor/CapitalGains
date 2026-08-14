import type { AppSettingsPublic } from '../../../shared/engine/types'

export function SettingsSecrets(props: {
  hasCursorApiKey: boolean
  hasMarketDataKey: boolean
  cursorApiKey: string
  marketDataKey: string
  onCursorApiKeyChange: (value: string) => void
  onMarketDataKeyChange: (value: string) => void
}): JSX.Element {
  return (
    <section className="settings-block">
      <h3>Secrets</h3>
      <p className="muted">
        Stored via OS encryption under userData/secrets — never in git.
        Cursor key: {props.hasCursorApiKey ? 'set' : 'missing'} · Market data:{' '}
        {props.hasMarketDataKey ? 'set' : 'missing'}
      </p>
      <label>
        Cursor API key
        <input
          type="password"
          value={props.cursorApiKey}
          placeholder="paste to replace"
          onChange={(e) => props.onCursorApiKeyChange(e.target.value)}
        />
      </label>
      <label>
        Market-data key
        <input
          type="password"
          value={props.marketDataKey}
          placeholder="paste to replace"
          onChange={(e) => props.onMarketDataKeyChange(e.target.value)}
        />
      </label>
    </section>
  )
}

export function SettingsFriction(props: {
  friction: AppSettingsPublic['friction']
  onChange: (friction: AppSettingsPublic['friction']) => void
}): JSX.Element {
  const { friction, onChange } = props
  return (
    <section className="settings-block">
      <h3>Friction (bps / commission)</h3>
      <label>
        Spread bps
        <input
          type="number"
          value={friction.spreadBps}
          onChange={(e) => onChange({ ...friction, spreadBps: Number(e.target.value) })}
        />
      </label>
      <label>
        Slippage bps
        <input
          type="number"
          value={friction.slippageBps}
          onChange={(e) => onChange({ ...friction, slippageBps: Number(e.target.value) })}
        />
      </label>
      <label>
        Commission / share
        <input
          type="number"
          step={0.001}
          value={friction.commissionPerShare}
          onChange={(e) => onChange({ ...friction, commissionPerShare: Number(e.target.value) })}
        />
      </label>
    </section>
  )
}

export function SettingsRisk(props: {
  risk: AppSettingsPublic['risk']
  onChange: (risk: AppSettingsPublic['risk']) => void
}): JSX.Element {
  const { risk, onChange } = props
  return (
    <section className="settings-block">
      <h3>Risk defaults</h3>
      <label>
        Max single-name weight
        <input
          type="number"
          step={0.01}
          value={risk.maxSingleNameWeight}
          onChange={(e) => onChange({ ...risk, maxSingleNameWeight: Number(e.target.value) })}
        />
      </label>
      <label>
        Daily loss halt %
        <input
          type="number"
          step={0.1}
          value={risk.dailyLossHaltPercent}
          onChange={(e) => onChange({ ...risk, dailyLossHaltPercent: Number(e.target.value) })}
        />
      </label>
    </section>
  )
}
