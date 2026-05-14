# Knowspace — Extracted Requirements

Distilled from `DESIGN.md` `## Vision`. Source of truth for build prioritization.

## Core Purpose

A lightweight, calm web-based knowledge workspace that

1. **imports an exported Notion workspace** and preserves it,
2. **indexes Google Docs** without replacing them,
3. **enriches everything** with entities/relationships from the Lovelace knowledge graph (the brief's "YottaGraph"),
4. **answers grounded questions** with citations.

Not a Notion clone. Not a Google Docs editor. A migration + retrieval product.

## Stack adaptation

Brief recommends Next.js / Tailwind / shadcn / pgvector. This project is already provisioned as a **Nuxt 3 + Vuetify 3 + TypeScript** Aether app. We use the platform's storage instead of re-inventing:

| Brief suggests              | We use                                                              |
| --------------------------- | ------------------------------------------------------------------- |
| Next.js + Tailwind          | Nuxt 3 + Vuetify 3 (already set up)                                 |
| Postgres (system of record) | Neon Postgres via `server/utils/neon.ts` (`store_3G7TFmC8YQ16s0uz`) |
| KV cache                    | Upstash Redis (`KV_REST_API_URL`)                                   |
| pgvector embeddings         | Phase 3 — start with Postgres `to_tsvector` full-text search        |
| YottaGraph                  | Elemental MCP / Query Server (entity enrichment)                    |
| Object storage              | Vercel Blob (Phase 2 — Notion zip uploads)                          |
| AI assistant                | `useAgentChat` over a deployed ADK agent (Phase 6)                  |

## Phased priorities

### Phase 1 — App Foundation [MVP target]

- [ ] Postgres schema setup route (`server/api/db/setup.post.ts`)
- [ ] Workspace shell: left sidebar (Pages tree, Collections, Sources, Entities, Search, Import, Settings)
- [ ] Page CRUD: create / read / update / delete / nest
- [ ] Markdown editor + rendered preview
- [ ] Source / provenance side panel (Outline, Source, Entities, Backlinks, AI tabs)
- [ ] Home / recent / favorites

### Phase 2 — Notion Importer

- [ ] Zip upload (Vercel Blob)
- [ ] Background job: extract → parse Markdown/HTML/CSV → create pages + collections + attachments
- [ ] Internal link resolver
- [ ] Import report UI (batches, status, unresolved links, review queue)

### Phase 3 — Search & Retrieval

- [ ] Postgres FTS over pages + collection records + source_objects
- [ ] Chunks table populated on page save
- [ ] Search results UI with filters (type, source, date, collection)
- [ ] (Later) pgvector for semantic search

### Phase 4 — Google Drive / Docs

- [ ] OAuth scaffold (callback route)
- [ ] Drive file picker / folder selection
- [ ] Sync job: metadata + indexed text → source_objects + chunks
- [ ] Open-in-Docs links

### Phase 5 — Entity Enrichment

- [ ] Background entity extraction on page save (uses Elemental MCP)
- [ ] Local `entities` + `entity_mentions` + `entity_relationships` tables
- [ ] Entity pages (canonical name, type, mentioned-in, related, timeline)
- [ ] Entity links in page context panel

### Phase 6 — Grounded Assistant

- [ ] ADK agent `agents/knowspace_assistant/` that retrieves chunks via a server tool
- [ ] Assistant panel in page view + global Ask box
- [ ] Citations + "save answer as page"

## Non-goals (per brief)

- Full Notion feature parity
- Multiplayer realtime editing
- Native Google Docs editing
- Formulas, rollups, complex DB relations
- Offline-first sync

## Acceptance for MVP (Phase 1)

- A user can create a page, give it a title + emoji + Markdown body, and save.
- Pages persist in Postgres.
- Pages can be nested (parent/child) and the sidebar reflects the tree.
- Each page shows a provenance panel.
- The sidebar shows entry points for every Phase 2+ feature even if they're placeholder pages, so the shell matches the brief's Section 8.1 navigation list.
