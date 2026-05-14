# Knowspace

## Vision

Knowspace PRD: A Lightweight Knowledge Management Workspace

1. Product Summary

Build a simple, fast, web-based knowledge management tool that can replace a wound-down Notion workspace, preserve exported content, integrate with Google Docs, and use Lovelace/YottaGraph-style entity context to make the workspace searchable, navigable, and useful for AI-assisted work.

This should not attempt to rebuild all of Notion. The product should focus on four things:

1. Import and preserve exported Notion workspace content.
2. Provide a clean document, page, and collection experience similar to Notion and Craft.
3. Sync and reference Google Docs without forcing users to abandon Google Docs.
4. Use a Postgres-backed content model, KV cache, and YottaGraph enrichment layer to support semantic search, entity linking, provenance, and AI-assisted retrieval.

The first version should feel like a calm, reliable internal wiki that can absorb a Notion export and make the content usable again.

⸻

2. Problem Statement

The team has exported a Notion workspace during account wind-down. That export contains useful institutional memory, but exported Notion data is not naturally usable as a live workspace. Links may break, database structures may flatten, hierarchy may be difficult to navigate, and the content loses the interactive workspace behaviors that made it useful.

At the same time, the team likely still uses Google Docs for active writing, collaboration, and external sharing. A replacement knowledge system should not compete with Google Docs. It should serve as the connective tissue across exported Notion content, active Google Docs, and future internal knowledge objects.

The opportunity is to create a lightweight workspace that stores and organizes documents, pages, collections, and links while using the graph layer to provide context-aware retrieval, entity navigation, and provenance.

⸻

3. Goals

Primary Goals

* Import a full Notion workspace export into a usable internal workspace.
* Preserve page hierarchy, titles, links, embedded file references, and database-like structures wherever possible.
* Provide a simple document and page interface for browsing, editing, linking, and organizing knowledge.
* Connect to Google Drive and Google Docs to index, reference, and optionally sync documents.
* Use Postgres as the system of record for workspace objects, metadata, relationships, users, permissions, and import state.
* Use a KV cache for fast document rendering, import status, sync state, search hints, and session-level computed views.
* Use YottaGraph to enrich documents with entities, relationships, concepts, organizations, people, products, projects, and provenance trails.
* Provide AI-assisted search and question-answering grounded in the imported workspace and connected documents.

Secondary Goals

* Support simple collections/databases with fields, views, and linked records.
* Provide a clean, Craft-inspired writing and organizing experience.
* Support backlinks, mentions, tags, and entity pages.
* Provide migration diagnostics so the team can see what imported cleanly and what needs review.
* Create a foundation for future internal knowledge applications, including product strategy, proposals, customer notes, technical specs, hiring, and course materials.

⸻

4. Non-Goals

The MVP should not attempt to implement:

* Full Notion feature parity.
* Complex real-time multiplayer editing.
* Full offline-first local document sync.
* A perfect WYSIWYG editor with every block type.
* Complex formulas, rollups, automations, or database relations equivalent to Notion.
* Full Google Docs editing inside the app.
* A separate document format that competes with Google Docs for external collaboration.
* Enterprise-grade permissions beyond basic workspace, collection, page, and source-level access.

The trap is trying to rebuild a mature workspace product. The right first version is a reliable imported knowledge repository with lightweight editing and strong retrieval.

⸻

5. Target Users

Primary User

Internal team member who needs to recover, search, update, and reuse knowledge from an exported Notion workspace.

Needs:

* Find old content quickly.
* Understand where content came from.
* Trust that migrated content was preserved.
* Link old knowledge to current work.
* Create new pages without needing a heavyweight system.

Secondary User

Founder, product lead, BD lead, professor, or operator using the workspace as a living knowledge base across proposals, notes, product strategy, research, customer discovery, and teaching.

Needs:

* Search across old Notion exports and live Google Docs.
* Generate summaries and briefs from trusted sources.
* See entities, relationships, and provenance.
* Reuse content in new documents, decks, proposals, and emails.

