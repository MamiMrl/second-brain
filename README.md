# Second Brain — Personal RAG Assistant

A personal document Q&A system that ingests PDFs, food recipes, fitness notes, and Kindle highlights, then answers natural-language questions with source citations — grounded strictly in your own content.

> **Status: design phase.** No code yet. The domain model and requirements are being hammered out through interview sessions; see [Design docs](#design-docs).

## What it will do

- **Ingest** heterogeneous personal content: PDFs, recipes (transcribed from a physical notebook via photo/voice), daily fitness notes, Kindle highlights.
- **Answer questions** like "what's the flour/water ratio in my sourdough?" or "what did Atomic Habits say about habit stacking?" — with citations to the exact source.
- **Refuse to hallucinate**: if the answer isn't in your documents, it says so.
- **Trace everything** in LangSmith to verify answers are actually grounded in retrieved content.

## Stack (planned)

| Layer | Technology |
|---|---|
| Orchestration | LangChain (TypeScript) |
| Vector store + metadata | MongoDB Atlas Vector Search (`MongoDBAtlasVectorSearch`) |
| LLM | Claude via `@langchain/anthropic` |
| Observability | LangSmith |
| Runtime | Node.js / TypeScript |

## Core domain model

Two-level model (see [CONTEXT.md](./CONTEXT.md) for the full glossary):

- **Document** — one ingested source thing (a PDF, a recipe, a day's fitness note, a Kindle book). Unit of ingestion, re-ingestion, and citation.
- **Chunk** — a searchable piece of exactly one Document, carrying an embedding. Unit of vector search.

Stored as two MongoDB collections; retrieval runs vector search over chunks with metadata pre-filtering (type / language / book / date).

## Design docs

| File | Purpose |
|---|---|
| [PRD.md](./PRD.md) | Product requirements: goals, architecture, functional requirements, milestones |
| [CONTEXT.md](./CONTEXT.md) | Domain glossary — canonical terms and their meanings |

## Design decisions so far

Decided in grilling sessions (interview-driven design):

1. **Two-level Document/Chunk model** over a flat chunk collection — makes idempotent re-ingestion, stable citations, and non-vector queries ("list my recipes") trivial.
2. **Kindle: Book = Document, highlight = Chunk.** Cumulative exports merge into existing Books.
3. **Recipes via transcription pipeline** — photo or voice dictation → draft Markdown → human review/confirm → ingest. Photos/audio are Source Artifacts, never searched directly.
4. **Fitness: one Markdown file per day** (`fitness/YYYY-MM-DD.md`), free-form, date from filename. No structured schema in v1.
5. **Fitness scope v1:** date-aware retrieval only — no counts/PRs/trends (those are v2, via structured extraction). Exception: workout-day counts work via plain metadata queries.
6. **Query-time filter inference:** LLM pre-step extracts `{type?, dateRange?, book?}` from the question (local Qwen3-8B via Ollama by default, `FILTER_MODEL`-configurable). Explicit CLI flags always override; unsure → no filter (search everything); inferred filter logged in every LangSmith trace.
7. **"I don't know" gate:** cheap score pre-filter (skip generation on near-empty retrieval) → per-claim groundedness/faithfulness check on the draft answer (LLM/NLI judge verifies each claim is entailed by retrieved chunks; unsupported → abstain) → same check reused offline in LangSmith against an eval set (incl. ~5 deliberately unanswerable questions) to tune thresholds.
8. **Citations via Anthropic's native Citations API**, not a custom formatting step — matches the industry-standard pattern (Perplexity/Notion-style inline numbered per-sentence citations). Claude returns `cited_text` + `document_title` + location per sentence; rendered as `[1]` markers with a reference list.
9. **Embedding model: Voyage AI `voyage-3.5`** — the practitioner-standard default for Claude-based RAG stacks (Anthropic's recommended embedding partner, native MongoDB Atlas integration, Matryoshka truncation + quantization support, strong multilingual quality).

**Open / next up:** conversation memory scope (v1 CLI vs v1.1), ingestion CLI details, eval dataset design, milestone ordering.

## Getting started

M1 skeleton is in place: TS project, dependencies, and an embed → store → vector-search round-trip script against dummy data.

```sh
npm install
cp .env.example .env   # fill in Atlas URI, Anthropic + Voyage + LangSmith keys
npm run typecheck
npm run roundtrip       # requires an Atlas vector index named "roundtrip_vector_index"
                        # on the roundtrip_chunks collection (field: embedding, cosine, dim 1024)
```

Ingestion and query CLIs (`npm run ingest`, `npm run ask`) land in M2/M3 — not built yet.
