import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) return { pages: [] };

    try {
        const rows = await sql`SELECT id, title, emoji, updated_at, is_favorite
            FROM pages
            WHERE workspace_id = ${workspaceId} AND deleted_at IS NULL
            ORDER BY updated_at DESC
            LIMIT 12`;
        return { pages: rows };
    } catch (err: any) {
        if (err.message?.includes('does not exist')) return { pages: [] };
        throw err;
    }
});
