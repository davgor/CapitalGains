import { useEffect, useState } from 'react'
import type { DashboardSnapshot, StageModalPayload } from '../../shared/engine/dashboardApi'
import type { AppSettingsPublic } from '../../shared/engine/types'
import { AppVersionLabel } from './autoUpdate/AppVersionLabel'
import { CheckForUpdatesButton } from './autoUpdate/CheckForUpdatesButton'
import { UpdateBanner, useAppUpdate } from './autoUpdate/UpdateBanner'
import { AnalyticsLeaderboard } from './dashboard/AnalyticsLeaderboard'
import { FactoryRow } from './dashboard/FactoryRow'
import { HeaderBar } from './dashboard/HeaderBar'
import { SettingsModal } from './dashboard/SettingsModal'
import { StageDetailModal } from './dashboard/StageDetailModal'

const emptySnapshot = (): DashboardSnapshot => ({
  sessionDate: '',
  dailyLimitUsd: 10_000,
  dailyProfitNet: 0,
  factories: [],
  allocations: {},
  promoteRecommendations: [],
  leaderboard: [],
  promoteHistory: [],
  settings: {
    friction: { spreadBps: 5, slippageBps: 3, commissionPerShare: 0.005 },
    risk: {
      maxSingleNameWeight: 0.4,
      maxSectorWeight: 0.6,
      defaultStopLossPercent: 2,
      dailyLossHaltPercent: 3
    },
    promoteThresholds: {
      minSessionsExInfra: 5,
      minNetExcessVsSpy: 0.01,
      minNetExcessVsControl: 0.005,
      maxDrawdown: 0.1
    },
    controlFloorWeight: 1,
    explorationAllotmentUsd: 500,
    dailyLimitUsd: 10_000,
    hasCursorApiKey: false,
    hasMarketDataKey: false
  }
})

export function App(): JSX.Element {
  const update = useAppUpdate()
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modal, setModal] = useState<StageModalPayload | null>(null)
  const [modalTitle, setModalTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    if (!window.dashboard) {
      return
    }
    const next = await window.dashboard.getSnapshot()
    setSnapshot(next)
  }

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err))
    })
  }, [])

  const onLimitChange = async (value: number): Promise<void> => {
    const next = await window.dashboard.setDailyLimit(value)
    setSnapshot(next)
  }

  const onAddFactory = async (): Promise<void> => {
    const name = window.prompt('Explorer factory name')
    if (!name || name.trim().length === 0) {
      return
    }
    await window.dashboard.addFactory(name.trim())
    await refresh()
  }

  const onRename = async (id: string, current: string): Promise<void> => {
    const name = window.prompt('Rename factory', current)
    if (!name || name.trim().length === 0) {
      return
    }
    await window.dashboard.renameFactory(id, name.trim())
    await refresh()
  }

  const onOpenStage = async (
    factoryId: string,
    factoryName: string,
    stage: StageModalPayload['stage']
  ): Promise<void> => {
    const payload = await window.dashboard.openStageModal(factoryId, stage)
    setModalTitle(`${factoryName} · ${stage}`)
    setModal(payload)
  }

  const onPromote = async (
    factoryId: string,
    action: 'promote' | 'kill' | 'clone'
  ): Promise<void> => {
    const ok = window.confirm(`Confirm ${action} for this factory?`)
    if (!ok) {
      return
    }
    const next = await window.dashboard.confirmPromoteAction(factoryId, action)
    setSnapshot(next)
  }

  const onSaveSettings = async (
    patch: Parameters<typeof window.dashboard.saveSettings>[0]
  ): Promise<AppSettingsPublic> => {
    const settings = await window.dashboard.saveSettings(patch)
    await refresh()
    return settings
  }

  return (
    <main className="app-shell">
      <div className="scanlines" aria-hidden="true" />
      <HeaderBar
        dailyLimitUsd={snapshot.dailyLimitUsd}
        dailyProfitNet={snapshot.dailyProfitNet}
        sessionDate={snapshot.sessionDate}
        version={update.currentVersion}
        onDailyLimitChange={(v) => {
          void onLimitChange(v)
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {error ? <p className="app-error">{error}</p> : null}

      <section className="factory-board" aria-label="Factories">
        <div className="factory-board-head">
          <h2>Factory grid</h2>
          <button type="button" className="btn-ghost" onClick={() => void onAddFactory()}>
            + Add explorer
          </button>
        </div>
        {snapshot.factories.length === 0 ? (
          <p className="empty-hint">No factories yet. Add Control/explorers to begin a paper day.</p>
        ) : (
          snapshot.factories.map((factory) => (
            <FactoryRow
              key={factory.id}
              factory={factory}
              recommendation={
                snapshot.promoteRecommendations.find((r) => r.factoryId === factory.id) ?? null
              }
              onRename={() => void onRename(factory.id, factory.name)}
              onOpenStage={(stage) => void onOpenStage(factory.id, factory.name, stage)}
              onPromote={(action) => void onPromote(factory.id, action)}
            />
          ))
        )}
      </section>

      <AnalyticsLeaderboard
        rows={snapshot.leaderboard}
        history={snapshot.promoteHistory}
      />

      <section className="app-settings" aria-label="Updates">
        <h2>Updates</h2>
        <div className="updates-row">
          <AppVersionLabel version={update.currentVersion} />
          <CheckForUpdatesButton />
        </div>
      </section>

      <UpdateBanner />

      {settingsOpen ? (
        <SettingsModal
          settings={snapshot.settings}
          onClose={() => setSettingsOpen(false)}
          onSave={onSaveSettings}
        />
      ) : null}

      {modal ? (
        <StageDetailModal
          title={modalTitle}
          payload={modal}
          onClose={() => setModal(null)}
        />
      ) : null}
    </main>
  )
}
