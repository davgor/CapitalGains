# EPIC: Deterministic engine + honesty (Phase 1)

Build the non-agentic core of CapitalGains so a factory can run a full paper morning session with **hardcoded multi-name allocations**: US/Eastern market clock, SQLite persistence, feature tape, universe filters, friction-aware paper broker, risk engine (stops, caps, daily halt), SitOut, dual benchmarks (full limit vs deployed), idempotent resume, and missed-session `infra_skip` flagging.

**Depends on:** Electron + React + TypeScript scaffold (existing).  
**Plan:** CapitalGains Feature Plan — Path to edge + Phase 1.  
**Blocks:** 008 (agentic), 009 (dashboard/allocator), 010 (live seam).

Broken down into sub-tickets 007.1–007.10. This epic is done when all of them are.

007.1 Domain schema + SQLite store · 007.2 Market clock + session supervisor · 007.3 Market data port + quotes · 007.4 Feature tape + universe filters · 007.5 Paper broker with friction · 007.6 Risk engine · 007.7 Stage machine + SitOut + multi-name purchases · 007.8 Monitoring loop + Outcome dual benchmarks · 007.9 Idempotent resume + infra_skip · 007.10 Hardcoded full-day integration test

## Acceptance criteria

- [ ] All sub-tickets 007.1–007.10 are in `board/done/` with criteria verified
- [ ] A factory can be driven through Kickoff(skip)/Research(hardcoded)/Purchases/Monitoring/Outcome without Cursor SDK
- [ ] Net (friction-adjusted) P&L is the scored figure; gross is stored but not used for “daily profit” aggregates
- [ ] Multi-name baskets fill per symbol (e.g. NVDA + GOOGL), not collapsed to one ticker
