# Second Brain — Session Handoff

> **📌 Note (2026-08-11):** Handoff system redesigned. Full session context now lives in **`.claude/handoffs/`**
> - **Registry:** `.claude/handoffs/INDEX.md` — all handoffs + task tracking
> - **Current:** `.claude/handoffs/HANDOFF-2026-08-11.md` — today's full context
> - **Why:** persistent, task-aware, survives restarts, indexed by date

**Last updated:** 2026-08-11  
**Session focus:** Matt Pocock skills setup + handoff system redesign + auto mode

---

## Current Status

| Milestone | Status | Notes |
|---|---|---|
| **M1** | ✅ Complete | Skeleton: TS project, Atlas cluster, vector index, LangSmith wired, embed/query roundtrip |
| **M2** | ✅ Complete | Ingestion: PDF + Markdown loaders, chunking, RecordManager idempotent upsert, `ingest` CLI with auto-detect type + fail-fast errors |
| **M3** | 🔄 In progress | Query CLI: metadata pre-filtering (FR-2.2), existence/negation routing (FR-2.4), vector search (FR-2.1), citations via Anthropic Citations API (FR-3.1/3.2), generation with "I don't know" gate (FR-3.3) |
| **M4** | ⏳ Pending | Kindle: clippings parser, book/author metadata, book-scoped queries |
| **M5** | ⏳ Pending | Eval: eval dataset, LangSmith groundedness evaluator, tune chunking/k/threshold |
| **M6** | ⏳ Pending | UI: chat REPL or minimal web UI with conversation memory |

**Latest commits:**
- `f8bd22e` Wire generation with Anthropic's native Citations API (FR-3.1/3.2/3.4)
- `809fe4a` Build M3 query-time filtering, retrieval, and existence routing (FR-2.x)
- `ae52f61` Implement M2 ingestion pipeline and clean up repo documentation

---

## This Session (2026-08-10)

✅ **Completed:**
- Installed `mattpocock-skills` plugin globally (applies to all projects in `/Users/neu/Code/active/`)
- Configured agent skills for second-brain:
  - Issue tracker: GitHub Issues (PRs separate)
  - Triage labels: defaults (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`)
  - Domain docs: single-context (reads `CONTEXT.md`, optional `docs/adr/`)
- Created configuration files:
  - `CLAUDE.md` — Agent skills block
  - `docs/agents/issue-tracker.md` — GitHub workflow
  - `docs/agents/triage-labels.md` — Label vocabulary
  - `docs/agents/domain.md` — Domain doc consumer rules

✅ **Skills now available:**
- `/triage`, `/to-tickets`, `/diagnosing-bugs`, `/improve-codebase-architecture`, `/tdd`, and others

---

## Next Steps

### Immediate (next session)

1. **Complete M3** — Query CLI
   - Current: filtering + existence routing + citations wired
   - Remaining: integration testing, edge cases, latency tuning (target: <6s p50)
   - Test with real queries on ingested documents

2. **Start M4** — Kindle ingestion
   - Parser for `My Clippings.txt` and HTML exports
   - Book/author/highlight-date metadata
   - Book-scoped queries: "which of my books mention X?"

### Medium term (this sprint)

3. **M5 — Eval dataset**
   - Author ~20–30 Q/A pairs (hybrid LLM-generate + human review)
   - Three categories: positive/unknown/confirmed-absence
   - Sync to LangSmith Dataset
   - Run groundedness evaluator

4. **M6 — UI** (v1.1)
   - Chat REPL or minimal web UI
   - Conversation memory (query rewriting for follow-ups)

---

## Key Decisions (Locked)

**Design frozen** per PRD grilling (July 20). See `README.md` §"Design decisions so far" for full list.

Core decisions:
- Two-level Document/Chunk model (MongoDB collections)
- Voyage AI `voyage-3.5` for embeddings
- Anthropic Citations API for grounded generation (not custom formatting)
- LLM-based metadata pre-filter + exhaustive scan for existence/negation queries
- Eval dataset: hybrid LLM-generate + human review, stored in `eval/dataset.jsonl` (git-versioned)

---

## Open Questions

**None** — all PRD grilling branches resolved (Q1–Q9 confirmed 2026-07-20).

---

## How to Resume

1. Read this file and the PRD (`PRD.md`) for context
2. Check the commit history above for what was last worked on
3. Read the current milestone section (M3 / M4 / etc.) in PRD.md
4. If you need design clarity, grep for the FR (functional requirement) in PRD
5. For domain/terminology, see `CONTEXT.md`

---

## Useful Links

| File | Purpose |
|---|---|
| `PRD.md` | Complete product requirements + architecture |
| `CONTEXT.md` | Domain glossary (Document, Chunk, etc.) |
| `README.md` | Quick start, stack, design decisions |
| `docs/agents/` | Agent skill configuration (issue tracker, triage, domain) |
| `src/ingest/` | M2 ingestion CLI code |
| `src/query/` | M3 query CLI code (in progress) |
| `eval/dataset.jsonl` | Eval dataset (empty until M5) |

---

## Notes for Next Session

- M3 is the critical path — citations and "don't know" gate are high-risk areas. Focus on testing real queries.
- Kindle parser (M4) is relatively isolated — can be built in parallel if needed.
- Eval dataset (M5) is the gating factor for tuning retrieval quality; don't ship M1 without at least 5 test cases.
- UI (M6) is nice-to-have for v1.1 — v1 is usable as CLI only.
