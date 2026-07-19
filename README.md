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

**Open / next up:** query-time filter inference (explicit flags vs keyword rules vs LLM pre-step — leaning LLM pre-step with explicit override), embedding model choice, conversation memory scope.

## Getting started

Nothing to run yet. Once M1 lands:

```sh
npm install
cp .env.example .env   # Atlas URI, Anthropic + LangSmith keys
npm run ingest -- <path> --type <recipe|fitness|kindle|pdf>
npm run ask -- "what was my deadlift plan in March?"
```
