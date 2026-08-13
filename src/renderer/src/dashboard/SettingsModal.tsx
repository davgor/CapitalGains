import { useState } from 'react'
import type { AppSettingsPublic } from '../../../shared/engine/types'

export function SettingsModal(props: {
  settings: AppSettingsPublic
  onClose: () => void
  onSave: (patch: {
    friction?: AppSettingsPublic['friction']
    risk?: AppSettingsPublic['risk']
    promoteThresholds?: AppSettingsPublic['promoteThresholds']
    controlFloorWeight?: number
    explorationAllotmentUsd?: number
    dailyLimitUsd?: number
    cursorApiKey?: string
    marketDataKey?: string
  }) => Promise<AppSettingsPublic>
}): JSX.Element {
  const [friction, setFriction] = useState(props.settings.friction)
  const [risk, setRisk] = useState(props.settings.risk)
  const [promote, setPromote] = useState(props.settings.promoteThresholds)
  const [controlFloor, setControlFloor] = useState(props.settings.controlFloorWeight)
  const [explore, setExplore] = useState(props.settings.explorationAllotmentUsd)
  const [cursorApiKey, setCursorApiKey] = useState('')
  const [marketDataKey, setMarketDataKey] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      await props.onSave({
        friction,
        risk,
        promoteThresholds: promote,
        controlFloorWeight: controlFloor,
        explorationAllotmentUsd: explore,
        cursorApiKey: cursorApiKey || undefined,
        marketDataKey: marketDataKey || undefined
      })
      props.onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2>Settings</h2>
          <button type="button" className="btn-ghost" onClick={props.onClose}>
            close
          </button>
        </header>

        <section className="settings-block">
          <h3>Secrets</h3>
          <p className="muted">
            Stored via OS encryption under userData/secrets — never in git.
            Cursor key: {props.settings.hasCursorApiKey ? 'set' : 'missing'} · Market data:{' '}
            {props.settings.hasMarketDataKey ? 'set' : 'missing'}
          </p>
          <label>
            Cursor API key
            <input
              type="password"
              value={cursorApiKey}
              placeholder="paste to replace"
              onChange={(e) => setCursorApiKey(e.target.value)}
            />
          </label>
          <label>
            Market-data key
            <input
              type="password"
              value={marketDataKey}
              placeholder="paste to replace"
              onChange={(e) => setMarketDataKey(e.target.value)}
            />
          </label>
        </section>

        <section className="settings-block">
          <h3>Friction (bps / commission)</h3>
          <label>
            Spread bps
            <input
              type="number"
              value={friction.spreadBps}
              onChange={(e) => setFriction({ ...friction, spreadBps: Number(e.target.value) })}
            />
          </label>
          <label>
            Slippage bps
            <input
              type="number"
              value={friction.slippageBps}
              onChange={(e) => setFriction({ ...friction, slippageBps: Number(e.target.value) })}
            />
          </label>
          <label>
            Commission / share
            <input
              type="number"
              step={0.001}
              value={friction.commissionPerShare}
              onChange={(e) =>
                setFriction({ ...friction, commissionPerShare: Number(e.target.value) })
              }
            />
          </label>
        </section>

        <section className="settings-block">
          <h3>Risk defaults</h3>
          <label>
            Max single-name weight
            <input
              type="number"
              step={0.01}
              value={risk.maxSingleNameWeight}
              onChange={(e) =>
                setRisk({ ...risk, maxSingleNameWeight: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Daily loss halt %
            <input
              type="number"
              step={0.1}
              value={risk.dailyLossHaltPercent}
              onChange={(e) =>
                setRisk({ ...risk, dailyLossHaltPercent: Number(e.target.value) })
              }
            />
          </label>
        </section>

        <section className="settings-block">
          <h3>Promote thresholds</h3>
          <label>
            Min sessions (ex-infra)
            <input
              type="number"
              value={promote.minSessionsExInfra}
              onChange={(e) =>
                setPromote({ ...promote, minSessionsExInfra: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Min net excess vs SPY
            <input
              type="number"
              step={0.001}
              value={promote.minNetExcessVsSpy}
              onChange={(e) =>
                setPromote({ ...promote, minNetExcessVsSpy: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Min net excess vs Control
            <input
              type="number"
              step={0.001}
              value={promote.minNetExcessVsControl}
              onChange={(e) =>
                setPromote({ ...promote, minNetExcessVsControl: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Max drawdown
            <input
              type="number"
              step={0.01}
              value={promote.maxDrawdown}
              onChange={(e) => setPromote({ ...promote, maxDrawdown: Number(e.target.value) })}
            />
          </label>
          <label>
            Control floor weight
            <input
              type="number"
              step={0.1}
              value={controlFloor}
              onChange={(e) => setControlFloor(Number(e.target.value))}
            />
          </label>
          <label>
            Exploration allotment USD
            <input
              type="number"
              value={explore}
              onChange={(e) => setExplore(Number(e.target.value))}
            />
          </label>
        </section>

        <footer className="modal-foot">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()}>
            Save
          </button>
        </footer>
      </div>
    </div>
  )
}