Admin User

Workspace owner responsible for imports, integrations, permissions, and source management.

Needs:

* Upload Notion export files.
* Connect Google Drive.
* Monitor sync status.
* Resolve import errors.
* Manage users and source access.

⸻

6. Product Principles

1. Preserve first, enhance second.
    The first job is to safely reconstruct the exported workspace. AI features are useless if users do not trust the migration.
2. Source fidelity matters.
    Every imported page, block, file, and Google Doc reference should retain source metadata, original path, import timestamp, and content hash.
3. Google Docs remains Google Docs.
    The app should index and organize Google Docs, not try to replace their collaborative editing model.
4. Graph-backed retrieval is the differentiator.
    Search should not only return documents. It should expose entities, relationships, topics, projects, customers, and repeated patterns across the workspace.
5. The editor should be simple.
    Use a clean block editor or Markdown editor. Avoid spending the first build on sophisticated formatting.
6. Make migration visible.
    Users should know what imported, what failed, what was transformed, and what requires manual review.

⸻

7. MVP Scope

7.1 Workspace Shell

The app should include:

* Authenticated workspace.
* Left sidebar with workspace navigation.
* Page tree.
* Collections section.
* Sources section.
* Search bar.
* Recent pages.
* Favorites.
* Import status center.
* Settings.

The UI should be simple and calm, closer to Craft than Notion. It should feel like a document workspace, not an admin panel.

7.2 Page Model

A page is the core object.

Each page should support:

* Title.
* Icon or emoji.
* Parent page.
* Child pages.
* Body content.
* Source metadata.
* Tags.
* Mentions.
* Backlinks.
* Attachments.
* Linked entities.
* Created and updated timestamps.
* Import status.
* Visibility or access level.

MVP page body can be stored as Markdown plus optional structured block JSON.

Recommended approach:

* Store canonical content as Markdown for portability.
* Store block-level structure as JSONB when imported from Notion or edited through a block editor.
* Render from cached compiled HTML for speed.

7.3 Collections

Collections are lightweight databases.

Each collection should support:

* Name.
* Description.
* Fields.
* Records.
* Views.
* Linked page per record.

MVP field types:

* Text.
* Select.
* Multi-select.
* Date.
* Person.
* URL.
* Checkbox.
* Number.
* Relation to another page or collection record.

MVP views:

* Table.
* List.
* Card board grouped by select/status.

Do not implement formulas or rollups in MVP.

7.4 Notion Export Importer

The system should accept a Notion export zip and convert it into internal workspace objects.

Supported input formats:

* Markdown and CSV export.
* HTML export if available.
* Attachments and files bundled in export.

Importer responsibilities:

* Upload zip.
* Extract file tree.
* Detect export format.
* Parse page hierarchy from directory structure and internal links.
* Convert Markdown or HTML to internal page content.
* Convert CSV databases into collections.
* Preserve original file paths.
* Preserve attachment references.
* Rewrite internal links to point to imported pages.
* Track unresolved links.
* Generate import report.
* Queue YottaGraph enrichment jobs.

Import report should include:

* Number of pages imported.
* Number of collections imported.
* Number of attachments imported.
* Number of internal links resolved.
* Number of unresolved links.
* Number of unsupported block types.
* Pages requiring review.

7.5 Google Docs / Drive Integration

The app should connect to Google Drive using OAuth.

MVP capabilities:

* Connect Google account.
* Select folders or documents to index.
* Import document metadata.
* Index Google Doc text content.
* Store Drive file ID, title, owner, URL, modified time, and permissions snapshot.
* Show Google Docs as external source documents inside the workspace.
* Link a Google Doc to a workspace page or collection record.
* Refresh indexed content on demand.
* Periodically check for modified documents.

Google Docs should remain externally editable. The app should provide:

* Preview summary.
* Open in Google Docs button.
* Indexed text for search.
* Entity extraction.
* Relationship extraction.
* Comments and revision metadata where accessible and useful.

