# EPIC: Agentic integration (Phase 2)

Wire Cursor SDK for Kickoff, Research ranking, and Lessons only. Control factory uses a **frozen** kickoff prompt. Explorers get regime + global lessons (role-tagged) + word budget + Explore-mode diversity. Research is **tape-bounded**; SitOut allowed. Schema/budget failures → retry once then Failed/* with `infra_skip` when appropriate. Usage metering via SDK.

**Depends on:** 007 Deterministic engine + honesty.  
**Plan:** CapitalGains Feature Plan — Kickoff/Research/Lessons + Phase 2.  
**Blocks:** 009 (full UI against live agent artifacts), soft-blocks 010.

Broken down into sub-tickets 008.1–008.8. This epic is done when all of them are.

008.1 Cursor SDK client + settings key · 008.2 Kickoff Zod + word budget · 008.3 Control frozen prompt · 008.4 Explorer Kickoff + global lessons + diversity · 008.5 Tape-bounded Research agent · 008.6 Lessons agent + role-tagged pool · 008.7 Failure/retry/infra_skip hygiene · 008.8 Usage metering · 008.9 undici audit override

## Acceptance criteria

- [x] All sub-tickets 008.1–008.8 are in `board/done/` with criteria verified
- [x] A day can run with agents for explorers and frozen Control without agentic monitoring/purchases/outcome
- [x] Bloated kickoff (>350 words after retry) never reaches Research
- [x] Off-tape Research symbols never reach Purchases

## Sub-tickets

### 008.1 — Cursor SDK client + API key config

Integrate `@cursor/sdk` (or chosen TS package) behind a thin port. API key from Settings/env (`CURSOR_API_KEY`); never commit secrets. Pin fixed model id for consistency.

#### Acceptance criteria

- [x] Agent port can run a one-shot prompt in tests with a mock; production path uses SDK when key present
- [x] Missing key fails Kickoff/Research/Lessons cleanly (no hang)
- [x] Model id is configured once (not Auto/router)
- [x] Unit tests mock the port; no live network required in CI

### 008.2 — Kickoff Zod contract + word budget

Kickoff output schema: hypothesis, style, search directive, ≥2 negative constraints, `allow_full_cash`, `generated_kickoff_prompt`. Soft ≤300 words; hard stop 350; one compress retry; else Failed/BudgetExceeded.

#### Acceptance criteria

- [x] Zod parse rejects invalid Kickoff payloads (unit-tested)
- [x] Word-count validator triggers compress retry path once, then BudgetExceeded
- [x] System prompt text includes compression/pruning rules (checked into repo as fixture/constant)
- [x] Valid Kickoff artifact persisted for modal replay

### 008.3 — Control factory frozen prompt

One Control factory: no daily Kickoff mutation; uses frozen prompt text. Results feed baseline comparison; Control prompt is not rewritten by Lessons.

#### Acceptance criteria

- [x] Factory role `control` skips Kickoff agent and loads frozen prompt from store/config
- [x] Attempting to mutate Control prompt via Lessons is a no-op (persisted prompt unchanged)
- [x] Control sessions still run Research→…→Outcome→Lessons (lessons tagged role=control)
- [x] Unit tests cover control vs explorer Kickoff branching

### 008.4 — Explorer Kickoff + global lessons + diversity

Explorers receive regime feed, global lessons pool (all factories, role-tagged, capped window), own recap, feature-tape summary, and sibling exclusions in Explore mode. Distinct `hypothesis_tested` per day among explorers; collision → retry then Failed/Skipped.

#### Acceptance criteria

- [x] Parent assembles Kickoff input packet from store (unit-tested shape)
- [x] Explore mode rejects duplicate hypotheses across explorers after retry
- [x] Exploit mode (flag) disables diversity requirement (hook for 009 promote)
- [x] Global pool includes Control as baseline entries without copying Control prompt text into explorers

### 008.5 — Tape-bounded Research agent

Research agent ingests kickoff + feature tape; optional directed search; emits Zod plan with `sitOut` or multi-name weights. Symbols must ⊆ tape. Risk caps applied before Purchases.

#### Acceptance criteria

- [x] Research Zod schema matches plan (`sitOut`, allocations[], required stopLossPercent)
- [x] Off-tape symbol rejected (unit-tested) even if agent emits it
- [x] Empty/sitOut plans skip Purchases via existing 007 path
- [x] One schema retry then Failed/Skipped

### 008.6 — Lessons agent + role-tagged pool

Post-close Lessons consumes structured packet (hypothesis, research, friction fills, trajectory, net P&L dual benchmarks, SPY, Control same-day net, infra_skip). Output: failure mode, win/loss factor, suggested seed. Appended to global pool with role tags. `infra_skip` sessions do not generate “thesis failed” lessons used for promote.

#### Acceptance criteria

- [x] Lessons input/output Zod (or typed) contracts persisted
- [x] `infra_skip` sessions skip or mark lessons excluded from promote feeds
- [x] Global pool query returns capped, newest-first, role-tagged entries
- [x] Unit tests with fixture day packet

### 008.7 — Failure / retry / infra_skip hygiene

Unify Kickoff/Research timeout, schema, budget, diversity failures: one retry where specified, then terminal Failed/* ; set `infra_skip` when failure is operational (timeout, SDK down) vs thesis (valid SitOut is not infra_skip).

#### Acceptance criteria

- [x] Failure taxonomy documented in code + mapped to session flags
- [x] Other factories continue when one fails
- [x] Unit tests cover timeout → infra_skip and BudgetExceeded path
- [x] Stage modals can later show error detail (error payload stored)

### 008.8 — Usage metering

Record per-run / per-factory token usage and cost when SDK provides it (`getUsage` or stream events). Surface totals for Settings/Daily views later.

#### Acceptance criteria

- [x] Usage rows persisted keyed by factory + session + stage
- [x] Missing usage from mock/local still leaves null cost without crashing
- [x] Helper aggregates daily SDK spend across factories
- [x] Unit tests with fixture usage payloads

### 008.9 — Remediate undici via @cursor/sdk override

Security Audit CI failed on PR after adding `@cursor/sdk`: nested `@connectrpc/connect-node@1.7.0` pulled `undici@5.29.0` (moderate/high; no upstream fix on undici 5). Force patched `undici@6.28.0` under connect-node via npm `overrides`.

#### Acceptance criteria

- [x] `npm audit --audit-level=moderate` reports 0 vulnerabilities
- [x] `@connectrpc/connect-node` resolves `undici@6.28.0` (override)
- [x] Existing unit tests / lint / typecheck / build still pass
