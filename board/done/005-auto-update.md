# EPIC: In-app auto-update (electron-updater)

Mirror AI-DND-Matrix auto-update: packaged builds check GitHub Releases via `electron-updater`, poll for updates, and apply silently on the NSIS/Setup channel. Portable builds stay manual-download only.

**Depends on:** epic 004 (releases publish `latest.yml` + installers). Wire updater in Electron main once the window/shell exists.

005.1 electron-updater wiring · 005.2 update UI / version display · 005.3 auto-update runbook

## Acceptance criteria

- [x] All sub-tickets 005.1–005.3 are in `board/done/` with criteria verified
- [x] Setup/installer builds can discover and apply updates from GitHub Releases; portable builds do not auto-update
- [x] Dev / unpackaged runs and `DISABLE_AUTO_UPDATE=1` disable update checks

## Sub-tickets

### 005.1 electron-updater main-process wiring

#### Description

Integrate `electron-updater` in the Electron main process against GitHub Releases (same provider config as electron-builder `publish`). Match AI-DND-Matrix behavior: initial check shortly after launch, periodic poll, guarded concurrent checks, disabled when not packaged or when `DISABLE_AUTO_UPDATE=1`.

#### Acceptance criteria

- [x] `electron-updater` is a dependency and configured for the GitHub publish provider
- [x] Packaged Setup builds check for updates after launch and on an interval while open
- [x] Update apply uses silent quit-and-install for the installer channel (no wizard on update)
- [x] Auto-update is a no-op in unpackaged/dev and when `DISABLE_AUTO_UPDATE=1`
- [x] Unit or focused tests cover guard conditions (packaged flag / env disable) where logic is extractable

### 005.2 Version display + update-ready UX

#### Description

Surface `app.getVersion()` in the UI and show an update-ready affordance (banner or settings action) with restart-to-apply, matching AI-DND-Matrix “show app version” + smoother auto-update UX.

#### Acceptance criteria

- [x] App UI shows the current semver from `app.getVersion()` / `package.json`
- [x] When an update is downloaded and ready, the user can restart to apply
- [x] Settings (or equivalent) exposes a manual “Check for updates” path using the same guarded updater entrypoint
- [x] Component/unit tests cover version rendering and update-ready state when testable without launching Electron

### 005.3 Auto-update runbook

#### Description

Add `docs/runbooks/auto-update.md` documenting installer vs portable, poll cadence, versioning/`[skip ci]`, and how to verify an update landed — mirrored from AI-DND-Matrix `docs/runbooks/auto-update.md`.

#### Acceptance criteria

- [x] `docs/runbooks/auto-update.md` exists and covers Setup vs portable, check cadence, disable flags, and release verification
- [x] README links to the runbook from the CI/deploy or releases section
