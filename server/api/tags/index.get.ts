import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) return { tags: [], dbConfigured: false };

    const limitRaw = Number(getQuery(event).limit || 40);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 40;

    const rows = await sql`SELECT tag, COUNT(*)::int AS usage_count
        FROM (
            SELECT jsonb_array_elements_text(coalesce(tags, '[]'::jsonb)) AS tag
            FROM pages
            WHERE workspace_id = ${workspaceId}
              AND deleted_at IS NULL
        ) t
        GROUP BY tag
        ORDER BY usage_count DESC, tag ASC
        LIMIT ${limit}`;

    return { tags: rows, dbConfigured: true };
});