MVP should not attempt native Google Docs editing.

7.6 Search

Search should support three layers:

1. Keyword search.
2. Semantic search.
3. Graph/entity search.

Search result types:

* Pages.
* Collections.
* Collection records.
* Google Docs.
* Attachments.
* Entities.
* Topics.

Each result should show:

* Title.
* Type.
* Source.
* Snippet.
* Last updated.
* Matched terms or entities.
* Confidence or relevance score.

MVP search behavior:

* User types natural language or keywords.
* System returns ranked documents and entities.
* User can filter by source, type, tag, date, and collection.
* User can ask a grounded question and receive an answer with cited source links.

7.7 YottaGraph Enrichment

YottaGraph should enrich workspace content by extracting and linking:

* People.
* Organizations.
* Products.
* Projects.
* Customers.
* Events.
* Locations.
* Documents.
* Concepts.
* Assets.
* Dates and timelines.
* Relationships among entities.

For each enriched entity, store:

* Entity name.
* Entity type.
* Canonical ID if known.
* Aliases.
* Source mentions.
* Confidence.
* Linked pages and docs.
* Relationship edges.
* Provenance.

The app should expose entity pages that show:

* Summary.
* Linked documents.
* Mention timeline.
* Related entities.
* Source snippets.
* Open questions or unresolved mentions.

This is the main differentiated feature. Notion and Craft organize documents. This product should organize the meaning inside documents.

7.8 AI Assistant

MVP assistant should be narrow and grounded.

Capabilities:

* Ask questions across the imported workspace.
* Summarize a page, folder, collection, or Google Doc.
* Generate a brief from selected sources.
* Explain why a result was returned.
* Suggest related pages and entities.
* Identify duplicate or stale pages.
* Create a draft page from source material.

Every answer should include citations or source references.

The assistant should not answer from general model knowledge unless explicitly requested. Default behavior should be workspace-grounded.

7.9 Source and Provenance Panel

Each page should have a source panel showing:

* Created in app or imported.
* Original source system.
* Original path or URL.
* Import timestamp.
* Source file hash.
* Last sync timestamp.
* Linked external document.
* Related import batch.
* Enrichment status.

For AI-generated content, show:

* Sources used.
* Prompt or task summary.
* Generation timestamp.
* Model used if available.
* User who generated it.

⸻

8. UX Requirements

8.1 Main Navigation

Left sidebar:

* Search.
* Inbox.
* Recent.
* Favorites.
* Pages.
* Collections.
* Sources.
* Entities.
* Import Center.
* Settings.

8.2 Page View

Page layout:

* Title area.
* Metadata row.
* Body content.
* Right-side context panel.

Right-side context panel tabs:

* Outline.
* Source.
* Entities.
* Backlinks.
* Related.
* AI.

8.3 Import Center

Import Center should show:

* Import batches.
* Status.
* Progress.
* Error list.
* Review queue.
* Resolved/unresolved links.
* Unsupported content.
* Re-run enrichment button.

8.4 Entity View

Entity page should show:

* Canonical entity name.
* Type.
* Summary.
* Aliases.
* Mentioned in.
* Related entities.
* Timeline.
* Source snippets.
* Confidence and merge controls.

8.5 Collections View

Collection page should support:

* Table view.
* List view.
* Board view.
* Field configuration.
* Record page opening.
* Filtering and sorting.

⸻

9. Technical Architecture

9.1 Suggested Stack

Frontend:

* Next.js or Vite/React.
* TypeScript.
* Tailwind.
* shadcn/ui.
* TipTap, Lexical, or Markdown editor.

Backend:

* Node/TypeScript API layer or Python/FastAPI if better aligned with existing Lovelace services.
* Postgres as primary database.
* pgvector for embeddings if using Postgres-native vector search.
* Redis, Upstash, Vercel KV, or equivalent KV cache.
* Background job queue for imports, parsing, sync, embeddings, and enrichment.

