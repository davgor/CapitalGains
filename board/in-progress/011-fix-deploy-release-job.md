# EPIC: Fix Deploy release job (gh needs git repo)

Deploy fails on every successful `main` CI: packaging succeeds, then the `release` job dies with `failed to run git: fatal: not a git repository` when running `gh release create --generate-notes`. The job never checks out the repo and does not pass `--repo`, so `gh` cannot resolve the repository. Mirrored from the working [AI-DND-Matrix](https://github.com/davgor/AI-DND-Matrix) deploy workflow.

**Evidence:** Actions runs `31566228151` (v0.1.0), `31566323607` (v0.2.0), `31569122112` (v0.3.0) — all failed at Create GitHub Release with the same git error. No GitHub Releases exist despite version bumps.

011.1 Assert deploy release job has checkout + --repo · 011.2 Align release job with AI-DND-Matrix

## Acceptance criteria

- [ ] Unit test fails if `.github/workflows/deploy.yml` `release` job omits checkout at the release SHA or omits `--repo` on `gh release create`
- [ ] `release` job checks out `${{ needs.prepare.outputs.sha }}` (with sufficient history for `--generate-notes`) before downloading artifacts
- [ ] `gh release create` passes `--repo "${{ github.repository }}"`
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run deadcode`, `npm run build` pass
