import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';
import { stripMarkdown } from '~/utils/markdown';

export default defineEventHandler(async (event) => {
    const title = String(getQuery(event).title || '').trim();
    if (!title) return { found: false, snippet: '' };

    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) return { found: false, snippet: '' };

    const rows: any = await sql`SELECT id, title, emoji, content_markdown
        FROM pages
        WHERE workspace_id = ${workspaceId}
          AND deleted_at IS NULL
          AND lower(title) = lower(${title})
        ORDER BY updated_at DESC
        LIMIT 1`;

    const row = rows[0];
    if (!row) return { found: false, snippet: '' };
    return {
        found: true,
        id: row.id,
        title: row.title,
        emoji: row.emoji,
        snippet: stripMarkdown(row.content_markdown || '', 220),
    };
});