Storage:

* Object storage for uploaded exports and attachments.
* Postgres for structured metadata and canonical records.
* KV cache for fast-rendered page HTML, search result caches, import status, and sync state.

Graph/context layer:

* YottaGraph integration for entity extraction, disambiguation, relationship enrichment, and graph traversal.
* Store local references to graph entity IDs in Postgres.

9.2 High-Level Data Flow

Notion export flow:

1. User uploads export zip.
2. App stores raw zip in object storage.
3. Import job extracts files.
4. Parser creates pages, collections, attachments, and source records in Postgres.
5. Link resolver maps internal links.
6. Renderer compiles page content to cached HTML.
7. Embedding job creates vectors.
8. YottaGraph job extracts entities and relationships.
9. Import report is generated.
10. User reviews unresolved items.

Google Docs flow:

1. User connects Google Drive.
2. User selects documents or folders.
3. App stores source records and file metadata.
4. Sync job indexes document content.
5. Text is embedded and sent for entity enrichment.
6. Document appears in search and related entity views.
7. Periodic sync checks modified time or Drive changes.

AI retrieval flow:

1. User asks a question.
2. Query interpreter identifies likely intent, entities, date ranges, and source filters.
3. System searches Postgres full text, vector index, and YottaGraph-linked entities.
4. Reranker selects source chunks.
5. Assistant generates answer with citations.
6. Answer and source references are optionally saved.

⸻

10. Proposed Database Schema

workspaces

* id
* name
* slug
* created_at
* updated_at

users

* id
* email
* name
* avatar_url
* created_at
* updated_at

workspace_members

* id
* workspace_id
* user_id
* role
* created_at

pages

* id
* workspace_id
* parent_page_id
* title
* slug
* emoji
* content_markdown
* content_blocks_jsonb
* rendered_html_cache_key
* source_id
* source_object_id
* created_by
* updated_by
* created_at
* updated_at
* deleted_at
* import_status

page_edges

* id
* workspace_id
* from_page_id
* to_page_id
* edge_type
* source
* confidence
* created_at

Edge types:

* parent_child
* backlink
* mention
* imported_link
* related
* duplicate_candidate

collections

* id
* workspace_id
* name
* description
* source_id
* created_at
* updated_at

collection_fields

* id
* collection_id
* name
* field_type
* config_jsonb
* position
* created_at

collection_records

* id
* collection_id
* page_id
* properties_jsonb
* source_object_id
* created_at
* updated_at

sources

* id
* workspace_id
* source_type
* display_name
* status
* config_jsonb
* created_by
* created_at
* updated_at

Source types:

* notion_export
* google_drive
* google_doc
* manual
* upload

source_objects

* id
* source_id
* external_id
* external_url
* original_path
* title
* mime_type
* content_hash
* metadata_jsonb
* last_synced_at
* created_at
* updated_at

attachments

* id
* workspace_id
* source_object_id
* page_id
* filename
* mime_type
* storage_url
* size_bytes
* content_hash
* created_at

import_batches

* id
* workspace_id
* source_id
* status
* started_at
* completed_at
* stats_jsonb
* errors_jsonb
* created_by

import_items

* id
* import_batch_id
* source_object_id
* target_type
* target_id
* status
* warnings_jsonb
* errors_jsonb
* created_at

entities

* id
* workspace_id
* yottagraph_entity_id
* canonical_name
* entity_type
* aliases_jsonb
* confidence
* created_at
* updated_at

entity_mentions

* id
* workspace_id
* entity_id
* page_id
* source_object_id
* chunk_id
* mention_text
* context_snippet
* confidence
* start_offset
* end_offset
* created_at

entity_relationships

* id
* workspace_id
* from_entity_id
* to_entity_id
* relationship_type
* evidence_jsonb
* confidence
* created_at

chunks

* id
* workspace_id
* page_id
* source_object_id
* chunk_text
* chunk_index
* token_count
* embedding
* metadata_jsonb
* created_at

