import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing page id' });

    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) return { backlinks: [], dbConfigured: false };

    const rows = await sql`SELECT e.id, e.from_page_id, p.title, p.emoji, p.updated_at, e.source
        FROM page_edges e
        JOIN pages p ON p.id = e.from_page_id
        WHERE e.workspace_id = ${workspaceId}
          AND e.to_page_id = ${id}
          AND e.edge_type = 'wiki_link'
          AND p.deleted_at IS NULL
        ORDER BY p.updated_at DESC`;

    return { backlinks: rows, dbConfigured: true };
});
