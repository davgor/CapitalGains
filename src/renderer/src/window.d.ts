import type { AppInfoApi, AutoUpdateApi, DashboardApi } from '../../preload'

declare global {
  interface Window {
    autoUpdate: AutoUpdateApi
    appInfo: AppInfoApi
    dashboard: DashboardApi
  }
}

export {}
