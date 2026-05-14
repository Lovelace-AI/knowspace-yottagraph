import { getDb } from './neon';

let _initialized = false;

/**
 * Idempotently create the Knowspace schema. Safe to call from any route
 * before reads/writes. After the first successful run within a serverless
 * invocation, becomes a no-op.
 *
 * The schema is the one described in DESIGN.md §10, adapted slightly for
 * a single-workspace MVP. Vector embeddings are stored as JSON text for
 * now; pgvector can be enabled in Phase 3 by altering the chunks column.
 */
export async function ensureSchema(): Promise<boolean> {
    if (_initialized) return true;
    const sql = getDb();
    if (!sql) return false;

    await sql`CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        owner_sub TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        parent_page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
        title TEXT NOT NULL DEFAULT 'Untitled',
        slug TEXT,
        emoji TEXT,
        content_markdown TEXT DEFAULT '',
        content_blocks_jsonb JSONB,
        rendered_html_cache_key TEXT,
        source_id TEXT,
        source_object_id TEXT,
        position INTEGER DEFAULT 0,
        tags JSONB DEFAULT '[]'::jsonb,
        is_favorite BOOLEAN DEFAULT FALSE,
        created_by TEXT,
        updated_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        import_status TEXT DEFAULT 'native'
    )`;
    await sql`CREATE INDEX IF NOT EXISTS pages_workspace_idx ON pages(workspace_id)`;
    await sql`CREATE INDEX IF NOT EXISTS pages_parent_idx ON pages(parent_page_id)`;
    await sql`CREATE INDEX IF NOT EXISTS pages_updated_idx ON pages(updated_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS pages_search_idx ON pages
        USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content_markdown,'')))`;

    await sql`CREATE TABLE IF NOT EXISTS page_edges (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        from_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        to_page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
        to_external_url TEXT,
        edge_type TEXT NOT NULL,
        source TEXT,
        confidence REAL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS page_edges_from_idx ON page_edges(from_page_id)`;
    await sql`CREATE INDEX IF NOT EXISTS page_edges_to_idx ON page_edges(to_page_id)`;

    await sql`CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        source_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS collection_fields (
        id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        field_type TEXT NOT NULL,
        config_jsonb JSONB DEFAULT '{}'::jsonb,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS collection_records (
        id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
        properties_jsonb JSONB DEFAULT '{}'::jsonb,
        source_object_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        source_type TEXT NOT NULL,
        display_name TEXT NOT NULL,
        status TEXT DEFAULT 'idle',
        config_jsonb JSONB DEFAULT '{}'::jsonb,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS source_objects (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
        external_id TEXT,
        external_url TEXT,
        original_path TEXT,
        title TEXT,
        mime_type TEXT,
        content_hash TEXT,
        metadata_jsonb JSONB DEFAULT '{}'::jsonb,
        last_synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        source_object_id TEXT,
        page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
        filename TEXT,
        mime_type TEXT,
        storage_url TEXT,
        size_bytes BIGINT,
        content_hash TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS import_batches (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'queued',
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        stats_jsonb JSONB DEFAULT '{}'::jsonb,
        errors_jsonb JSONB DEFAULT '[]'::jsonb,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS import_items (
        id TEXT PRIMARY KEY,
        import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
        source_object_id TEXT,
        target_type TEXT,
        target_id TEXT,
        status TEXT DEFAULT 'pending',
        warnings_jsonb JSONB DEFAULT '[]'::jsonb,
        errors_jsonb JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        yottagraph_entity_id TEXT,
        canonical_name TEXT NOT NULL,
        entity_type TEXT,
        aliases_jsonb JSONB DEFAULT '[]'::jsonb,
        summary TEXT,
        confidence REAL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS entities_workspace_idx ON entities(workspace_id)`;
    await sql`CREATE INDEX IF NOT EXISTS entities_name_idx ON entities(canonical_name)`;

    await sql`CREATE TABLE IF NOT EXISTS entity_mentions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
        source_object_id TEXT,
        chunk_id TEXT,
        mention_text TEXT,
        context_snippet TEXT,
        confidence REAL,
        start_offset INTEGER,
        end_offset INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS entity_mentions_entity_idx ON entity_mentions(entity_id)`;
    await sql`CREATE INDEX IF NOT EXISTS entity_mentions_page_idx ON entity_mentions(page_id)`;

    await sql`CREATE TABLE IF NOT EXISTS entity_relationships (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        from_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        to_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        relationship_type TEXT,
        evidence_jsonb JSONB DEFAULT '{}'::jsonb,
        confidence REAL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
        source_object_id TEXT,
        chunk_text TEXT NOT NULL,
        chunk_index INTEGER DEFAULT 0,
        token_count INTEGER,
        embedding JSONB,
        metadata_jsonb JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS chunks_page_idx ON chunks(page_id)`;
    await sql`CREATE INDEX IF NOT EXISTS chunks_search_idx ON chunks
        USING GIN (to_tsvector('english', chunk_text))`;

    await sql`CREATE TABLE IF NOT EXISTS ai_answers (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_sub TEXT,
        question TEXT NOT NULL,
        answer_markdown TEXT,
        citations_jsonb JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    _initialized = true;
    return true;
}
