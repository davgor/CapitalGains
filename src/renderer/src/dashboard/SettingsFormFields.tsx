import type { AppSettingsPublic } from '../../../shared/engine/types'
import { SettingsPromote } from './SettingsPromoteSection'
import { SettingsFriction, SettingsRisk, SettingsSecrets } from './SettingsSections'

export function SettingsFormFields(props: {
  settings: AppSettingsPublic
  friction: AppSettingsPublic['friction']
  risk: AppSettingsPublic['risk']
  promote: AppSettingsPublic['promoteThresholds']
  controlFloor: number
  explore: number
  cursorApiKey: string
  marketDataKey: string
  onFrictionChange: (friction: AppSettingsPublic['friction']) => void
  onRiskChange: (risk: AppSettingsPublic['risk']) => void
  onPromoteChange: (promote: AppSettingsPublic['promoteThresholds']) => void
  onControlFloorChange: (value: number) => void
  onExploreChange: (value: number) => void
  onCursorApiKeyChange: (value: string) => void
  onMarketDataKeyChange: (value: string) => void
}): JSX.Element {
  return (
    <>
      <SettingsSecrets
        hasCursorApiKey={props.settings.hasCursorApiKey}
        hasMarketDataKey={props.settings.hasMarketDataKey}
        cursorApiKey={props.cursorApiKey}
        marketDataKey={props.marketDataKey}
        onCursorApiKeyChange={props.onCursorApiKeyChange}
        onMarketDataKeyChange={props.onMarketDataKeyChange}
      />
      <SettingsFriction friction={props.friction} onChange={props.onFrictionChange} />
      <SettingsRisk risk={props.risk} onChange={props.onRiskChange} />
      <SettingsPromote
        promote={props.promote}
        controlFloor={props.controlFloor}
        explore={props.explore}
        onPromoteChange={props.onPromoteChange}
        onControlFloorChange={props.onControlFloorChange}
        onExploreChange={props.onExploreChange}
      />
    </>
  )
}
