# EPIC: CI hygiene — deadcode + security audit

Mirror AI-DND-Matrix (and davgor.github.io) hygiene gates: `ts-prune` dead-export detection with a baseline ignore file, plus `npm audit` failing on moderate+ vulnerabilities on pull requests.

**Depends on:** TypeScript project configs and a lockfile from the Electron scaffold. Prefer completing after epic 002 so delivery skills can require `npm run deadcode`.

003.1 deadcode script + baseline · 003.2 deadcode workflow · 003.3 security-audit workflow · 003.4 delivery-gate wiring

## Acceptance criteria

- [x] All sub-tickets 003.1–003.4 are in `board/done/` with criteria verified
- [x] Local `npm run deadcode` and CI workflows match AI-DND-Matrix behavior

## Sub-tickets

### 003.1 Deadcode: ts-prune script + baseline

#### Description

Add a `deadcode` npm script that runs `ts-prune` against this repo's TS configs and fails on exports not listed in `.tsprune-ignore`. Include a refresh helper for intentional baseline updates (same shape as AI-DND-Matrix `scripts/deadcode-check.mjs` / `deadcode-refresh.mjs`).

#### Acceptance criteria

- [x] `npm run deadcode` fails on new unused exports not present in `.tsprune-ignore`
- [x] `npm run deadcode:refresh` (or equivalent) regenerates the baseline in a reviewable diff
- [x] `.tsprune-ignore` is committed; initial baseline covers only intentional exports after scaffold
- [x] Unit tests cover the check script's ignore matching when non-trivial logic exists

### 003.2 Deadcode: GitHub Actions workflow

#### Description

Add `.github/workflows/deadcode.yml` that runs `npm run deadcode` on PRs and pushes to `main` (honoring `[skip ci]` on push).

#### Acceptance criteria

- [x] `.github/workflows/deadcode.yml` exists and runs on PR/push to `main`
- [x] Job installs with `npm ci` and executes `npm run deadcode`
- [x] Push jobs skip when the head commit message contains `[skip ci]`

### 003.3 Security audit: fail on moderate+

#### Description

Add `.github/workflows/security-audit.yml` mirroring AI-DND-Matrix: run `npm audit` on PRs to `main` and fail when moderate, high, or critical advisories are present.

#### Acceptance criteria

- [x] `.github/workflows/security-audit.yml` runs on pull requests targeting `main`
- [x] Workflow fails the job when any moderate+ vulnerability is reported
- [x] Audit JSON (or equivalent summary) is visible in the job log for triage

### 003.4 Wire deadcode into delivery standards

#### Description

Once `npm run deadcode` exists, update delivery skills / rules / README so the verification gate always includes deadcode (matching davgor.github.io and AI-DND-Matrix standing rules).

#### Acceptance criteria

- [x] `.cursor/skills/delivery-standards/SKILL.md` and `.claude` mirror require `npm run deadcode` before done (no "once available" hedge)
- [x] `.cursor/rules/delivery-standards.mdc` lists deadcode in the verify-before-done gate
- [x] `complete-ticket` skill verify section includes deadcode unconditionally
- [x] README CI section documents deadcode + security-audit workflows
