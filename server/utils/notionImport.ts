import { getDb } from './neon';
import { ensureSchema } from './schema';
import { newId } from './ids';

/**
 * Shape of a Notion-prep bundle (`scripts/notion-prep.ts --out`).
 * Mirrors the parser output minus the index maps; ids are already
 * minted as `pg_n_<hash>`, `col_n_<hash>`, `rec_n_<hash>`.
 */
export interface NotionBundle {
    schema_version: number;
    generated_at?: string;
    source_root?: string;
    excluded_collection_names?: string[];
    stats?: Record<string, number>;
    link_stats?: { resolved: number; unresolved: number };
    pages: Array<{
        id: string;
        notion_id: string | null;
        title: string;
        emoji: string | null;
        parent_id: string | null;
        source_path: string;
        collection_id: string | null;
        content_markdown: string;
        bytes?: number;
    }>;
    collections: Array<{
        id: string;
        title: string;
        notion_id: string | null;
        parent_id: string | null;
        source_path: string;
        fields: Array<{ name: string; field_type: string }>;
        records: Array<{
            id: string;
            page_id: string | null;
            properties: Record<string, string>;
        }>;
        excluded?: boolean;
    }>;
}

export interface CommitOptions {
    workspaceId: string;
    userSub: string | null;
    /** Display name for the source row (default: derived from source_root). */
    sourceName?: string;
}

export interface CommitResult {
    batch_id: string;
    source_id: string;
    pages_inserted: number;
    pages_updated: number;
    collections_inserted: number;
    records_inserted: number;
    duration_ms: number;
}

function validateBundle(bundle: unknown): asserts bundle is NotionBundle {
    if (!bundle || typeof bundle !== 'object') {
        throw new Error('Bundle is not an object');
    }
    const b = bundle as NotionBundle;
    if (b.schema_version !== 1) {
        throw new Error(`Unsupported bundle schema_version: ${b.schema_version}`);
    }
    if (!Array.isArray(b.pages)) throw new Error('Bundle missing pages array');
    if (!Array.isArray(b.collections)) throw new Error('Bundle missing collections array');
}

/**
 * Write a parsed Notion bundle into Postgres for the given workspace.
 *
 * - Pages are inserted with `parent_page_id` set to NULL first, then a
 *   second pass updates parents so insert ordering doesn't matter.
 * - Re-running with the same bundle is idempotent thanks to
 *   `ON CONFLICT (id) DO UPDATE` on pages/collections/records.
 * - Records an `import_batch` row with stats and a `source` row to
 *   group all imported objects under a single provenance handle.
 */
export async function commitBundle(raw: unknown, opts: CommitOptions): Promise<CommitResult> {
    const start = Date.now();
    validateBundle(raw);
    const bundle: NotionBundle = raw;

    const sql = getDb();
    if (!sql) throw new Error('Database not configured (DATABASE_URL missing)');
    await ensureSchema();

    const workspaceId = opts.workspaceId;
    const userSub = opts.userSub;
    const sourceName =
        opts.sourceName || `Notion Export · ${new Date().toISOString().slice(0, 10)}`;

    const sourceId = newId('src');
    await sql`INSERT INTO sources
        (id, workspace_id, source_type, display_name, status, config_jsonb, created_by)
        VALUES (${sourceId}, ${workspaceId}, 'notion_export', ${sourceName}, 'completed',
                ${JSON.stringify({ source_root: bundle.source_root || null, excluded: bundle.excluded_collection_names || [] })}::jsonb,
                ${userSub})`;

    const batchId = newId('imp');
    await sql`INSERT INTO import_batches
        (id, workspace_id, source_id, status, started_at, created_by, stats_jsonb)
        VALUES (${batchId}, ${workspaceId}, ${sourceId}, 'running', NOW(), ${userSub},
                ${JSON.stringify(bundle.stats || {})}::jsonb)`;

    let pages_inserted = 0;
    let pages_updated = 0;
    const validPageIds = new Set(bundle.pages.map((p) => p.id));

    for (const p of bundle.pages) {
        const result: any = await sql`INSERT INTO pages
            (id, workspace_id, parent_page_id, title, slug, emoji,
             content_markdown, source_id, source_object_id, import_status,
             created_by, updated_by)
            VALUES (${p.id}, ${workspaceId}, NULL, ${p.title}, NULL, ${p.emoji},
                    ${p.content_markdown}, ${sourceId}, ${p.notion_id},
                    'imported_notion', ${userSub}, ${userSub})
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                emoji = EXCLUDED.emoji,
                content_markdown = EXCLUDED.content_markdown,
                source_id = EXCLUDED.source_id,
                source_object_id = EXCLUDED.source_object_id,
                import_status = 'imported_notion',
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW(),
                deleted_at = NULL
            RETURNING (xmax = 0) AS inserted`;
        const wasInsert = Array.isArray(result) ? result[0]?.inserted : result?.[0]?.inserted;
        if (wasInsert) pages_inserted++;
        else pages_updated++;
    }

    for (const p of bundle.pages) {
        const parent = p.parent_id && validPageIds.has(p.parent_id) ? p.parent_id : null;
        await sql`UPDATE pages
            SET parent_page_id = ${parent}
            WHERE id = ${p.id} AND workspace_id = ${workspaceId}`;
    }

    let collections_inserted = 0;
    let records_inserted = 0;
    for (const c of bundle.collections) {
        if (c.excluded) continue;
        await sql`INSERT INTO collections
            (id, workspace_id, name, description, source_id)
            VALUES (${c.id}, ${workspaceId}, ${c.title}, ${'Imported from ' + c.source_path}, ${sourceId})
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                source_id = EXCLUDED.source_id,
                updated_at = NOW()`;
        collections_inserted++;

        await sql`DELETE FROM collection_fields WHERE collection_id = ${c.id}`;
        for (let i = 0; i < c.fields.length; i++) {
            const f = c.fields[i];
            await sql`INSERT INTO collection_fields
                (id, collection_id, name, field_type, position)
                VALUES (${newId('fld')}, ${c.id}, ${f.name}, ${f.field_type}, ${i})`;
        }

        for (const r of c.records) {
            const linkedPageId = r.page_id && validPageIds.has(r.page_id) ? r.page_id : null;
            await sql`INSERT INTO collection_records
                (id, collection_id, page_id, properties_jsonb)
                VALUES (${r.id}, ${c.id}, ${linkedPageId},
                        ${JSON.stringify(r.properties || {})}::jsonb)
                ON CONFLICT (id) DO UPDATE SET
                    page_id = EXCLUDED.page_id,
                    properties_jsonb = EXCLUDED.properties_jsonb,
                    updated_at = NOW()`;
            records_inserted++;
        }
    }

    const duration_ms = Date.now() - start;
    const finalStats = {
        ...(bundle.stats || {}),
        pages_inserted,
        pages_updated,
        collections_inserted,
        records_inserted,
        duration_ms,
    };
    await sql`UPDATE import_batches
        SET status = 'completed',
            completed_at = NOW(),
            stats_jsonb = ${JSON.stringify(finalStats)}::jsonb
        WHERE id = ${batchId}`;

    return {
        batch_id: batchId,
        source_id: sourceId,
        pages_inserted,
        pages_updated,
        collections_inserted,
        records_inserted,
        duration_ms,
    };
}
