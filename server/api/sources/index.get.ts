import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) return { sources: [] };

    try {
        const rows = await sql`SELECT s.id, s.source_type, s.display_name, s.status,
            s.config_jsonb, s.created_at, s.updated_at,
            (SELECT COUNT(*)::int FROM source_objects o WHERE o.source_id = s.id) AS object_count
            FROM sources s
            WHERE s.workspace_id = ${workspaceId}
            ORDER BY s.updated_at DESC`;
        return { sources: rows };
    } catch (err: any) {
        if (err.message?.includes('does not exist')) return { sources: [] };
        throw err;
    }
});
