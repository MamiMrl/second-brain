# Handoff — 2026-08-24 (M3 verification closed)

**Focus:** Close out issue #2 ("Verify M3 end-to-end") — ingest fixtures, run the three query paths live, check latency, fix docs.

**Status:** done. Issue #2 closed.

---

## What Was Done This Session

- Ingested `fixtures/` into MongoDB Atlas (`npm run ingest fixtures/`) — succeeded.
- Ran all three representative query paths against real Atlas + Ollama (`qwen3:8b`) + Anthropic:
  - Positive query ("sourdough hydration ratio") — generated answer, citation rendered correctly.
  - Confirmed-absence query ("do I have a quinoa recipe?") — routed through existence/negation scan (FR-2.4), confident "no".
  - Genuine-unknown query — FR-3.3 groundedness gate fired, abstained with the exact `ABSTAIN_MESSAGE`.
- **Found and fixed a real bug during verification**: `src/query/resolve-document-ids.ts` applied the Kindle-only `book` filter even when a non-Kindle `type` was already set. The local filter-model LLM sometimes hallucinates a `book` value on non-Kindle queries (e.g. `book: "sourdough recipe"` on a recipe query); left unguarded, that AND'd against the correct `type` filter and zeroed out every match — this was silently blocking the positive-query path. Fixed with a guard (`filter.book && query.type === "kindle"`) and added a regression test (`resolve-document-ids.test.ts`). Commit `7f4705f`.
- **Latency measured**: tens of seconds per query (38s–52s in repeated runs; one run exceeded 120s), well above the PRD's <6s p50 target. Dominated by the local Ollama filter model on CPU. Not tuned — explicitly deferred to M5 per the PRD's own eval/tuning milestone.
- Fixed README's stale "`ask` CLI ... not built yet" line; documented the verified behavior and the latency finding.
- Decided `fixtures/` stays as a **permanent regression fixture set** (it's already relied on by M7's nutrition tests too) — recorded in README.
- Code review (Standards + Spec axes) run on the diff — clean, one minor comment-length nit (accepted as-is).
- **Follow-on fix, same session**: while explaining the Shotgun Surgery code smell to the user, found a live example — `src/query/filter-model.ts`'s zod enum for `type` was missing `"nutrition"` (added to `DocumentType` back in M7, but this schema was never updated), meaning the query-time LLM filter could never validate `type: "nutrition"`. Fixed directly (no issue filed — trivial one-line fix). Commit `e3d7c83`.
- Both commits pushed to `origin/main`.

---

## What's NOT Done / Next Up

- **M4 — Kindle ingestion** (issue #3, `ready-for-agent`, unblocked): `My Clippings.txt` / HTML export parser, book/author/highlight-date metadata, book-scoped queries. This is the next open issue.
- **M5 — Eval + latency tuning**: latency is the known gating concern going in — tens of seconds per query vs. a 6s p50 target. `MIN_TOP_SCORE` groundedness threshold (`groundedness.ts`) is still an untuned placeholder (0.3). Both need the eval dataset to tune against.
- **Filter-model inference quality**: confirmed via live testing that even with `"nutrition"` now a legal enum value, the local `qwen3:8b` model doesn't reliably choose it — it sometimes stuffs "nutrition" into the `book` field instead. Same class of imprecision as the bug fixed this session; worth keeping in mind for M5 tuning, not an action item now.
- **M6 — UI**: still not started, still v1.1 scope.

---

## Worth Keeping / Key Context

- Both the `book`-filter bug and the `filter-model.ts` enum gap are examples of **shotgun surgery**: the `DocumentType` list (`src/ingest/types.ts`) is hand-copied in `src/scripts/ingest.ts`, `src/scripts/ask.ts`, and `src/query/filter-model.ts` instead of derived from one source. If a 6th document type is ever added, check all of these by hand.
- Fixtures now cover recipes, fitness, and nutrition (CSV pairs) — kindle fixtures still don't exist since M4 isn't built yet.
- Ollama (`qwen3:8b`) and `MONGODB_ATLAS_URI` are both confirmed live on this machine as of this session — no re-setup needed.

---

## Suggested Skills for Next Session

- `/implement` on issue #3 (M4 Kindle ingestion) — it's `ready-for-agent` and unblocked.
- `/tdd` for the clippings parser — good seam for red-green given the parser's well-defined input/output.
