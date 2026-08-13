import { useEffect, useState } from 'react'
import type { DashboardSnapshot } from '../../shared/engine/dashboardApi'
import { emptySnapshot, fetchDashboardSnapshot, setDashboardDailyLimit } from './dashboardClient'
import { useFactoryActions, useSettingsModal, useStageDetailModal } from './useDashboardModals'

function useDashboardSnapshot() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot)
  const [error, setError] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    setSnapshot(await fetchDashboardSnapshot())
  }

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err))
    })
  }, [])

  const onLimitChange = async (value: number): Promise<void> => {
    setSnapshot(await setDashboardDailyLimit(value))
  }

  return { snapshot, setSnapshot, error, refresh, onLimitChange }
}

export function useDashboard() {
  const { snapshot, setSnapshot, error, refresh, onLimitChange } = useDashboardSnapshot()
  const settings = useSettingsModal(refresh)
  const stage = useStageDetailModal()
  const factories = useFactoryActions(refresh, setSnapshot)

  return {
    snapshot,
    error,
    onLimitChange,
    ...settings,
    ...stage,
    ...factories
  }
}
