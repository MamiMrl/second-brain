# Domain docs: single-context layout

This repo uses a single domain context. Skills read from:

- **`CONTEXT.md`** (repo root) — domain language, key terms, architectural principles
- **`docs/adr/`** (repo root, optional) — architectural decision records

## Consuming domain docs

Skills like `diagnosing-bugs`, `tdd`, and `improve-codebase-architecture` read `CONTEXT.md` at the start of a run to:

- Learn the project's ubiquitous language (domain terms, concepts)
- Understand the tech stack and constraints
- Reference prior architectural decisions

If you don't have `docs/adr/` yet, that's fine — the skills work without it. Create it when you have decisions worth recording.

## Keeping domain docs fresh

Update `CONTEXT.md` and `docs/adr/` as the project evolves. Skills will pick up changes on their next run.
