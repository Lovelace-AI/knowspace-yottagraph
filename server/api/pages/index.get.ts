import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) {
        return { pages: [], dbConfigured: false };
    }

    try {
        const rows = await sql`
            SELECT id, parent_page_id, title, emoji, is_favorite, position,
                   updated_at, created_at, import_status
            FROM pages
            WHERE workspace_id = ${workspaceId} AND deleted_at IS NULL
            ORDER BY position ASC, updated_at DESC
        `;
        return { pages: rows, dbConfigured: true };
    } catch (err: any) {
        if (err.message?.includes('does not exist')) {
            return { pages: [], dbConfigured: true };
        }
        throw err;
    }
});
