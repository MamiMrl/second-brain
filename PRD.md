# PRD: Second Brain — Personal RAG Assistant

## 1. Overview

A personal document Q&A system ("second brain") that ingests personal knowledge — PDFs, food recipes, fitness notes, and Kindle highlights — and answers natural-language questions with **source citations**, so every answer is traceable back to the original document or note.

**Owner:** Single user (personal tool)
**Status:** Draft
**Last updated:** 2026-07-20

## 2. Problem Statement

Personal knowledge is scattered across PDFs, recipe collections, fitness logs, and Kindle highlights. Finding "that one recipe" or "what did that book say about habit formation" requires manual searching across formats. There is no unified, queryable interface — and generic LLM chat can't answer from *my* documents, or hallucinates answers not grounded in them.

## 3. Goals

- Single ingestion pipeline for heterogeneous personal content (PDF, recipes, fitness notes, Kindle notes).
- Ask questions in natural language; get answers **grounded in ingested content only**.
- Every answer includes citations (document name, chunk/page, category).
- Category-aware retrieval: filter by document type (recipe / fitness / kindle / pdf) and language at query time.
- Full observability: every retrieval + generation traced in LangSmith to verify groundedness.

### Non-Goals (v1)

- Multi-user support, auth, or sharing. *(Deferred, not rejected — see §9.1 "Multi-user & horizontal scaling" for what changes if this becomes a multi-user product later.)*
- Real-time sync from Kindle/other services (manual export/import is fine).
- Mobile app or browser extension.
- Editing/managing documents inside the app (filesystem/DB is source of truth).

## 4. Users & Use Cases

Single user. Representative queries:

| Use case | Example query | Expected behavior |
|---|---|---|
| Recipe recall | "What was the ratio of flour to water in my sourdough recipe?" | Answer + citation to recipe doc |
| Recipe discovery | "Which of my saved recipes use chickpeas and are under 30 min?" | Filtered retrieval over `type=recipe` |
| Fitness history | "What was my deadlift progression plan from March?" | Answer + citation to fitness note |
| Book knowledge | "What did Atomic Habits say about habit stacking?" | Answer + citation to Kindle highlight |
| Cross-document | "Summarize everything I have about protein intake" | Multi-source answer, multiple citations |
| Grounding check | Question with no relevant content | "I don't have anything about that" — no hallucination |

## 5. Architecture

### 5.1 Stack

| Layer | Technology |
|---|---|
| Orchestration | LangChain (TypeScript / `langchain` + `@langchain/mongodb`) |
| Vector store | MongoDB Atlas Vector Search (`MongoDBAtlasVectorSearch`) |
| Metadata + filtering | Documents collection resolves filters; chunks collection carries embeddings |
| Observability | LangSmith — traces every retrieval and generation |
| LLM | Claude (via `@langchain/anthropic`), model: `claude-sonnet-4-6` (configurable) |
| Embeddings | Voyage AI `voyage-3.5` (native Anthropic-recommended provider; Matryoshka truncation + quantization supported) |
| Runtime | Node.js / TypeScript |

### 5.2 Data flow

```
                 ┌────────────────────────────────────────────┐
  PDFs ────────► │                                            │
  Recipes ─────► │  Ingestion pipeline                        │
  Fitness ─────► │  load → parse → chunk → embed → upsert     │
  Kindle notes ► │                                            │
                 └───────────────────┬────────────────────────┘
                                     ▼
              MongoDB Atlas — two collections (documents, chunks)
                                     ▲
                                     │ vector search + metadata pre-filter
                 ┌───────────────────┴────────────────────────┐
  Question ────► │  RAG chain: retrieve → (rerank) → generate │ ────► Answer + citations
                 └───────────────────┬────────────────────────┘
                                     ▼
                              LangSmith traces
                     (retrieval sets, prompts, outputs)
```

### 5.3 Schema (MongoDB — Document/Chunk model)

