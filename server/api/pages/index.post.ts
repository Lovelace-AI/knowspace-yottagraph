import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace, getUserSub } from '~/server/utils/workspace';
import { newId, slugify } from '~/server/utils/ids';

interface CreatePageBody {
    title?: string;
    emoji?: string;
    parent_page_id?: string | null;
    content_markdown?: string;
}

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }
    const body = await readBody<CreatePageBody>(event);
    const userSub = await getUserSub(event);

    const id = newId('pg');
    const title = (body.title || 'Untitled').slice(0, 200);
    const slug = slugify(title) || id;
    const emoji = body.emoji || null;
    const parent = body.parent_page_id || null;
    const content = body.content_markdown || '';

    await sql`INSERT INTO pages
        (id, workspace_id, parent_page_id, title, slug, emoji,
         content_markdown, created_by, updated_by, import_status)
        VALUES (${id}, ${workspaceId}, ${parent}, ${title}, ${slug}, ${emoji},
                ${content}, ${userSub}, ${userSub}, 'native')`;

    return { id, title, slug, emoji, parent_page_id: parent };
});
