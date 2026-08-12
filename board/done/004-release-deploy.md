# EPIC: Release deploy (Win + Mac packages)

Mirror [AI-DND-Matrix](https://github.com/davgor/AI-DND-Matrix) deployment: after **CI Checks** succeeds on `main`, bump minor version, package Windows (NSIS + portable) and macOS (`.dmg`), and publish a GitHub Release with top-level `release/` artifacts only (including `latest.yml` for auto-update).

**Depends on:** Electron scaffold with `electron-builder` config, `package:win` / `package:mac` scripts, and epic 002 CI Checks workflow named exactly `CI Checks`.

004.1 bump-minor-version script · 004.2 package scripts + electron-builder targets · 004.3 deploy workflow (gate + prepare + win + mac + release) · 004.4 README / runbook for releases

## Acceptance criteria

- [x] All sub-tickets 004.1–004.4 are in `board/done/` with criteria verified
- [x] Successful merge to `main` (CI Checks green, not `[skip ci]`) produces a GitHub Release with Windows installers and a Mac `.dmg`
- [x] Version-bump commits use `[skip ci]` so deploy does not loop

## Sub-tickets

### 004.1 Version bump script (minor)

#### Description

Add `scripts/bump-minor-version.mjs` (and tests) matching AI-DND-Matrix: bump `package.json` / lockfile from `x.Y.Z` → `x.(Y+1).0`, print the new version for CI.

#### Acceptance criteria

- [x] `node scripts/bump-minor-version.mjs` updates `package.json` and `package-lock.json` versions and prints the new semver
- [x] Invalid semver in `package.json` throws a clear error
- [x] Unit tests cover bump behavior (e.g. `0.0.1` → `0.1.0`, `0.1.0` → `0.2.0`)

### 004.2 electron-builder Win + Mac package scripts

#### Description

Configure `electron-builder` and npm scripts so local/CI packaging matches AI-DND-Matrix: Windows NSIS installer + portable exe, macOS universal/arch `.dmg`, artifacts under `release/`, GitHub publish provider for `latest.yml`.

#### Acceptance criteria

- [x] `package.json` defines `package:win` and `package:mac` (build then electron-builder with `--publish never`)
- [x] `build.win` targets include NSIS + portable; `build.mac` targets include `dmg`
- [x] `build.directories.output` is `release/`; `build.publish` points at this GitHub repo
- [x] Local dry-run packaging produces artifacts under `release/` on at least one platform available to the implementer

### 004.3 Deploy workflow (CI Checks → Release)

#### Description

Add `.github/workflows/deploy.yml` mirroring AI-DND-Matrix: gate on successful **CI Checks** (or `workflow_dispatch`), skip `[skip ci]` commits, bump minor version and push, package on `windows-latest` and `macos-latest`, upload artifacts, create a GitHub Release with top-level `release/` files only.

#### Acceptance criteria

- [x] Workflow triggers on `workflow_run` of **CI Checks** completed on `main`, plus `workflow_dispatch`
- [x] `should_deploy` sets `deploy=false` when the triggering commit message contains `[skip ci]`
- [x] `prepare` bumps version via `scripts/bump-minor-version.mjs`, commits `chore: release vX.Y.Z [skip ci]`, and pushes
- [x] `package-windows` / `package-mac` check out the bump SHA and upload `release/*` artifacts (`if-no-files-found: error`)
- [x] `release` job downloads artifacts and runs `gh release create` with only top-level files under `release/`
- [x] mac packaging sets `CSC_IDENTITY_AUTO_DISCOVERY: false` until code signing secrets are configured

### 004.4 Document release deploy

#### Description

Document the release pipeline in README (and a short runbook if useful): when deploy runs, what artifacts ship, `[skip ci]` loop prevention, and that branch protection / Actions permissions must allow the bot to push version bumps and create releases.

#### Acceptance criteria

- [x] README CI/deploy section describes Deploy after CI Checks, Win + Mac artifacts, and version bump behavior
- [x] Notes which artifact types are expected on each GitHub Release
- [x] Mentions `[skip ci]` on version-bump commits to prevent deploy loops
