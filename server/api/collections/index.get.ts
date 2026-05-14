import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) return { collections: [] };

    try {
        const rows = await sql`SELECT c.id, c.name, c.description, c.updated_at,
            (SELECT COUNT(*)::int FROM collection_records r WHERE r.collection_id = c.id) AS record_count
            FROM collections c
            WHERE c.workspace_id = ${workspaceId}
            ORDER BY c.updated_at DESC`;
        return { collections: rows };
    } catch (err: any) {
        if (err.message?.includes('does not exist')) return { collections: [] };
        throw err;
    }
});
