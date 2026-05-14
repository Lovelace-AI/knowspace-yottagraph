import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) return { entities: [] };

    try {
        const rows = await sql`SELECT e.id, e.canonical_name, e.entity_type, e.summary,
            e.confidence, e.updated_at,
            (SELECT COUNT(*)::int FROM entity_mentions m WHERE m.entity_id = e.id) AS mention_count
            FROM entities e
            WHERE e.workspace_id = ${workspaceId}
            ORDER BY e.canonical_name ASC`;
        return { entities: rows };
    } catch (err: any) {
        if (err.message?.includes('does not exist')) return { entities: [] };
        throw err;
    }
});
