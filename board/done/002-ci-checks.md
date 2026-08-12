# EPIC: CI Checks (GitHub Actions)

Stand up PR/push CI mirroring [AI-DND-Matrix](https://github.com/davgor/AI-DND-Matrix) `pr-checks.yml`: unit tests, lint, and full build/typecheck on every PR and push to `main`.

**Depends on:** Electron + React + TypeScript scaffold with `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` scripts.

Broken down into sub-tickets 002.1–002.5. This epic is done when all of them are.

002.1 PR check: tests · 002.2 PR check: lint · 002.3 PR check: typecheck + build · 002.4 required-checks doc · 002.5 auto-revert on main CI failure

## Acceptance criteria

- [x] All sub-tickets 002.1–002.5 are in `board/done/` with criteria verified
- [x] `.github/workflows/pr-checks.yml` named **CI Checks** runs `test`, `lint`, and `build` jobs
- [x] Push commits containing `[skip ci]` skip the push-triggered jobs (same gate as AI-DND-Matrix)

## Sub-tickets

### 002.1 CI: PR check runs unit tests

#### Description

Add the unit-test job to the PR-check GitHub Actions workflow, mirroring AI-DND-Matrix.

#### Acceptance criteria

- [x] `.github/workflows/pr-checks.yml` exists with a job named `test` that runs `npm test` on every PR targeting `main` and every push to `main` (unless `[skip ci]`)
- [x] Node version and `npm ci` caching match the rest of this repo's workflows
- [x] Intentionally breaking a test and opening a PR shows the job failing; reverting shows it passing

### 002.2 CI: PR check runs lint

#### Description

Add the lint job to the PR-check workflow.

#### Acceptance criteria

- [x] The PR-checks workflow has a job named `lint` that runs `npm run lint` on every PR targeting `main` and every push to `main` (unless `[skip ci]`)
- [x] Intentionally introducing a lint violation and opening a PR shows the job failing; reverting shows it passing

### 002.3 CI: PR check runs typecheck + full build

#### Description

Add the build job to the PR-check workflow (typecheck then electron-vite / app build).

#### Acceptance criteria

- [x] The PR-checks workflow has a job named `build` that runs `npm run typecheck` and `npm run build` on every PR targeting `main` and every push to `main` (unless `[skip ci]`)
- [x] Intentionally breaking the build and opening a PR shows the job failing; reverting shows it passing

### 002.4 CI: document required status checks

#### Description

Document that the PR-checks workflow's three jobs (`test` / `lint` / `build`) are intended as required status checks, since branch protection itself may need to be configured outside of code.

#### Acceptance criteria

- [x] README explains the three required jobs and that branch protection should mark them required
- [x] The workflow job names are clearly labeled (`test`, `lint`, `build`) so they're identifiable when configuring branch protection

### 002.5 CI: auto-revert on main CI failure

#### Description

Mirror AI-DND-Matrix `auto-revert.yml`: when **CI Checks** fails on `main`, automatically revert the offending commit (unless HEAD is already a revert).

#### Acceptance criteria

- [x] `.github/workflows/auto-revert.yml` triggers on `workflow_run` of **CI Checks** completed on `main`
- [x] Job runs only when the triggering run's conclusion is `failure`
- [x] Skips if the latest commit subject already starts with `Revert`
- [x] Otherwise reverts HEAD and pushes with `github-actions[bot]` identity
