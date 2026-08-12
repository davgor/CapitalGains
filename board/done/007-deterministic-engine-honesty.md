# EPIC: Deterministic engine + honesty (Phase 1)

Build the non-agentic core of CapitalGains so a factory can run a full paper morning session with **hardcoded multi-name allocations**: US/Eastern market clock, SQLite persistence, feature tape, universe filters, friction-aware paper broker, risk engine (stops, caps, daily halt), SitOut, dual benchmarks (full limit vs deployed), idempotent resume, and missed-session `infra_skip` flagging.

**Depends on:** Electron + React + TypeScript scaffold (existing).  
**Plan:** CapitalGains Feature Plan — Path to edge + Phase 1.  
**Blocks:** 008 (agentic), 009 (dashboard/allocator), 010 (live seam).

Broken down into sub-tickets 007.1–007.10. This epic is done when all of them are.

007.1 Domain schema + SQLite store · 007.2 Market clock + session supervisor · 007.3 Market data port + quotes · 007.4 Feature tape + universe filters · 007.5 Paper broker with friction · 007.6 Risk engine · 007.7 Stage machine + SitOut + multi-name purchases · 007.8 Monitoring loop + Outcome dual benchmarks · 007.9 Idempotent resume + infra_skip · 007.10 Hardcoded full-day integration test

## Acceptance criteria

- [x] All sub-tickets 007.1–007.10 are in `board/done/` with criteria verified
- [x] A factory can be driven through Kickoff(skip)/Research(hardcoded)/Purchases/Monitoring/Outcome without Cursor SDK
- [x] Net (friction-adjusted) P&L is the scored figure; gross is stored but not used for “daily profit” aggregates
- [x] Multi-name baskets fill per symbol (e.g. NVDA + GOOGL), not collapsed to one ticker

## Sub-tickets

### 007.1 — Domain schema + SQLite store

Persist factories, daily runs, stage artifacts, fills, wrapsheet snapshots, outcomes, lessons placeholders, roles (Control/Explorer/Promoted/Killed), evidence weights, and infra_skip flags. Modal drill-ins and restart resume must read from the store — nothing ephemeral-only.

#### Acceptance criteria

- [x] SQLite schema (or migrations) covers factories, sessions/runs, stage records, fills, snapshots, outcomes (gross + net), and config
- [x] Typed repository API for CRUD used by orchestrator tests
- [x] Unit tests cover insert/read of a multi-name fill basket and an Outcome with dual return fields
- [x] `npm test` / lint / typecheck pass for new modules

### 007.2 — Market clock + session supervisor

US/Eastern schedule: regime/tape ~09:05, research window ~09:15, purchases ~09:35, 2‑min monitor until official close, then outcome. Detect half-day/holiday stubs as “closed”; missed open → `infra_skip`. Refuse silent sleep through the purchase window (ops alarm hook).

#### Acceptance criteria

- [x] Clock helpers return stage eligibility given a frozen “now” (unit-tested across open, mid-day, close, weekend)
- [x] Supervisor marks a session `infra_skip` when purchases window is missed
- [x] Documented timezone assumption (America/New_York) in code comments or runbook stub
- [x] Tests do not depend on wall-clock flakiness (injectable clock)

### 007.3 — Market data port + quotes

Abstract market data behind a port (`getQuote`, `getSnapshot`, staleness age). Provide a mock/fake for tests and a real provider adapter stub wiring (API key from settings later). Stale quotes beyond threshold must be rejectable by callers.

#### Acceptance criteria

- [x] `MarketDataPort` interface with quote + age metadata
- [x] In-memory/mock implementation for deterministic tests
- [x] Stale-quote helper used by purchases/monitor (unit-tested)
- [x] No secrets committed; provider key read from config/env only

### 007.4 — Feature tape + universe filters

Before any ranking, code builds a candidate tape with computed features (premarket gap %, RVOL, ADV, market cap, price, sector, spread estimate) and hard filters: ADV > 1M, mkt cap ≥ $2B, price ≥ $10, no 3× leveraged ETFs unless explicitly allowed.

