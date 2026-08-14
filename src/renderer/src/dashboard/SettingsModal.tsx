import { useState } from 'react'
import type { AppSettingsPublic } from '../../../shared/engine/types'
import { ModalShell } from './ModalShell'
import { SettingsFormFields } from './SettingsFormFields'

function useSettingsForm(settings: AppSettingsPublic) {
  const [friction, setFriction] = useState(settings.friction)
  const [risk, setRisk] = useState(settings.risk)
  const [promote, setPromote] = useState(settings.promoteThresholds)
  const [controlFloor, setControlFloor] = useState(settings.controlFloorWeight)
  const [explore, setExplore] = useState(settings.explorationAllotmentUsd)
  const [cursorApiKey, setCursorApiKey] = useState('')
  const [marketDataKey, setMarketDataKey] = useState('')
  const [busy, setBusy] = useState(false)

  return {
    friction,
    setFriction,
    risk,
    setRisk,
    promote,
    setPromote,
    controlFloor,
    setControlFloor,
    explore,
    setExplore,
    cursorApiKey,
    setCursorApiKey,
    marketDataKey,
    setMarketDataKey,
    busy,
    setBusy,
    buildPatch: () => ({
      friction,
      risk,
      promoteThresholds: promote,
      controlFloorWeight: controlFloor,
      explorationAllotmentUsd: explore,
      cursorApiKey: cursorApiKey || undefined,
      marketDataKey: marketDataKey || undefined
    })
  }
}

export function SettingsModal(props: {
  settings: AppSettingsPublic
  onClose: () => void
  onSave: (patch: ReturnType<ReturnType<typeof useSettingsForm>['buildPatch']>) => Promise<AppSettingsPublic>
}): JSX.Element {
  const form = useSettingsForm(props.settings)

  const save = async (): Promise<void> => {
    form.setBusy(true)
    try {
      await props.onSave(form.buildPatch())
      props.onClose()
    } finally {
      form.setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Settings"
      onClose={props.onClose}
      footer={
        <button type="button" className="btn-primary" disabled={form.busy} onClick={() => void save()}>
          Save
        </button>
      }
    >
      <SettingsFormFields
        settings={props.settings}
        friction={form.friction}
        risk={form.risk}
        promote={form.promote}
        controlFloor={form.controlFloor}
        explore={form.explore}
        cursorApiKey={form.cursorApiKey}
        marketDataKey={form.marketDataKey}
        onFrictionChange={form.setFriction}
        onRiskChange={form.setRisk}
        onPromoteChange={form.setPromote}
        onControlFloorChange={form.setControlFloor}
        onExploreChange={form.setExplore}
        onCursorApiKeyChange={form.setCursorApiKey}
        onMarketDataKeyChange={form.setMarketDataKey}
      />
    </ModalShell>
  )
}
