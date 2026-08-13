import { useState } from 'react'
import type { DashboardSnapshot, StageModalPayload } from '../../shared/engine/dashboardApi'
import type { AppSettingsPublic } from '../../shared/engine/types'
import {
  addDashboardFactory,
  confirmDashboardPromoteAction,
  openDashboardStageModal,
  renameDashboardFactory,
  saveDashboardSettings
} from './dashboardClient'

export function useSettingsModal(refresh: () => Promise<void>) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  const onSaveSettings = async (
    patch: Parameters<typeof saveDashboardSettings>[0]
  ): Promise<AppSettingsPublic> => {
    const settings = await saveDashboardSettings(patch)
    await refresh()
    return settings
  }

  return { settingsOpen, setSettingsOpen, onSaveSettings }
}

export function useStageDetailModal() {
  const [modal, setModal] = useState<StageModalPayload | null>(null)
  const [modalTitle, setModalTitle] = useState('')

  const onOpenStage = async (
    factoryId: string,
    factoryName: string,
    stage: StageModalPayload['stage']
  ): Promise<void> => {
    const payload = await openDashboardStageModal(factoryId, stage)
    setModalTitle(`${factoryName} · ${stage}`)
    setModal(payload)
  }

  return { modal, setModal, modalTitle, onOpenStage }
}

export function useFactoryActions(
  refresh: () => Promise<void>,
  setSnapshot: (snapshot: DashboardSnapshot) => void
) {
  const onAddFactory = async (): Promise<void> => {
    const name = window.prompt('Explorer factory name')
    if (!name || name.trim().length === 0) {
      return
    }
    await addDashboardFactory(name.trim())
    await refresh()
  }

  const onRename = async (id: string, current: string): Promise<void> => {
    const name = window.prompt('Rename factory', current)
    if (!name || name.trim().length === 0) {
      return
    }
    await renameDashboardFactory(id, name.trim())
    await refresh()
  }

  const onPromote = async (
    factoryId: string,
    action: 'promote' | 'kill' | 'clone'
  ): Promise<void> => {
    const ok = window.confirm(`Confirm ${action} for this factory?`)
    if (!ok) {
      return
    }
    setSnapshot(await confirmDashboardPromoteAction(factoryId, action))
  }

  return { onAddFactory, onRename, onPromote }
}
