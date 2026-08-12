# Market clock (America/New_York)

Phase 1 session stages are evaluated in **America/New_York** (US/Eastern), not the host machine timezone.

| Window | Eastern time (approx) |
|--------|------------------------|
| Regime / feature tape | 09:05 |
| Research | 09:15 |
| Purchases | 09:35–09:45 |
| Monitoring | until 16:00 official close |
| Outcome | after close |

Holiday and half-day stubs are treated as **closed** in Phase 1 (enriched later in epic 010). Inject a `Clock` in tests — never read wall-clock in unit tests.

Implementation: `src/main/engine/clock/marketClock.ts`.
