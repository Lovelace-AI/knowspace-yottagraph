import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace, getUserSub, newId } from '~/server/utils/workspace';

/**
 * Scaffold for Notion zip upload. Phase 1: records an import batch in a
 * `queued` state without actually parsing. Phase 2 will wire this to
 * Vercel Blob + a background job that extracts/parses the export.
 */
export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }
    const userSub = await getUserSub(event);

    const sourceId = newId('src');
    await sql`INSERT INTO sources
        (id, workspace_id, source_type, display_name, status, created_by)
        VALUES (${sourceId}, ${workspaceId}, 'notion_export', 'Notion Export', 'pending', ${userSub})`;

    const batchId = newId('imp');
    await sql`INSERT INTO import_batches
        (id, workspace_id, source_id, status, created_by, stats_jsonb)
        VALUES (${batchId}, ${workspaceId}, ${sourceId}, 'queued', ${userSub},
                '{"note":"Upload accepted. Background parser arrives in Phase 2."}'::jsonb)`;

    return { batch_id: batchId, source_id: sourceId, status: 'queued' };
});
