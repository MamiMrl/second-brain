# Context

Glossary of domain terms for the Second Brain personal RAG assistant.

## Terms

### Document

A single ingested source thing — a PDF, a recipe file, a fitness note, or a book of Kindle highlights. Has its own identity and record, independent of how it is split for search. The unit of ingestion, re-ingestion, and citation parentage.

### Chunk

A retrievable piece of exactly one Document, carrying an embedding. The unit of vector search. Chunks never exist without a parent Document.

### Source Artifact

The original capture a Document came from — a notebook photo, a voice recording, a Kindle export file. Kept for reference, never searched directly. Only confirmed text becomes a Document.

### Transcription

The step that turns a Source Artifact into a draft Document (via vision model or dictation). A transcription is not a Document until the user reviews and confirms it.

### Fitness Note

One Document per day of training or body tracking, dated by filename. Free-form text — exercises, weights, bodyweight, how it felt. No structured schema; the date is the only guaranteed field.

### Book (Kindle)

For Kindle content, the Book is the Document; each highlight is one Chunk of it. Re-ingesting a cumulative Kindle export merges new highlights into the existing Book rather than replacing it.
