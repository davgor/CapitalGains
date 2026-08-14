import type { DashboardSnapshot } from '../../shared/engine/dashboardApi'
import type { AppSettingsPublic } from '../../shared/engine/types'

export const emptySnapshot = (): DashboardSnapshot => ({
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

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (!window.dashboard) {
    return emptySnapshot()
  }
  return window.dashboard.getSnapshot()
}

export async function setDashboardDailyLimit(value: number): Promise<DashboardSnapshot> {
  return window.dashboard.setDailyLimit(value)
}

export async function addDashboardFactory(name: string): Promise<void> {
  await window.dashboard.addFactory(name)
}

export async function renameDashboardFactory(id: string, name: string): Promise<void> {
  await window.dashboard.renameFactory(id, name)
}

export async function openDashboardStageModal(
  factoryId: string,
  stage: Parameters<typeof window.dashboard.openStageModal>[1]
) {
  return window.dashboard.openStageModal(factoryId, stage)
}

export async function confirmDashboardPromoteAction(
  factoryId: string,
  action: 'promote' | 'kill' | 'clone'
): Promise<DashboardSnapshot> {
  return window.dashboard.confirmPromoteAction(factoryId, action)
}

export async function saveDashboardSettings(
  patch: Parameters<typeof window.dashboard.saveSettings>[0]
): Promise<AppSettingsPublic> {
  return window.dashboard.saveSettings(patch)
}
