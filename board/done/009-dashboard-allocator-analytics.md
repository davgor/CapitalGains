# EPIC: Dashboard, allocator, analytics (Phase 3)

Ship the CapitalGains UI from the wireframe: header (Daily Limit, Daily Profit net, Settings), named factory rows with role/evidence weight, selectable stage nodes + detail modals (grey incomplete), add/rename factories, evidence-weighted capital, promote/kill/clone, net leaderboards vs Control/SPY.

**Depends on:** 007 (engine), 008 (agent artifacts for live modals; UI can stub earlier but epic completes against real store).  
**Plan:** CapitalGains Feature Plan — UI + promote/kill + Phase 3.

Broken down into sub-tickets 009.1–009.10. This epic is done when all of them are.

009.1 App shell header + Daily Limit/Profit · 009.2 Settings modal (keys, friction, risk, promote thresholds) · 009.3 Factory rows + add/rename + late-queue · 009.4 Stage nodes + grey states · 009.5 Stage detail modals · 009.6 Evidence-weighted capital allocator · 009.7 Promote/kill/clone controls · 009.8 Analytics leaderboard · 009.9 Black/green hacker terminal theme · 009.10 Fireguard mutation coverage

## Acceptance criteria

- [x] All sub-tickets 009.1–009.10 are in `board/done/` with criteria verified
- [x] User can operate a paper day from the UI without editing DB by hand
- [x] Incomplete stages are greyed; completed stages open modals with persisted artifacts
- [x] Daily Profit display uses net friction-adjusted P&L
- [x] UI uses the black/green hacker terminal theme (009.9)

## Sub-tickets

### 009.1 — App shell header + Daily Limit / Profit

Match wireframe header: brand `CapitalGains`, editable Daily Limit, aggregated Daily Profit (**net**). Wire to store/orchestrator.

#### Acceptance criteria

- [x] Header renders Limit + Profit; Limit edits persist for next allocation cycle
- [x] Profit aggregates factory net outcomes for the session day
- [x] Component/unit tests for aggregation helper
- [x] Layout usable on desktop window sizes used by Electron

### 009.2 — Settings modal (keys, friction, risk, promote)

Gear opens Settings: Cursor API key, market-data keys, friction bps, risk defaults, promote thresholds. Secrets stored locally/securely (OS keychain or encrypted local store — pick one and document); never in git.

#### Acceptance criteria

- [x] Settings UI read/write config used by orchestrator/SDK/broker
- [x] Secrets not written to plaintext tracked files
- [x] Changing friction/risk affects subsequent sessions (tested at config layer)
- [x] Document where secrets live in `docs/runbooks/` or README snippet

### 009.3 — Factory rows + add/rename + late-queue

List factories with custom names, role badge, evidence weight, net Daily Profit. `+` adds explorer (name prompt). Rename supported. Factories added after morning window queued until next open.

#### Acceptance criteria

- [x] Add/rename persist to store and appear in UI
- [x] Late-add sets `queued_next_open` (or equivalent) and does not run Purchases same day
- [x] Control factory identifiable and not deletable without confirmation (or protected)
- [x] Unit/component tests for queue eligibility helper

### 009.4 — Stage nodes + grey states

Horizontal stage chips per factory: Kickoff → Research → Purchases → Monitoring → Outcome → Lessons. Incomplete greyed/non-actionable (or locked empty). Active/completed selectable. Failed/Skipped distinct and selectable for error detail.

#### Acceptance criteria

- [x] Node visual states driven by stage machine status from store
- [x] Grey nodes do not open full artifact modals as if complete
- [x] Failed state shows error affordance
- [x] Component test or story-level assertion for state mapping

### 009.5 — Stage detail modals

Clicking a completed/active node opens a modal:

- Kickoff: full input + Zod output (Control: frozen + no mutation)
- Research: tape subset, research log, weights or SitOut
- Purchases: **full basket** fills (per symbol shares, raw quote, friction fill, notional), residual cash, totals
- Monitoring: marks, deltas, stops, last refresh
- Outcome: gross vs net, vs SPY, vs Control, full-limit vs deployed
- Lessons: thought process, next seed, promote/kill note if any

#### Acceptance criteria

- [x] Each modal reads persisted artifacts (no live re-agent on open)
- [x] Purchases modal lists multiple symbols when basket > 1
- [x] Missing artifact shows empty/locked messaging, not crash
- [x] Basic component tests for modal data mapping helpers

### 009.6 — Evidence-weighted capital allocator

Split global Daily Limit across factories by evidence weights (not eternal equal piles). New explorers get small exploration allotment until scored. Respect Killed = zero weight. Hook Explore→Exploit flag when promotions exist.

#### Acceptance criteria

- [x] Allocator pure function unit-tested (weights → cash piles sum to Daily Limit)
- [x] Killed factories receive 0; Control always receives baseline floor weight (configurable)
- [x] Orchestrator uses allocator output as per-factory cash for Purchases
- [x] UI shows evidence weight on each row

### 009.7 — Promote / kill / clone controls

After close (and manual override in UI), apply thresholds from Settings: min sessions (ex-infra), min net excess vs SPY and Control, max drawdown. Promote freezes lineage + raises weight; Kill zeros capital; Clone spawns explorer from promoted prompt with small mutation budget.

#### Acceptance criteria

- [x] Promote/kill evaluation pure function unit-tested with fixtures
- [x] UI can show pending recommendation and confirm action
- [x] Clone creates new explorer factory with inherited prompt lineage id
- [x] `infra_skip` days excluded from session counts

### 009.8 — Analytics leaderboard

Hypothesis lineage vs cumulative **net** excess vs SPY/Control; win rate ex-infra; capital weights over time; promote/kill history.

#### Acceptance criteria

- [x] Leaderboard view/section renders from store aggregates
- [x] Sorting by net excess vs SPY works
- [x] Control baseline row always visible for comparison
- [x] Unit tests for aggregate queries

### 009.9 — Black/green hacker terminal theme

Restyle the CapitalGains dashboard UI as a black-and-green terminal/hacker aesthetic so the Phase 3 shell feels cohesive and on-brand for an ops console. Applies across header, factory rows, stage chips, modals, settings, and analytics.

#### Acceptance criteria

- [x] Global CSS variables use a dark terminal palette (near-black background, phosphor green ink/accent) with a purposeful mono/display font stack (not Inter/Roboto/system-only)
- [x] First viewport reads as one composition: brand `CapitalGains` is hero-level, with Daily Limit / Profit and primary factory surface — not a flat light marketing page
- [x] Stage greys, failed, and active states remain distinguishable under the dark theme
- [x] Existing auto-update banner/controls remain usable and themed consistently

### 009.10 — Fireguard mutation coverage

Strengthen Epic 009 unit and shallow renderer coverage so precise behavioral assertions kill surviving mutants without relaxing Fireguard or lint configuration.

#### Acceptance criteria

- [x] Tests exercise changed dashboard, shared engine, secrets, store, and renderer branches with precise assertions
- [x] `npm run fireguard` reports a mutation score of at least 75% and a non-F grade
- [x] Lint, full unit tests, typecheck, deadcode, and build all pass