ai_answers

* id
* workspace_id
* user_id
* question
* answer_markdown
* citations_jsonb
* created_at

⸻

11. API Requirements

Workspace

* GET /api/workspaces/:id
* GET /api/workspaces/:id/navigation

Pages

* GET /api/pages/:id
* POST /api/pages
* PATCH /api/pages/:id
* DELETE /api/pages/:id
* GET /api/pages/:id/backlinks
* GET /api/pages/:id/entities
* GET /api/pages/:id/related

Collections

* GET /api/collections
* POST /api/collections
* GET /api/collections/:id
* PATCH /api/collections/:id
* POST /api/collections/:id/records
* PATCH /api/collections/:id/records/:recordId

Import

* POST /api/imports/notion/upload
* GET /api/imports/:batchId/status
* GET /api/imports/:batchId/report
* POST /api/imports/:batchId/retry

Google Drive

* GET /api/integrations/google/auth-url
* POST /api/integrations/google/callback
* GET /api/integrations/google/files
* POST /api/integrations/google/sync
* GET /api/integrations/google/sync/:syncId/status

Search

* POST /api/search
* POST /api/search/semantic
* POST /api/ask

Entities

* GET /api/entities
* GET /api/entities/:id
* PATCH /api/entities/:id
* POST /api/entities/:id/merge

⸻

12. Cursor Build Plan

Phase 1: App Foundation

Build:

* Next.js app shell.
* Auth placeholder or basic auth.
* Postgres schema and migrations.
* Workspace layout.
* Sidebar navigation.
* Page creation and editing.
* Basic Markdown rendering.
* Source and provenance panel.

Acceptance criteria:

* User can create, edit, and delete pages.
* Pages can be nested.
* Sidebar reflects hierarchy.
* Page content persists in Postgres.
* Rendered page loads quickly.

Phase 2: Notion Export Importer

Build:

* Zip upload.
* File extraction.
* Markdown parser.
* HTML parser if needed.
* CSV-to-collection converter.
* Internal link resolver.
* Attachment storage.
* Import report UI.

Acceptance criteria:

* User can upload a Notion export zip.
* Pages are imported with hierarchy.
* CSV files become collections.
* Attachments are preserved.
* Internal links are rewritten where possible.
* Import report identifies unresolved items.

Phase 3: Search and Retrieval

Build:

* Full-text search.
* Chunking pipeline.
* Embedding generation.
* Semantic search.
* Search results UI.
* Filters by type, source, tag, and date.

Acceptance criteria:

* User can search imported workspace.
* Results include snippets and source metadata.
* Semantic queries return useful related content.
* Search works across pages and collections.

Phase 4: Google Docs Integration

Build:

* Google OAuth.
* Drive file picker or folder selection.
* Google Doc content indexing.
* External document source records.
* Refresh sync.
* Open in Google Docs links.

Acceptance criteria:

* User can connect Google Drive.
* User can select docs or folders to index.
* Google Docs appear in search.
* Metadata and modified time are stored.
* User can open source doc externally.

Phase 5: YottaGraph Enrichment

Build:

* Enrichment job queue.
* Entity extraction integration.
* Local entity store.
* Entity mentions.
* Entity pages.
* Related documents and entity graph view.

Acceptance criteria:

* Imported pages and Google Docs are enriched.
* Entity pages show linked documents and snippets.
* Users can browse by person, organization, product, project, or concept.
* Entity relationships include provenance.

Phase 6: Grounded AI Assistant

Build:

* Ask workspace endpoint.
* Retrieval pipeline using keyword, vector, and graph results.
* Citation builder.
* Assistant UI panel.
* Save answer as page option.

Acceptance criteria:

* User can ask questions across workspace content.
* Answers include cited source links.
* Assistant refuses or narrows when sources are insufficient.
* User can generate a draft page from selected sources.

⸻

13. Cursor Prompt

