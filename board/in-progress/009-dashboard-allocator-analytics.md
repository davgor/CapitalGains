# EPIC: Dashboard, allocator, analytics (Phase 3)

Ship the CapitalGains UI from the wireframe: header (Daily Limit, Daily Profit net, Settings), named factory rows with role/evidence weight, selectable stage nodes + detail modals (grey incomplete), add/rename factories, evidence-weighted capital, promote/kill/clone, net leaderboards vs Control/SPY.

**Depends on:** 007 (engine), 008 (agent artifacts for live modals; UI can stub earlier but epic completes against real store).  
**Plan:** CapitalGains Feature Plan — UI + promote/kill + Phase 3.

Broken down into sub-tickets 009.1–009.9. This epic is done when all of them are.

009.1 App shell header + Daily Limit/Profit · 009.2 Settings modal (keys, friction, risk, promote thresholds) · 009.3 Factory rows + add/rename + late-queue · 009.4 Stage nodes + grey states · 009.5 Stage detail modals · 009.6 Evidence-weighted capital allocator · 009.7 Promote/kill/clone controls · 009.8 Analytics leaderboard · 009.9 Black/green hacker terminal theme

## Acceptance criteria

- [ ] All sub-tickets 009.1–009.9 are in `board/done/` with criteria verified
- [ ] User can operate a paper day from the UI without editing DB by hand
- [ ] Incomplete stages are greyed; completed stages open modals with persisted artifacts
- [ ] Daily Profit display uses net friction-adjusted P&L
- [ ] UI uses the black/green hacker terminal theme (009.9)