#### Acceptance criteria

- [x] `buildFeatureTape(asOf)` returns only universe-passing symbols with feature fields
- [x] Unit tests reject penny / illiquid / micro-cap / leveraged-ETF names
- [x] Tape is serializable into the store for Research modal replay
- [x] Depends on 007.3 for underlying quotes/fundamentals fixtures

### 007.5 — Paper broker with friction

Paper execution port: `placeOrder` / `getPositions` / `flattenAll` / `getCash`. Fills apply configurable spread + slippage bps + commission — never raw last print as fill. Support multi-leg baskets (multiple symbols, whole shares each).

#### Acceptance criteria

- [x] Friction model produces fill price ≠ raw mid/last when spread/slippage > 0 (unit-tested)
- [x] Multi-name basket places independent fills; residual cash remains when weights leave remainder
- [x] Gross vs net notional/P&L helpers available to Outcome
- [x] Broker port seam documented so a live adapter can replace paper later (010)

### 007.6 — Risk engine

Mandatory risk: max single-name weight, max sector weight, default stop-loss %, portfolio daily loss halt (flatten + block further buys). Research may tighten stops, not remove them (unless SitOut).

#### Acceptance criteria

- [x] `validateBasket(allocations, limits)` rejects over-name / over-sector / over-sum weights
- [x] Monitor path triggers stop flatten when mark breaches stop from fill
- [x] Daily loss halt flattens remaining and sets a session flag blocking new buys (unit-tested)
- [x] Defaults configurable via settings object (wired in UI later in 009)

### 007.7 — Stage machine + SitOut + multi-name purchases

Orchestrator advances stages with durable commits. Hardcoded or injected Research plan → risk check → Purchases executes **every** allocation line. `sitOut: true` or empty allocations skips purchases but continues to Outcome/Lessons placeholders.

#### Acceptance criteria

- [x] Stage transitions persist before advancing; illegal jumps rejected
- [x] SitOut path creates Outcome with 100% cash / zero deployed without fills
- [x] Multi-name plan (e.g. NVDA + GOOGL weights) yields one fill row per symbol
- [x] Off-tape symbols rejected even if present in plan
- [x] Unit tests cover happy path, SitOut, and risk rejection

### 007.8 — Monitoring loop + Outcome dual benchmarks

Every 2 minutes refresh marks and unrealized deltas. At close, flatten with friction, compute gross and **net** realized P&L, return on **full daily limit** and on **deployed capital**, and SPY same-session benchmark aligned to fill/flatten window.

#### Acceptance criteria

- [x] Monitor tick updates snapshots idempotently for a frozen clock sequence
- [x] Outcome stores gross, net, full-limit return, deployed return, SPY return
- [x] Aggregate “Daily Profit” helpers use **net** only
- [x] Unit tests with fixture prices prove dual benchmarks differ when cash residual exists

### 007.9 — Idempotent resume + infra_skip

Restart mid-monitor or mid-flatten must not double-fill or double-log. Purchases keyed for idempotency. Missed windows / hard failures set `infra_skip` so later promote stats (009) can exclude them.

#### Acceptance criteria

- [x] Replaying “place basket” after a committed fill is a no-op (unit-tested)
- [x] Resume loads last committed stage and continues without resetting P&L
- [x] `infra_skip` flag settable and queryable on sessions
- [x] Test simulates crash between fill persist and stage advance

### 007.10 — Hardcoded full-day integration test

End-to-end (no SDK): inject clock + mock market data, run one factory through a full session with a hardcoded multi-name basket, assert fills, monitor snapshots, net Outcome vs SPY fixtures, and restart resume mid-day.

#### Acceptance criteria

- [x] Integration/unit harness drives open→close without Cursor SDK
- [x] Asserts multi-name fills, residual cash, net P&L, dual benchmarks
- [x] Asserts resume after simulated restart during monitoring
- [x] `npm test` covers this path; documented as Phase 1 proof in a short `docs/runbooks/` note

