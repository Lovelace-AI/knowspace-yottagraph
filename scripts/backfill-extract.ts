import 'dotenv/config';

import { getDb } from '../server/utils/neon';
import { ensureSchema } from '../server/utils/schema';
import { persistDocExtraction } from '../server/utils/docExtract';

async function main() {
    const sql = getDb();
    if (!sql) {
        throw new Error(
            'DATABASE_URL is missing. Pull env first (vercel env pull .env.production).'
        );
    }
    await ensureSchema();

    const workspaceRows: any = await sql`SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1`;
    const workspaceId = workspaceRows[0]?.id;
    if (!workspaceId) throw new Error('No workspace found.');

    const pages: any = await sql`SELECT id, content_markdown
        FROM pages
        WHERE workspace_id = ${workspaceId}
          AND deleted_at IS NULL
        ORDER BY updated_at DESC`;

    console.log(`[backfill-extract] workspace=${workspaceId} pages=${pages.length}`);
    let processed = 0;
    for (const p of pages) {
        await persistDocExtraction(sql, {
            workspaceId,
            pageId: p.id,
            markdown: p.content_markdown || '',
            userSub: null,
        });
        processed++;
        if (processed % 100 === 0)
            console.log(`[backfill-extract] processed ${processed}/${pages.length}`);
    }
    console.log(`[backfill-extract] done ${processed}/${pages.length}`);
}

main().catch((err) => {
    console.error('[backfill-extract] failed:', err);
    process.exit(1);
});
