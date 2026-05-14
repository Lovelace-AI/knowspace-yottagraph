import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace, getUserSub } from '~/server/utils/workspace';

interface PatchPageBody {
    title?: string;
    emoji?: string | null;
    content_markdown?: string;
    parent_page_id?: string | null;
    is_favorite?: boolean;
    tags?: string[];
}

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing page id' });

    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }
    const body = await readBody<PatchPageBody>(event);
    const userSub = await getUserSub(event);

    if (body.title !== undefined) {
        await sql`UPDATE pages SET title = ${body.title}, updated_by = ${userSub}, updated_at = NOW()
            WHERE id = ${id} AND workspace_id = ${workspaceId}`;
    }
    if (body.emoji !== undefined) {
        await sql`UPDATE pages SET emoji = ${body.emoji}, updated_by = ${userSub}, updated_at = NOW()
            WHERE id = ${id} AND workspace_id = ${workspaceId}`;
    }
    if (body.content_markdown !== undefined) {
        await sql`UPDATE pages SET content_markdown = ${body.content_markdown},
            updated_by = ${userSub}, updated_at = NOW()
            WHERE id = ${id} AND workspace_id = ${workspaceId}`;
    }
    if (body.parent_page_id !== undefined) {
        await sql`UPDATE pages SET parent_page_id = ${body.parent_page_id},
            updated_by = ${userSub}, updated_at = NOW()
            WHERE id = ${id} AND workspace_id = ${workspaceId}`;
    }
    if (body.is_favorite !== undefined) {
        await sql`UPDATE pages SET is_favorite = ${body.is_favorite}, updated_at = NOW()
            WHERE id = ${id} AND workspace_id = ${workspaceId}`;
    }
    if (body.tags !== undefined) {
        await sql`UPDATE pages SET tags = ${JSON.stringify(body.tags)}::jsonb, updated_at = NOW()
            WHERE id = ${id} AND workspace_id = ${workspaceId}`;
    }

    const rows = await sql`SELECT id, title, emoji, parent_page_id, is_favorite, tags, updated_at
        FROM pages WHERE id = ${id} LIMIT 1`;
    return rows[0];
});
