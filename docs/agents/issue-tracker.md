# Issue tracker: GitHub

Issues live in [second-brain GitHub Issues](https://github.com/MamiMrl/second-brain/issues).

## Skills that write issues

- `/to-tickets` — converts findings into GitHub issues
- `/triage` — reads and labels incoming issues
- `improve-codebase-architecture` — proposes architectural changes as issues

## External PRs

External pull requests are **not** triaged as feature requests. They're reviewed separately as code contributions. The triage workflow focuses on issues (bugs, features, tasks).

## Workflow

When a skill creates or updates an issue:
1. It uses the `gh` CLI to create/label/comment
2. Labels follow the five canonical states (see `triage-labels.md`)
3. Issues are linked to ADRs in `docs/adr/` when relevant
