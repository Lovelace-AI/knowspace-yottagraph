import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing page id' });

    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }

    const rows = await sql`SELECT * FROM pages
        WHERE id = ${id} AND workspace_id = ${workspaceId} AND deleted_at IS NULL
        LIMIT 1`;
    if (rows.length === 0) throw createError({ statusCode: 404, statusMessage: 'Page not found' });
    const page = rows[0];

    const breadcrumbs: Array<{ id: string; title: string; emoji: string | null }> = [];
    let cur = page.parent_page_id as string | null;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
        seen.add(cur);
        const parentRows: any = await sql`SELECT id, title, emoji, parent_page_id FROM pages
            WHERE id = ${cur} AND workspace_id = ${workspaceId} LIMIT 1`;
        if (!parentRows[0]) break;
        breadcrumbs.unshift({
            id: parentRows[0].id,
            title: parentRows[0].title,
            emoji: parentRows[0].emoji,
        });
        cur = parentRows[0].parent_page_id;
    }

    const children = await sql`SELECT id, title, emoji FROM pages
        WHERE parent_page_id = ${id} AND workspace_id = ${workspaceId} AND deleted_at IS NULL
        ORDER BY position ASC, updated_at DESC`;

    return { page, breadcrumbs, children };
});
