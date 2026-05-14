import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) return { batches: [] };

    try {
        const rows = await sql`SELECT b.id, b.status, b.started_at, b.completed_at,
            b.stats_jsonb, b.errors_jsonb, b.created_at,
            s.display_name AS source_name, s.source_type
            FROM import_batches b
            LEFT JOIN sources s ON s.id = b.source_id
            WHERE b.workspace_id = ${workspaceId}
            ORDER BY b.created_at DESC
            LIMIT 100`;
        return { batches: rows };
    } catch (err: any) {
        if (err.message?.includes('does not exist')) return { batches: [] };
        throw err;
    }
});
