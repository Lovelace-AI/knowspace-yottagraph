import 'dotenv/config';

import { getDb } from '../server/utils/neon';
import { ensureSchema } from '../server/utils/schema';
import { newId, slugify } from '../server/utils/ids';
import { stringifyFrontmatter } from '../utils/markdown';
import { persistDocExtraction } from '../server/utils/docExtract';
import * as fs from 'node:fs';
import * as path from 'node:path';

function toFrontmatter(props: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props || {})) {
        if (!k) continue;
        out[k] = v;
    }
    return out;
}

interface MigrationOptions {
    dryRun: boolean;
    reportPath: string;
}

interface MigrationReport {
    started_at: string;
    finished_at?: string;
    dry_run: boolean;
    workspace_id: string;
    totals: {
        records: number;
        created_pages: number;
        updated_pages: number;
        linked_records: number;
        unchanged_rows: number;
        conflicts: number;
    };
    by_collection: Record<
        string,
        {
            records: number;
            created_pages: number;
            updated_pages: number;
            linked_records: number;
            unchanged_rows: number;
            conflicts: number;
        }
    >;
    mappings: Array<{
        record_id: string;
        old_page_id: string | null;
        new_page_id: string;
    }>;
    notes: string[];
}

function parseArgs(argv: string[]): MigrationOptions {
    let dryRun = false;
    let reportPath = '';
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--dry-run') dryRun = true;
        if (arg === '--report' && argv[i + 1]) {
            reportPath = argv[i + 1];
            i++;
        }
    }
    if (!reportPath) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        reportPath = `reports/migrate-records-to-docs-${ts}.json`;
    }
    return { dryRun, reportPath };
}

function ensureDirFor(filePath: string) {
    const abs = path.resolve(filePath);
    const dir = path.dirname(abs);
    fs.mkdirSync(dir, { recursive: true });
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
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

    const report: MigrationReport = {
        started_at: new Date().toISOString(),
        dry_run: opts.dryRun,
        workspace_id: workspaceId,
        totals: {
            records: rows.length,
            created_pages: 0,
            updated_pages: 0,
            linked_records: 0,
            unchanged_rows: 0,
            conflicts: 0,
        },
        by_collection: {},
        mappings: [],
        notes: [],
    };

    console.log(
        `[migrate-records-to-docs] records=${rows.length} dry_run=${opts.dryRun ? 'yes' : 'no'}`
    );

    let processed = 0;
    for (const row of rows) {
        const collectionName = String(row.collection_name || 'collection');
        const collectionKey = slugify(collectionName) || 'collection';
        const tag = collectionKey;
        const existingPageId = row.page_id as string | null;
        const deterministicPageId = `pg_${String(row.record_id || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
        const pageId = existingPageId || deterministicPageId || newId('pg');
        const fm = toFrontmatter((row.properties_jsonb || {}) as Record<string, unknown>);

        const title =
            (fm.Name as string) ||
            (fm.name as string) ||
            `${collectionName} ${String(row.record_id || '').slice(0, 6)}`;
        const body = '';
        const content = stringifyFrontmatter(fm, body);

        if (!report.by_collection[collectionKey]) {
            report.by_collection[collectionKey] = {
                records: 0,
                created_pages: 0,
                updated_pages: 0,
                linked_records: 0,
                unchanged_rows: 0,
                conflicts: 0,
            };
        }
        const byCol = report.by_collection[collectionKey];
        byCol.records++;

        const existingRows: any = await sql`SELECT id, title, content_markdown, tags
            FROM pages
            WHERE id = ${pageId}
              AND workspace_id = ${workspaceId}
            LIMIT 1`;
        const existing = existingRows[0] || null;
        const existingTags = Array.isArray(existing?.tags) ? existing.tags : [];
        const shouldUpdate =
            !existing ||
            existing.title !== title ||
            existing.content_markdown !== content ||
            !existingTags.map((x: string) => String(x).toLowerCase()).includes(tag);

        if (!existing) {
            report.totals.created_pages++;
            byCol.created_pages++;
        } else if (shouldUpdate) {
            report.totals.updated_pages++;
            byCol.updated_pages++;
        } else {
            report.totals.unchanged_rows++;
            byCol.unchanged_rows++;
        }

        if (!opts.dryRun && shouldUpdate) {
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
        }

        const recordNeedsLink = existingPageId !== pageId;
        if (recordNeedsLink) {
            report.totals.linked_records++;
            byCol.linked_records++;
            report.mappings.push({
                record_id: String(row.record_id),
                old_page_id: existingPageId,
                new_page_id: pageId,
            });
            if (!opts.dryRun) {
                await sql`UPDATE collection_records SET page_id = ${pageId} WHERE id = ${row.record_id}`;
            }
        }

        if (!opts.dryRun) {
            await persistDocExtraction(sql, {
                workspaceId,
                pageId,
                markdown: `${content}\n\n#${tag}\n`,
                userSub: null,
            });
        }

        processed++;
        if (processed % 200 === 0) {
            console.log(
                `[migrate-records-to-docs] processed=${processed}/${rows.length} created=${report.totals.created_pages} updated=${report.totals.updated_pages} linked=${report.totals.linked_records}`
            );
        }
    }

    report.finished_at = new Date().toISOString();
    if (opts.dryRun) {
        report.notes.push('Dry-run only. No writes were made.');
    } else {
        report.notes.push(
            'Migration applied. Use scripts/rollback-record-links.ts with this report if needed.'
        );
    }

    ensureDirFor(opts.reportPath);
    fs.writeFileSync(path.resolve(opts.reportPath), JSON.stringify(report, null, 2), 'utf-8');

    console.log(
        `[migrate-records-to-docs] done processed=${processed} created=${report.totals.created_pages} updated=${report.totals.updated_pages} linked=${report.totals.linked_records}`
    );
    console.log(`[migrate-records-to-docs] report=${path.resolve(opts.reportPath)}`);
}

main().catch((err) => {
    console.error('[migrate-records-to-docs] failed:', err);
    process.exit(1);
});