Use the following as the initial Cursor instruction:

Build a lightweight knowledge management web app inspired by Notion and Craft, optimized for importing an exported Notion workspace, indexing Google Docs, and organizing knowledge through a graph-backed context layer.
Use Next.js, TypeScript, Tailwind, shadcn/ui, Postgres, and a KV cache. Postgres is the system of record. The app should create and manage its own database schema. Use object storage abstraction for uploaded Notion exports and attachments. Assume a future YottaGraph API will enrich documents with entities and relationships, but create local placeholder interfaces and tables now.
The MVP should include:
1. Workspace shell with sidebar navigation, pages, collections, sources, entities, search, import center, and settings.
2. Page model with nested pages, Markdown content, optional block JSON, source metadata, backlinks, tags, and linked entities.
3. Simple editor and reader view.
4. Notion export importer that accepts a zip, extracts Markdown/HTML/CSV/assets, creates pages and collections, preserves source paths, rewrites internal links where possible, and produces an import report.
5. Google Drive/Docs integration scaffold with OAuth placeholders, source records, document metadata, content indexing, and open-in-Google-Docs links.
6. Search foundation with Postgres full-text search, chunk table, optional pgvector embeddings, and filters.
7. Entity enrichment scaffold with local tables for entities, mentions, relationships, and provenance.
8. Grounded assistant scaffold that retrieves chunks and returns answers with citations.
Prioritize clean architecture, simple UI, source fidelity, and migration reliability. Do not attempt full Notion feature parity. Do not build complex formulas, multiplayer editing, or a full Google Docs editor in the first version.
Start by generating the database schema, application routes, core UI layout, and page CRUD. Then add the Notion import pipeline as a background job with an import status UI.

⸻

14. Detailed Cursor Task Breakdown

Task 1: Create App Skeleton

Create a Next.js TypeScript app with Tailwind and shadcn/ui. Implement a workspace layout with a left sidebar, top search bar, main content area, and optional right context panel. Add routes for /, /pages/[id], /collections, /sources, /entities, /import, and /settings. Use placeholder data until the database layer is ready.

Task 2: Add Database Layer

Add Postgres support with migrations. Create tables for workspaces, users, workspace_members, pages, page_edges, collections, collection_fields, collection_records, sources, source_objects, attachments, import_batches, import_items, entities, entity_mentions, entity_relationships, chunks, and ai_answers. Add TypeScript types and query helpers for each core object.

Task 3: Build Page CRUD

Implement page creation, reading, updating, deleting, and nesting. Store canonical content as Markdown and optional block JSON. Render Markdown safely. Update the sidebar page tree when pages are created or moved. Add a source/provenance panel on the right side of the page view.

Task 4: Build Notion Import Upload

Create an import page that accepts a Notion export zip file. Store the raw zip using a storage abstraction. Create an import batch record. Implement a background job that extracts the zip, inventories files, detects Markdown, HTML, CSV, and attachment files, and creates source_objects for each file.

Task 5: Parse Notion Pages

Implement parsers for Markdown and HTML Notion export pages. Convert each file into an internal page record. Preserve original path, title, content hash, and source object reference. Infer hierarchy from folder structure and link relationships. Cache rendered HTML in KV after page creation.

Task 6: Convert CSV Databases into Collections

When CSV files are found in the Notion export, create a collection. Infer field types from column values. Create collection records and a linked page for each record. Preserve the original CSV file as a source object.

Task 7: Resolve Internal Links

After import, scan all page content for Notion export links. Match links to imported page source paths or titles. Rewrite resolved links to internal /pages/[id] links. Store unresolved links in the import report and show them in the Import Center review queue.

Task 8: Add Search

Add Postgres full-text search over pages, collection records, and source objects. Create a /search route and API endpoint. Return ranked results with title, type, snippet, source, updated date, and matched terms. Add filters for source, type, date, and collection.

Task 9: Add Chunking and Embedding Scaffolding

