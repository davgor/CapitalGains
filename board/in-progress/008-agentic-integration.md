# EPIC: Agentic integration (Phase 2)

Wire Cursor SDK for Kickoff, Research ranking, and Lessons only. Control factory uses a **frozen** kickoff prompt. Explorers get regime + global lessons (role-tagged) + word budget + Explore-mode diversity. Research is **tape-bounded**; SitOut allowed. Schema/budget failures → retry once then Failed/* with `infra_skip` when appropriate. Usage metering via SDK.

**Depends on:** 007 Deterministic engine + honesty.  
**Plan:** CapitalGains Feature Plan — Kickoff/Research/Lessons + Phase 2.  
**Blocks:** 009 (full UI against live agent artifacts), soft-blocks 010.

Broken down into sub-tickets 008.1–008.8. This epic is done when all of them are.

008.1 Cursor SDK client + settings key · 008.2 Kickoff Zod + word budget · 008.3 Control frozen prompt · 008.4 Explorer Kickoff + global lessons + diversity · 008.5 Tape-bounded Research agent · 008.6 Lessons agent + role-tagged pool · 008.7 Failure/retry/infra_skip hygiene · 008.8 Usage metering

## Acceptance criteria

- [ ] All sub-tickets 008.1–008.8 are in `board/done/` with criteria verified
- [ ] A day can run with agents for explorers and frozen Control without agentic monitoring/purchases/outcome
- [ ] Bloated kickoff (>350 words after retry) never reaches Research
- [ ] Off-tape Research symbols never reach Purchases
