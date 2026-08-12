# EPIC: Fireguard — unit-test quality gate

Port the portable `fireguard` CLI from [davgor.github.io](https://github.com/davgor/davgor.github.io) into CapitalGains: grade agent-authored Vitest unit tests (A–F) via AST, 100× flake isolation, and mutation testing. Wire npm scripts, PR CI job, and delivery skills.

## Acceptance criteria

- [x] `fireguard/` directory copied with README (self-contained tool)
- [x] `fireguard/package.json` sets `"type": "module"` so the CLI runs under Electron repos without a root ESM package type
- [x] `.fireguardrc.json` present and scoped to `src/**/*.{test,spec}.{ts,tsx}`
- [x] `npm run fireguard` / `npm run test:fireguard` scripts exist; peers `tsx` + `minimatch` installed
- [x] `npm test` includes fireguard's own Vitest suite
- [x] `.github/workflows/pr-checks.yml` has a `fireguard` job with `--comment-pr` and base-ref fetch
- [x] Delivery skills / rules / README require fireguard when unit tests change; **F** fails delivery
- [x] `npm run test:fireguard`, `npm run fireguard`, lint, typecheck, deadcode, and build pass
