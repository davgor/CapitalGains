import { useAppUpdate } from './autoUpdate/UpdateBanner'
import { AppVersionLabel } from './autoUpdate/AppVersionLabel'
import { CheckForUpdatesButton } from './autoUpdate/CheckForUpdatesButton'
import { UpdateBanner } from './autoUpdate/UpdateBanner'
import { AnalyticsLeaderboard } from './dashboard/AnalyticsLeaderboard'
import { FactoryBoardSection } from './dashboard/FactoryBoardSection'
import { HeaderBar } from './dashboard/HeaderBar'
import { SettingsModal } from './dashboard/SettingsModal'
import { StageDetailModal } from './dashboard/StageDetailModal'
import { useDashboard } from './useDashboard'

function UpdatesSection(props: { version: string }): JSX.Element {
  return (
    <section className="app-settings" aria-label="Updates">
      <h2>Updates</h2>
      <div className="updates-row">
        <AppVersionLabel version={props.version} />
        <CheckForUpdatesButton />
      </div>
    </section>
  )
}

export function App(): JSX.Element {
  const update = useAppUpdate()
  const dash = useDashboard()

  return (
    <main className="app-shell">
      <div className="scanlines" aria-hidden="true" />
      <HeaderBar
        dailyLimitUsd={dash.snapshot.dailyLimitUsd}
        dailyProfitNet={dash.snapshot.dailyProfitNet}
        sessionDate={dash.snapshot.sessionDate}
        version={update.currentVersion}
        onDailyLimitChange={(v) => void dash.onLimitChange(v)}
        onOpenSettings={() => dash.setSettingsOpen(true)}
      />

      {dash.error ? <p className="app-error">{dash.error}</p> : null}

      <FactoryBoardSection
        snapshot={dash.snapshot}
        onAddFactory={() => void dash.onAddFactory()}
        onRename={(id, name) => void dash.onRename(id, name)}
        onOpenStage={(id, name, stage) => void dash.onOpenStage(id, name, stage)}
        onPromote={(id, action) => void dash.onPromote(id, action)}
      />

      <AnalyticsLeaderboard
        rows={dash.snapshot.leaderboard}
        history={dash.snapshot.promoteHistory}
      />

      <UpdatesSection version={update.currentVersion} />

      <UpdateBanner />

      {dash.settingsOpen ? (
        <SettingsModal
          settings={dash.snapshot.settings}
          onClose={() => dash.setSettingsOpen(false)}
          onSave={dash.onSaveSettings}
        />
      ) : null}

      {dash.modal ? (
        <StageDetailModal
          title={dash.modalTitle}
          payload={dash.modal}
          onClose={() => dash.setModal(null)}
        />
      ) : null}
    </main>
  )
}
