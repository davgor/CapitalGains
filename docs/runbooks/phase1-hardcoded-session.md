# Phase 1 proof — hardcoded full-day session

This runbook documents the deterministic Phase 1 path (epic 007): a factory runs Kickoff(skip) → Research(hardcoded multi-name plan) → Purchases → Monitoring → Outcome **without** the Cursor SDK.

## How to verify

```bash
npx vitest run src/main/engine/fullDay.integration.test.ts
# or
npm test
```

The harness injects:

- a frozen US/Eastern `Clock`
- `createMockMarketData` quotes
- a hardcoded NVDA + GOOGL allocation basket

Assertions cover multi-name fills (not collapsed to one ticker), residual cash, net vs gross P&L, dual benchmarks (full daily limit vs deployed capital) plus SPY same-session return, and resume after a simulated mid-monitoring restart (fills replayed idempotently; paper broker hydrated from the store).

Daily Profit aggregates must use **net** P&L only (`dailyProfitFromOutcomes`).
