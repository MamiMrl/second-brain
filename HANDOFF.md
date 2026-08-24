# Second Brain — Session Handoff

> **📌 Note (2026-08-11):** Handoff system redesigned. Full session context now lives in **`.claude/handoffs/`**
> - **Registry:** `.claude/handoffs/INDEX.md` — all handoffs + task tracking
> - **Current:** `.claude/handoffs/HANDOFF-2026-08-24-m3-verified.md` — latest full context
> - **Why:** persistent, task-aware, survives restarts, indexed by date

**Last updated:** 2026-08-24  
**Session focus:** M3 end-to-end verification (issue #2) closed; M7 nutrition agent also complete since last update

---

## Current Status

| Milestone | Status | Notes |
|---|---|---|
| **M1** | ✅ Complete | Skeleton: TS project, Atlas cluster, vector index, LangSmith wired, embed/query roundtrip |
| **M2** | ✅ Complete | Ingestion: PDF + Markdown loaders, chunking, RecordManager idempotent upsert, `ingest` CLI with auto-detect type + fail-fast errors |
| **M3** | ✅ Complete | Query CLI: metadata pre-filtering (FR-2.2), existence/negation routing (FR-2.4), vector search (FR-2.1), citations via Anthropic Citations API (FR-3.1/3.2), generation with "I don't know" gate (FR-3.3). Verified end-to-end 2026-08-24 (issue #2) — latency well above the <6s p50 target, deferred to M5. |
| **M4** | ⏳ Pending — next up | Kindle: clippings parser, book/author metadata, book-scoped queries. Issue #3, `ready-for-agent`, unblocked. |
| **M5** | ⏳ Pending | Eval: eval dataset, LangSmith groundedness evaluator, tune chunking/k/threshold + groundedness `MIN_TOP_SCORE` |
| **M6** | ⏳ Pending | UI: chat REPL or minimal web UI with conversation memory |
| **M7** | ✅ Complete | Agentic nutrition-recommendation layer (Claude Agent SDK): CSV/screenshot ingestion, nutrition agent MVP, variety/non-repetition. Closed issue #1. |

**Latest commits:**
- `e3d7c83` Add missing "nutrition" to filter-model's type enum
- `7f4705f` Verify M3 end-to-end; fix book-filter bug found during verification
- `dd2f7ad` Fix --type nutrition skipping CSV pairing
- `bf1b873` Support Cronometer's real two-file export format
- `5a51462` Switch embeddings to voyage-4-lite
- `be39e02` Add M7 nutrition-recommendation agent (closes #1)

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

1. **Start M4** — Kindle ingestion (issue #3, `ready-for-agent`, unblocked)
   - Parser for `My Clippings.txt` and HTML exports
   - Book/author/highlight-date metadata
   - Book-scoped queries: "which of my books mention X?"

### Medium term (this sprint)

2. **M5 — Eval dataset + latency/threshold tuning**
   - Author ~20–30 Q/A pairs (hybrid LLM-generate + human review)
   - Three categories: positive/unknown/confirmed-absence
   - Sync to LangSmith Dataset
   - Run groundedness evaluator
   - Tune `groundedness.ts`'s `MIN_TOP_SCORE` placeholder (currently 0.3)
   - Investigate end-to-end latency (currently tens of seconds per query vs. <6s p50 target, dominated by the local Ollama filter model)

3. **M6 — UI** (v1.1)
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
| `src/query/` | M3 query CLI code (complete, verified) |
| `src/agent/` | M7 nutrition-recommendation agent code |
| `eval/dataset.jsonl` | Eval dataset (empty until M5) |

---

## Notes for Next Session

- M3 is done and verified — citations, existence routing, and the "don't know" gate all confirmed correct against live fixtures. Latency is the known open risk (tens of seconds per query, not tuned).
- Kindle parser (M4) is relatively isolated — can be built in parallel if needed. It's the next open issue (#3).
- Eval dataset (M5) is the gating factor for tuning retrieval quality *and* latency; don't defer it much longer.
- UI (M6) is nice-to-have for v1.1 — v1 is usable as CLI only.
- Watch for shotgun surgery when adding a new document type: `DocumentType` (`src/ingest/types.ts`) is hand-copied into `src/scripts/ingest.ts`, `src/scripts/ask.ts`, and `src/query/filter-model.ts`'s zod enum — the last one was found out of sync with `"nutrition"` and had to be fixed (2026-08-24).