Two collections, per the domain model (see [CONTEXT.md](./CONTEXT.md)): `documents` (one record per ingested source thing — PDF, recipe, day's fitness note, Kindle book) and `chunks` (one record per searchable piece of exactly one Document, carrying the embedding). Chunks reference their parent Document by `documentId`; re-ingestion updates a Document and its Chunks in place (idempotent upsert, FR-1.5), keeping citations stable.

```jsonc
// documents collection
{
  "_id": "...",
  "type": "recipe" | "fitness" | "kindle" | "pdf",
  "title": "Sourdough Bread v3",                // or Book title for kindle
  "source": "recipes/sourdough-v3.md",           // path or origin
  "language": "en" | "tr" | ...,
  "author": "James Clear",                       // kindle only
  "date": "2026-07-19",                          // fitness only, from filename
  "sourceArtifact": "artifacts/sourdough-v3.jpg", // recipes/fitness: photo/voice origin, if any
  "contentHash": "...",                          // idempotent re-ingestion
  "ingestedAt": "2026-07-19T...",
  "updatedAt": "2026-07-19T..."
}

// chunks collection
{
  "_id": "...",
  "documentId": "...",       // parent Document, always required
  "text": "chunk content",
  "embedding": [/* vector */],
  "chunkIndex": 3,
  "page": 12,                    // PDFs only
  "highlightDate": "2026-05-01", // kindle only — this highlight's date, not the Book's
  "createdAt": "2026-07-19T..."
}
```

Citations and generation join back to `documents` via `chunks.documentId` for `type`/`title`/`source`/`author`; type/date/book filters (FR-2.2) resolve against `documents` before the vector search runs.

### 5.4 Atlas Vector Search index

- Vector index on `chunks.embedding` (cosine similarity, dims per embedding model).
- Filter fields indexed on `chunks`: `documentId`, `page`, `highlightDate`. Type/language/book/date-range filters resolve to a set of `documentId`s first (fast metadata query against `documents`), then vector search pre-filters `chunks` by `documentId in [...]`.
- Retrieval uses Atlas **pre-filtering** (`$vectorSearch.filter`) so the resolved `documentId` set narrows the search space before ANN, not after.

## 6. Functional Requirements

### FR-1: Ingestion

- **FR-1.1** Ingest PDFs: parse (page-aware), chunk (~800–1200 tokens, overlap ~150), preserve page numbers in metadata.
- **FR-1.2** Ingest recipes (Markdown/text): one document per recipe; keep recipe title, ingredients/steps structure in metadata where possible.
- **FR-1.3** Ingest fitness notes (Markdown/text): date-aware metadata for temporal queries.
- **FR-1.4** Ingest Kindle notes: parse Kindle export (`My Clippings.txt` or HTML export); one chunk per highlight; capture book, author, highlight date.
- **FR-1.5** Idempotent re-ingestion via LangChain's Indexing API (`RecordManager`): content hash + source ID + write time per record; re-running on unchanged content is a no-op. Cleanup mode: `incremental` (delete stale records per source ID as it's re-ingested) as the v1 default — minimizes any window where duplicate content is visible to retrieval, vs. `full`'s end-of-run cleanup.
- **FR-1.6** Language detection per document, stored as `metadata.language`.
- **FR-1.7** CLI command: `ingest <path> [--type <recipe|fitness|kindle|pdf>]`. `<path>` may be a file or a directory (recursive, native — not a shell-loop responsibility). `--type` is an optional override; default is auto-detection by file extension (Markdown → recipe/fitness by path convention, `.txt`/`.html` Kindle export format → kindle, `.pdf` → pdf).
- **FR-1.8** Batch ingestion aborts on first failure (fail-fast, no partial/best-effort runs) with an actionable, error-type-specific message rather than a raw stack trace. Known cases handled explicitly: PDF password-protected, PDF corrupted/truncated, PDF scanned/image-only (no extractable text), Kindle export unrecognized format, Kindle export non-UTF8/BOM encoding, fitness filename not matching `YYYY-MM-DD.md`, empty file, file not found, permission denied.

### FR-2: Retrieval

- **FR-2.1** Vector similarity search (top-k, default k=6) via `MongoDBAtlasVectorSearch`.
- **FR-2.2** Metadata pre-filtering by `type`, `language`, `book`, and date range. Filters come from an LLM pre-step (structured output: `{type?, dateRange?, book?}`) behind a `FILTER_MODEL` config (default: local Qwen3-8B via Ollama; swappable to Haiku/others). Explicit CLI flags always override inference; when the model is unsure it must return no filter (search everything); the inferred filter is logged in every LangSmith trace.
- **FR-2.3** Return chunk text + full metadata for citation construction.

### FR-3: Generation & Citations

