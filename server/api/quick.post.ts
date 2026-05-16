import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace, getUserSub } from '~/server/utils/workspace';
import { newId, slugify } from '~/server/utils/ids';
import { persistDocExtraction } from '~/server/utils/docExtract';

interface QuickBody {
    title?: string;
    text?: string;
    tag?: string;
}

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }
    const userSub = await getUserSub(event);
    const body = await readBody<QuickBody>(event);
    const title = (body.title || body.text || 'Quick note').trim().slice(0, 200) || 'Quick note';
    const text = (body.text || '').trim();
    const tag = (body.tag || '').trim().toLowerCase();
    const id = newId('pg');
    const content = `${text}${tag ? `\n\n#${tag}` : ''}`.trim();

    await sql`INSERT INTO pages
        (id, workspace_id, title, slug, content_markdown, import_status, created_by, updated_by)
        VALUES (${id}, ${workspaceId}, ${title}, ${slugify(title) || id}, ${content}, 'native', ${userSub}, ${userSub})`;

    await persistDocExtraction(sql, {
        workspaceId,
        pageId: id,
        markdown: content,
        userSub,
    });

    return { id, url: `/pages/${id}` };
});
