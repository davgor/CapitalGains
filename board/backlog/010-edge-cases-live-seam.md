# EPIC: Market edge cases + live seam (Phase 4)

Harden calendar/data edge cases and add a **gated** live broker adapter behind the existing paper port. Live trading stays disabled until promote criteria and friction calibration are satisfied in-app.

**Depends on:** 007–009.  
**Plan:** CapitalGains Feature Plan — Phase 4 + live seam gate.

Broken down into sub-tickets 010.1–010.6. This epic is done when all of them are.

010.1 Holidays + half-days · 010.2 Stale quotes + rounding residuals · 010.3 Richer regime calendar/earnings · 010.4 Cost/P&L alerts · 010.5 Live broker adapter (disabled by default) · 010.6 Live gate checklist in UI

## Acceptance criteria

- [ ] All sub-tickets 010.1–010.6 are in `board/done/` with criteria verified
- [ ] Live path cannot arm without explicit gate checklist pass
- [ ] Paper remains default; broker port swap does not change factory/agent contracts
