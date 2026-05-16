import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';
import { slugify } from '~/server/utils/ids';

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) return { collections: [] };

    try {
        const rows = await sql`SELECT c.id, c.name, c.description, c.updated_at,
            (SELECT COUNT(*)::int FROM collection_records r WHERE r.collection_id = c.id) AS record_count
            FROM collections c
            WHERE c.workspace_id = ${workspaceId}
            ORDER BY c.updated_at DESC`;
        return {
            deprecated: true,
            message: 'Collections are being migrated to tag pages.',
            collections: (rows || []).map((r: any) => ({
                ...r,
                tag: slugify(r.name || ''),
                tag_url: `/t/${encodeURIComponent(slugify(r.name || ''))}`,
            })),
        };
    } catch (err: any) {
        if (err.message?.includes('does not exist')) return { collections: [], deprecated: true };
        throw err;
    }
});
