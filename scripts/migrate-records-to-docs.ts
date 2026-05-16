import 'dotenv/config';

import { getDb } from '../server/utils/neon';
import { ensureSchema } from '../server/utils/schema';
import { newId, slugify } from '../server/utils/ids';
import { stringifyFrontmatter } from '../utils/markdown';
import { persistDocExtraction } from '../server/utils/docExtract';

function toFrontmatter(props: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props || {})) {
        if (!k) continue;
        out[k] = v;
    }
    return out;
}

async function main() {
    const sql = getDb();
    if (!sql) throw new Error('DATABASE_URL missing');
    await ensureSchema();

    const wsRows: any = await sql`SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1`;
    const workspaceId = wsRows[0]?.id;
    if (!workspaceId) throw new Error('No workspace found');

    const rows: any = await sql`SELECT r.id AS record_id, r.collection_id, r.page_id,
            r.properties_jsonb, c.name AS collection_name
        FROM collection_records r
        JOIN collections c ON c.id = r.collection_id
        WHERE c.workspace_id = ${workspaceId}`;

    console.log(`[migrate-records-to-docs] records=${rows.length}`);
    let migrated = 0;
    for (const row of rows) {
        const tag = slugify(row.collection_name || 'collection');
        const existingPageId = row.page_id as string | null;
        const deterministicPageId = `pg_${String(row.record_id || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
        const pageId = existingPageId || deterministicPageId || newId('pg');
        const fm = toFrontmatter((row.properties_jsonb || {}) as Record<string, unknown>);

        const title =
            (fm.Name as string) ||
            (fm.name as string) ||
            `${row.collection_name || 'Record'} ${String(row.record_id || '').slice(0, 6)}`;
        const body = '';
        const content = stringifyFrontmatter(fm, body);

        await sql`INSERT INTO pages
            (id, workspace_id, title, content_markdown, import_status, tags)
            VALUES (${pageId}, ${workspaceId}, ${title}, ${content}, 'imported_collection_record',
                    ${JSON.stringify([tag])}::jsonb)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                content_markdown = EXCLUDED.content_markdown,
                import_status = EXCLUDED.import_status,
                tags = EXCLUDED.tags,
                updated_at = NOW()`;

        await sql`UPDATE collection_records SET page_id = ${pageId} WHERE id = ${row.record_id}`;
        await persistDocExtraction(sql, {
            workspaceId,
            pageId,
            markdown: `${content}\n\n#${tag}\n`,
            userSub: null,
        });
        migrated++;
        if (migrated % 200 === 0) console.log(`[migrate-records-to-docs] migrated=${migrated}`);
    }

    console.log(`[migrate-records-to-docs] done migrated=${migrated}`);
}

main().catch((err) => {
    console.error('[migrate-records-to-docs] failed:', err);
    process.exit(1);
});
