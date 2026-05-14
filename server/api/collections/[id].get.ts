import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing collection id' });

    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }

    const collectionRows = await sql`SELECT * FROM collections
        WHERE id = ${id} AND workspace_id = ${workspaceId} LIMIT 1`;
    if (collectionRows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Collection not found' });
    }
    const collection = collectionRows[0];

    const fields = await sql`SELECT id, name, field_type, config_jsonb, position
        FROM collection_fields WHERE collection_id = ${id}
        ORDER BY position ASC`;

    const records = await sql`SELECT r.id, r.properties_jsonb, r.page_id, r.updated_at,
        p.title AS page_title, p.emoji AS page_emoji
        FROM collection_records r
        LEFT JOIN pages p ON p.id = r.page_id
        WHERE r.collection_id = ${id}
        ORDER BY r.updated_at DESC`;

    return { collection, fields, records };
});
