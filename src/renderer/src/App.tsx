import { AppVersionLabel } from './autoUpdate/AppVersionLabel'
import { CheckForUpdatesButton } from './autoUpdate/CheckForUpdatesButton'
import { UpdateBanner, useAppUpdate } from './autoUpdate/UpdateBanner'

export function App(): JSX.Element {
  const update = useAppUpdate()

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>CapitalGains</h1>
        <AppVersionLabel version={update.currentVersion} />
      </header>
      <p className="app-lede">Track capital gains locally in a desktop app.</p>
      <section className="app-settings" aria-label="Updates">
        <h2>Updates</h2>
        <CheckForUpdatesButton />
      </section>
      <UpdateBanner />
    </main>
  )
}
