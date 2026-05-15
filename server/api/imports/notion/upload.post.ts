import { commitBundle } from '~/server/utils/notionImport';
import { isDbConfigured } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace, getUserSub } from '~/server/utils/workspace';
import { newId } from '~/server/utils/ids';
import { getDb } from '~/server/utils/neon';
import { ensureSchema } from '~/server/utils/schema';

/**
 * Accepts a Notion-prep JSON bundle uploaded from the Import Center
 * and commits it to Postgres. Two transports supported:
 *
 *   1. multipart/form-data with a `bundle` file part (browser upload)
 *   2. application/json body containing the bundle directly
 *
 * If neither shape is present we still record a queued batch so the
 * Import Center reflects that something arrived.
 */
export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId || !isDbConfigured()) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }
    await ensureSchema();
    const userSub = await getUserSub(event);

    const contentType = getRequestHeader(event, 'content-type') || '';

    let bundle: unknown = null;

    if (contentType.startsWith('multipart/form-data')) {
        const parts = await readMultipartFormData(event);
        if (!parts) {
            throw createError({ statusCode: 400, statusMessage: 'Empty multipart body' });
        }
        const bundlePart = parts.find(
            (p) => p.name === 'bundle' || (p.filename && p.filename.toLowerCase().endsWith('.json'))
        );
        if (!bundlePart) {
            throw createError({
                statusCode: 400,
                statusMessage: 'No bundle part found (expected a .json file)',
            });
        }
        try {
            bundle = JSON.parse(bundlePart.data.toString('utf-8'));
        } catch (err: any) {
            throw createError({
                statusCode: 400,
                statusMessage: `Bundle is not valid JSON: ${err?.message || err}`,
            });
        }
    } else if (contentType.startsWith('application/json')) {
        bundle = await readBody(event);
    }

    if (!bundle || typeof bundle !== 'object' || !('pages' in (bundle as object))) {
        const sourceId = newId('src');
        await sql`INSERT INTO sources
            (id, workspace_id, source_type, display_name, status, created_by)
            VALUES (${sourceId}, ${workspaceId}, 'notion_export', 'Notion Export (queued)', 'pending', ${userSub})`;
        const batchId = newId('imp');
        await sql`INSERT INTO import_batches
            (id, workspace_id, source_id, status, created_by, stats_jsonb)
            VALUES (${batchId}, ${workspaceId}, ${sourceId}, 'queued', ${userSub},
                    '{"note":"Awaiting bundle. Generate one with: npm run notion-prep -- --path <export> --out <bundle.json>"}'::jsonb)`;
        return { batch_id: batchId, source_id: sourceId, status: 'queued' };
    }

    try {
        const result = await commitBundle(bundle, { workspaceId, userSub });
        return { ...result, status: 'completed' };
    } catch (err: any) {
        throw createError({
            statusCode: 400,
            statusMessage: `Bundle commit failed: ${err?.message || err}`,
        });
    }
});
