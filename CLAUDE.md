# Claude Code Instructions

## Agent skills

### Issue tracker

GitHub Issues. External PRs are not treated as feature requests; they're reviewed separately. See `docs/agents/issue-tracker.md`.

### Triage labels

Standard five-label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at repo root describes the domain. Architectural decisions in `docs/adr/` if they exist. See `docs/agents/domain.md`.

### Branching

One feature branch per issue, not direct commits to `main`. Branch as `issue-<number>-<short-slug>` off `main`, commit there, then open a PR with `gh pr create` referencing the issue (`Closes #<number>`) instead of pushing straight to `main`. Merge via the PR once checks/review pass — don't merge immediately after opening it unless the user explicitly asks to.