Create a chunking service that splits page and source object text into chunks. Store chunks in the chunks table. Add an embedding provider interface but keep it pluggable. If pgvector is available, store embeddings in Postgres and add semantic search. Otherwise, leave a clean interface for later.

Task 10: Add Google Drive/Docs Integration Scaffold

Add Google OAuth configuration placeholders. Create a Sources page where a user can connect Google Drive. Implement file metadata sync using Drive file IDs, title, URL, owner, mime type, modified time, and permissions snapshot. Add a placeholder service for extracting Google Doc text content. Store indexed docs as source_objects and chunks. Show Open in Google Docs links.

Task 11: Add YottaGraph Enrichment Interface

Create a YottaGraph client interface with methods enrichDocument, resolveEntity, mergeEntities, and getRelatedEntities. For now, implement a mock adapter that extracts simple capitalized entities and stores them as local entities and entity_mentions. Build the tables and UI so the real API can be swapped in later.

Task 12: Build Entity Pages

Create /entities/[id] pages that show canonical name, type, aliases, confidence, related documents, mention snippets, relationships, and timeline. Add links from page context panel to entity pages. Add merge controls as a placeholder.

Task 13: Add Grounded Assistant Scaffold

Create an assistant panel that accepts a user question, retrieves relevant chunks using keyword and semantic search, optionally expands through related entities, and returns a grounded answer with citations. The first implementation can use a mocked LLM response format if needed, but the retrieval and citation structure should be real.

⸻

15. Acceptance Criteria for MVP

The MVP is successful when:

* A user can upload a Notion export zip and see imported pages in a navigable hierarchy.
* The app preserves source metadata for every imported object.
* CSV files become basic collections.
* Internal links are resolved when possible.
* The user can search imported content.
* The user can connect or scaffold connection to Google Docs and index document metadata/content.
* The app can show source provenance for pages and AI answers.
* The app can show extracted entities and related documents.
* The assistant can answer simple questions using cited workspace sources.
* The product feels simpler than Notion, not heavier.

⸻

16. Key Risks

Risk 1: Notion export structure is inconsistent

Mitigation:

* Build an import inventory first.
* Do not assume one export structure.
* Preserve raw source paths.
* Create a review queue for unresolved items.

Risk 2: Google Docs API complexity slows build

Mitigation:

* Start with metadata and open links.
* Add text indexing next.
* Avoid native editing.
* Treat Google Docs as external source-of-record.

Risk 3: Editor work consumes the project

Mitigation:

* Use Markdown-first editing.
* Add block editor later.
* Do not chase Notion parity.

Risk 4: AI answers hallucinate

Mitigation:

* Require citations.
* Use retrieved source chunks only.
* Show insufficient-source states.
* Save provenance for generated outputs.

Risk 5: Graph enrichment becomes vague

Mitigation:

* Store explicit entity mentions, source snippets, confidence, and evidence.
* Make entity pages inspectable.
* Do not show relationships without provenance.

⸻

17. Future Features

* Real-time collaboration.
* More advanced block editor.
* Notion API live sync.
* Craft import support if export/API access is available.
* MCP server for workspace retrieval.
* Slack integration.
* Gmail integration.
* Proposal generator.
* Meeting notes capture.
* Duplicate detection and page consolidation.
* Staleness detection.
* Knowledge health dashboard.
* Permission-aware retrieval.
* Timeline views.
* Graph visualization.
* Export back to Markdown, HTML, CSV, or Google Docs.

⸻

18. Strategic Recommendation

The first version should be a migration and retrieval product, not a writing product.

If the imported Notion workspace becomes searchable, structured, cited, entity-linked, and connected to active Google Docs, the product will already be valuable. The writing surface only needs to be good enough to create and update knowledge. The hard part, and the part worth building, is turning dead exported workspace data into a living, graph-backed knowledge layer.

## Status

Project just created. Run `/build_my_app` in Cursor to start building.

## Modules

*None yet — the agent will populate this as features are built.*
