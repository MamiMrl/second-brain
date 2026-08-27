# Contributing

This is a personal hobby project — my own RAG assistant over my own notes, PDFs, and recipes. It's not actively looking for contributors, but the repo is public-adjacent and PRs/issues are welcome.

## Reporting a bug

Open a GitHub issue with repro steps. If it's about a specific ingestion type (PDF/recipe/fitness/Kindle), mention which one and, if you can, a minimal file that triggers it.

## Opening a PR

- Read [PRD.md](./PRD.md) and [CONTEXT.md](./CONTEXT.md) first — they're the source of truth for scope and terminology, and most design questions are already answered there.
- One feature branch per issue (`issue-<number>-<short-slug>` off `main`), not direct commits to `main`.
- `npm run typecheck` must pass.
- Match the existing code style: minimal comments (only for non-obvious *why*, never *what*), no speculative abstractions, no error handling for cases that can't happen.
- Small, focused PRs over large ones — this is a solo-maintained repo reviewed at hobby-project pace, not on an SLA.
