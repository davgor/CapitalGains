# Phase 2 — Agentic Kickoff / Research / Lessons

Epic 008 wires `@cursor/sdk` behind `AgentPort` for Kickoff, Research, and Lessons. Control uses a frozen kickoff prompt (no daily mutation). Research is tape-bounded; schema/budget/diversity failures retry once then terminal Failed/* with `infra_skip` for operational errors.

## Config

- `CURSOR_API_KEY` — required for live SDK runs (never committed)
- Model id is fixed: `composer-2.5` (`CURSOR_MODEL_ID` in `src/shared/agent/modelConfig.ts`)
- Control frozen kickoff: store config key `control.frozenKickoff`

## Verify (mocked, no network)

```bash
npx vitest run src/main/agent src/main/engine/orchestrator/agentSessionRunner.test.ts
npm test
```

Unit tests inject `createMockAgentPort`; CI never calls the live SDK.