- **FR-3.1** Answer generated **only** from retrieved chunks; system prompt forbids outside knowledge.
- **FR-3.2** Citations via Anthropic's native Citations API (`citations.enabled: true` on retrieved chunks passed as documents) — not a custom post-hoc formatting step. Claude's response returns per-sentence citation objects (`cited_text`, `document_title`, location range); rendered inline as numbered markers `[1]` with a reference list mapping each to `document_title` (from the parent Document's `type`/`title`/`source`) + the type-specific ref (page for PDF, highlight date for kindle, etc., from FR-2.3/§5.3 metadata) + `cited_text` shown on demand.
- **FR-3.3** "I don't know" gate, three layers: (1) cheap score pre-filter skips generation on near-empty retrieval; (2) after generation, a groundedness/faithfulness check verifies each claim in the draft answer is entailed by the retrieved chunks — unsupported claims trigger abstention ("I don't have information about that in your documents") instead of returning the draft; (3) the same groundedness check runs offline in LangSmith (FR-5.3) against the eval set — including ~5 deliberately unanswerable questions — to tune thresholds and measure false-confidence rate. Never fabricate.
- **FR-3.4** Answers in the language of the question when source language allows.

### FR-4: Query Interface

- **FR-4.1** CLI: `ask "<question>" [--type recipe] [--language en]`.
- **FR-4.2** (v1.1) Minimal local web UI or chat REPL with conversation memory.

### FR-5: Observability (LangSmith)

- **FR-5.1** Every query produces a LangSmith trace covering: input question, applied filters, retrieved chunks + scores, final prompt, generation output.
- **FR-5.2** Traces tagged with `type` filter and answer/no-answer outcome for filtering in the LangSmith UI.
- **FR-5.3** Groundedness/faithfulness evaluation: LangSmith evaluator (LLM-as-judge, same check used inline per FR-3.3) scoring whether each claim in the answer is supported by retrieved chunks; run on a curated eval dataset (~20–30 Q/A pairs, incl. ~5 deliberately unanswerable) on demand.
- **FR-5.4** Eval dataset authoring: hybrid — candidates LLM-generated from the actual ingested corpus (RAGAS-style), then human-reviewed/edited/rejected before being locked in as ground truth (target: >95% spot-check acceptance rate, else regenerate the batch). Each example carries question + reference answer + reference chunk(s)/document(s) (not answer alone), so retrieval hit rate and generation faithfulness can be scored independently.

## 7. Non-Functional Requirements

- **Latency:** end-to-end answer < 6s p50 (retrieval < 1s).
- **Cost:** personal-scale; Atlas free/flex tier acceptable at v1 volumes (< 50k chunks).
- **Privacy:** personal documents — no data leaves the pipeline except to embedding/LLM APIs and LangSmith; secrets in `.env`, never committed.
- **Portability:** ingestion is re-runnable from source files; MongoDB is not the source of truth for raw documents.

## 8. Success Metrics

| Metric | Target |
|---|---|
| Groundedness (LangSmith eval on eval set) | ≥ 95% answers fully supported by cited chunks |
| Citation accuracy | 100% of answers include ≥1 valid citation (or explicit "no info") |
| Retrieval hit rate (relevant chunk in top-k on eval set) | ≥ 90% |
| Hallucination on out-of-scope questions | 0 fabricated answers on eval set |
| Ingestion idempotency | Re-ingestion produces 0 duplicates |

## 9. Milestones

1. **M1 — Skeleton:** TS project, Atlas cluster + vector index, LangSmith wired, embed/query round-trip with dummy data.
2. **M2 — Ingestion:** PDF + Markdown loaders, chunking, metadata schema, idempotent upsert, CLI `ingest`.
3. **M3 — RAG chain:** retriever with metadata pre-filter, citation-formatting prompt, "no info" threshold, CLI `ask`.
4. **M4 — Kindle:** clippings parser, book/author metadata, book-scoped queries.
5. **M5 — Eval:** eval dataset, LangSmith groundedness evaluator, tune chunking/k/threshold against metrics.
6. **M6 (v1.1) — UI:** chat REPL or minimal web UI with conversation memory.

## 9.1 Post-v1 Roadmap

- **Fitness analytics (v2):** structured extraction of exercises/weights/bodyweight at ingest, enabling exact answers to counts, PRs, and trends ("how many workout days this year", "deadlift PR", weight graphs). V1 explicitly declines these with "date-aware retrieval only"; the sole exact query in v1 is workout-day counts via a metadata query on fitness Documents.
- **Fitness capture (v2):** design a low-friction logging path — candidate: a dedicated app with export/API (e.g. Strong/Hevy) connected via API, or dictation-first flow feeding the transcription pipeline. Paper should not be the required medium.
- **Weekly-plan integration (later):** the voice-transcription app used for weekly planning could feed fitness notes automatically.
- **Multi-user & horizontal scaling (later, if this becomes a shared product):** the production-fundamentals deferred by the v1 Non-Goals — auth/authz, per-user data isolation, rate limiting, circuit breakers, stateless service design for horizontal scaling, backup/DR, GDPR/CCPA compliance — become required if a second user ever exists. Architecture note for that future: keep the RAG chain (retrieve → generate) and CLI layer decoupled enough that the chain could sit behind a stateless API service later without a rewrite; avoid baking single-user assumptions (e.g. a single global `.env`, no `userId` on Documents/Chunks) any deeper than necessary.

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Poor retrieval on short notes (recipes/highlights) | Chunk-per-highlight, title-prefixed chunks, tune k |
| Category inference from query is wrong | Always allow explicit `--type` override; log inferred filter in trace |
| Mixed-language content hurts embedding quality | Multilingual embedding model; `language` filter |
| Kindle export format changes | Isolate parser behind an interface; test fixtures per format |
| Atlas free-tier vector search limits | Volume is small; monitor index size; upgrade tier if needed |

## 11. Open Questions

*(none — all resolved as of 2026-07-21)*
