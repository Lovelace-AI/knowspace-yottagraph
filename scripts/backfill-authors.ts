import 'dotenv/config';

import { getDb } from '../server/utils/neon';
import { ensureSchema } from '../server/utils/schema';

interface Row {
    id: string;
    import_status: string | null;
    created_by: string | null;
    updated_by: string | null;
}

async function main() {
    const sql = getDb();
    if (!sql) {
        throw new Error('DATABASE_URL missing. Pull env first (vercel env pull .env.production).');
    }
    await ensureSchema();

    const wsRows: any = await sql`SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1`;
    const workspaceId = wsRows[0]?.id as string | undefined;
    if (!workspaceId) throw new Error('No workspace found.');

    const pages: Row[] = await sql`SELECT id, import_status, created_by, updated_by
        FROM pages
        WHERE workspace_id = ${workspaceId}
          AND deleted_at IS NULL`;

    let patched = 0;
    let noChange = 0;
    let importPatched = 0;
    let nativePatched = 0;

    for (const p of pages) {
        const isImported =
            (p.import_status || '').toLowerCase().includes('import') ||
            (p.import_status || '').toLowerCase().includes('notion');
        const fallback = isImported ? 'import|system' : 'dev-user|local';
        const createdBy = (p.created_by || '').trim() || fallback;
        const updatedBy = (p.updated_by || '').trim() || createdBy;

        if (createdBy === p.created_by && updatedBy === p.updated_by) {
            noChange++;
            continue;
        }

        await sql`UPDATE pages
            SET created_by = ${createdBy},
                updated_by = ${updatedBy},
                updated_at = NOW()
            WHERE id = ${p.id}
              AND workspace_id = ${workspaceId}`;
        patched++;
        if (isImported) importPatched++;
        else nativePatched++;
    }

    console.log(
        JSON.stringify(
            {
                workspaceId,
                total: pages.length,
                patched,
                noChange,
                importPatched,
                nativePatched,
            },
            null,
            2
        )
    );
}

main().catch((err) => {
    console.error('[backfill-authors] failed:', err);
    process.exit(1);
});
