# PRD: Second Brain — Personal RAG Assistant

## 1. Overview

A personal document Q&A system ("second brain") that ingests personal knowledge — PDFs, food recipes, fitness notes, and Kindle highlights — and answers natural-language questions with **source citations**, so every answer is traceable back to the original document or note.

**Owner:** Single user (personal tool)
**Status:** Draft
**Last updated:** 2026-07-19

## 2. Problem Statement

Personal knowledge is scattered across PDFs, recipe collections, fitness logs, and Kindle highlights. Finding "that one recipe" or "what did that book say about habit formation" requires manual searching across formats. There is no unified, queryable interface — and generic LLM chat can't answer from *my* documents, or hallucinates answers not grounded in them.

## 3. Goals

- Single ingestion pipeline for heterogeneous personal content (PDF, recipes, fitness notes, Kindle notes).
- Ask questions in natural language; get answers **grounded in ingested content only**.
- Every answer includes citations (document name, chunk/page, category).
- Category-aware retrieval: filter by document type (recipe / fitness / kindle / pdf) and language at query time.
- Full observability: every retrieval + generation traced in LangSmith to verify groundedness.

### Non-Goals (v1)

- Multi-user support, auth, or sharing.
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
| Metadata + filtering | Same MongoDB collection — metadata fields alongside embeddings |
| Observability | LangSmith — traces every retrieval and generation |
| LLM | Claude (via `@langchain/anthropic`), model: `claude-sonnet-4-6` (configurable) |
| Embeddings | Configurable (e.g. `voyage-3` or `text-embedding-3-small`) |
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
                 MongoDB Atlas (single collection)
                 { embedding, text, metadata: { type, title,
                   source, language, page, createdAt, ... } }
                                     ▲
                                     │ vector search + metadata pre-filter
                 ┌───────────────────┴────────────────────────┐
  Question ────► │  RAG chain: retrieve → (rerank) → generate │ ────► Answer + citations
                 └───────────────────┬────────────────────────┘
                                     ▼
                              LangSmith traces
                     (retrieval sets, prompts, outputs)
```

### 5.3 Document schema (MongoDB)

```jsonc
{
  "_id": "...",
  "text": "chunk content",
  "embedding": [/* vector */],
  "metadata": {
    "type": "recipe" | "fitness" | "kindle" | "pdf",   // category filter
    "title": "Sourdough Bread v3",
    "source": "recipes/sourdough-v3.md",                // path or origin
    "language": "en" | "tr" | ...,
    "page": 12,                    // PDFs only
    "book": "Atomic Habits",       // kindle only
    "author": "James Clear",       // kindle only
    "highlightDate": "2026-05-01", // kindle only
    "chunkIndex": 3,
    "ingestedAt": "2026-07-19T..."
  }
}
```

### 5.4 Atlas Vector Search index

- Vector index on `embedding` (cosine similarity, dims per embedding model).
- Filter fields indexed: `metadata.type`, `metadata.language`, `metadata.book`.
- Retrieval uses Atlas **pre-filtering** (`$vectorSearch.filter`) so category filters narrow the search space before ANN, not after.

## 6. Functional Requirements

### FR-1: Ingestion

- **FR-1.1** Ingest PDFs: parse (page-aware), chunk (~800–1200 tokens, overlap ~150), preserve page numbers in metadata.
- **FR-1.2** Ingest recipes (Markdown/text): one document per recipe; keep recipe title, ingredients/steps structure in metadata where possible.
- **FR-1.3** Ingest fitness notes (Markdown/text): date-aware metadata for temporal queries.
- **FR-1.4** Ingest Kindle notes: parse Kindle export (`My Clippings.txt` or HTML export); one chunk per highlight; capture book, author, highlight date.
- **FR-1.5** Idempotent re-ingestion: re-running on the same file updates rather than duplicates (content-hash or source-path based upsert).
- **FR-1.6** Language detection per document, stored as `metadata.language`.
- **FR-1.7** CLI command: `ingest <path> --type <recipe|fitness|kindle|pdf>`.

### FR-2: Retrieval

- **FR-2.1** Vector similarity search (top-k, default k=6) via `MongoDBAtlasVectorSearch`.
- **FR-2.2** Metadata pre-filtering by `type`, `language`, and `book` — user-specifiable or inferred from the query (e.g. "recipe" in question → filter `type=recipe`).
- **FR-2.3** Return chunk text + full metadata for citation construction.

### FR-3: Generation & Citations

- **FR-3.1** Answer generated **only** from retrieved chunks; system prompt forbids outside knowledge.
- **FR-3.2** Every answer lists citations: `[title, type, source, page/highlight ref]`.
- **FR-3.3** If retrieval yields no sufficiently relevant chunks (score threshold), respond "I don't have information about that in your documents" — never fabricate.
- **FR-3.4** Answers in the language of the question when source language allows.

### FR-4: Query Interface

- **FR-4.1** CLI: `ask "<question>" [--type recipe] [--language en]`.
- **FR-4.2** (v1.1) Minimal local web UI or chat REPL with conversation memory.

### FR-5: Observability (LangSmith)

- **FR-5.1** Every query produces a LangSmith trace covering: input question, applied filters, retrieved chunks + scores, final prompt, generation output.
- **FR-5.2** Traces tagged with `type` filter and answer/no-answer outcome for filtering in the LangSmith UI.
- **FR-5.3** Groundedness evaluation: LangSmith evaluator (LLM-as-judge) scoring whether the answer is supported by retrieved chunks; run on a curated eval dataset (~20–30 Q/A pairs) on demand.

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

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Poor retrieval on short notes (recipes/highlights) | Chunk-per-highlight, title-prefixed chunks, tune k |
| Category inference from query is wrong | Always allow explicit `--type` override; log inferred filter in trace |
| Mixed-language content hurts embedding quality | Multilingual embedding model; `language` filter |
| Kindle export format changes | Isolate parser behind an interface; test fixtures per format |
| Atlas free-tier vector search limits | Volume is small; monitor index size; upgrade tier if needed |

## 11. Open Questions

- Embedding model choice: multilingual (Voyage / Cohere) vs OpenAI — depends on how much non-English content exists.
- Should query-time category inference be an LLM pre-step (self-query retriever) or simple keyword rules in v1?
- Conversation memory in v1 CLI or defer entirely to v1.1?
