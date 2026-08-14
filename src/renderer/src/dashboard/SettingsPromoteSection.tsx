import type { AppSettingsPublic } from '../../../shared/engine/types'

export function SettingsPromoteThresholds(props: {
  promote: AppSettingsPublic['promoteThresholds']
  onChange: (promote: AppSettingsPublic['promoteThresholds']) => void
}): JSX.Element {
  const { promote, onChange } = props
  return (
    <>
      <label>
        Min sessions (ex-infra)
        <input
          type="number"
          value={promote.minSessionsExInfra}
          onChange={(e) => onChange({ ...promote, minSessionsExInfra: Number(e.target.value) })}
        />
      </label>
      <label>
        Min net excess vs SPY
        <input
          type="number"
          step={0.001}
          value={promote.minNetExcessVsSpy}
          onChange={(e) => onChange({ ...promote, minNetExcessVsSpy: Number(e.target.value) })}
        />
      </label>
      <label>
        Min net excess vs Control
        <input
          type="number"
          step={0.001}
          value={promote.minNetExcessVsControl}
          onChange={(e) =>
            onChange({ ...promote, minNetExcessVsControl: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Max drawdown
        <input
          type="number"
          step={0.01}
          value={promote.maxDrawdown}
          onChange={(e) => onChange({ ...promote, maxDrawdown: Number(e.target.value) })}
        />
      </label>
    </>
  )
}

export function SettingsAllocationWeights(props: {
  controlFloor: number
  explore: number
  onControlFloorChange: (value: number) => void
  onExploreChange: (value: number) => void
}): JSX.Element {
  return (
    <>
      <label>
        Control floor weight
        <input
          type="number"
          step={0.1}
          value={props.controlFloor}
          onChange={(e) => props.onControlFloorChange(Number(e.target.value))}
        />
      </label>
      <label>
        Exploration allotment USD
        <input
          type="number"
          value={props.explore}
          onChange={(e) => props.onExploreChange(Number(e.target.value))}
        />
      </label>
    </>
  )
}

export function SettingsPromote(props: {
  promote: AppSettingsPublic['promoteThresholds']
  controlFloor: number
  explore: number
  onPromoteChange: (promote: AppSettingsPublic['promoteThresholds']) => void
  onControlFloorChange: (value: number) => void
  onExploreChange: (value: number) => void
}): JSX.Element {
  return (
    <section className="settings-block">
      <h3>Promote thresholds</h3>
      <SettingsPromoteThresholds promote={props.promote} onChange={props.onPromoteChange} />
      <SettingsAllocationWeights
        controlFloor={props.controlFloor}
        explore={props.explore}
        onControlFloorChange={props.onControlFloorChange}
        onExploreChange={props.onExploreChange}
      />
    </section>
  )
}
