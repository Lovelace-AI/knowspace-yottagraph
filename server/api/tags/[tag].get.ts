import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';
import { parseFrontmatter } from '~/utils/markdown';

export default defineEventHandler(async (event) => {
    const tag = decodeURIComponent(getRouterParam(event, 'tag') || '')
        .trim()
        .toLowerCase();
    if (!tag) throw createError({ statusCode: 400, statusMessage: 'Missing tag' });

    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) return { tag, pages: [], dbConfigured: false };

    const rows =
        await sql`SELECT id, title, emoji, tags, content_markdown, updated_at, import_status
        FROM pages
        WHERE workspace_id = ${workspaceId}
          AND deleted_at IS NULL
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(coalesce(tags, '[]'::jsonb)) AS t(val)
              WHERE lower(t.val) = ${tag}
          )
        ORDER BY updated_at DESC`;

    const pages = (rows || []).map((row: any) => {
        const fm = parseFrontmatter(row.content_markdown || '');
        return {
            ...row,
            frontmatter: fm.data,
            markdown_body: fm.body,
        };
    });

    return { tag, pages, dbConfigured: true };
});
