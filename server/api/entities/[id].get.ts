import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing entity id' });

    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }

    const rows = await sql`SELECT * FROM entities
        WHERE id = ${id} AND workspace_id = ${workspaceId} LIMIT 1`;
    if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Entity not found' });
    }
    const entity = rows[0];

    const mentions = await sql`SELECT m.id, m.page_id, m.context_snippet, m.confidence,
        m.created_at, p.title AS page_title, p.emoji AS page_emoji
        FROM entity_mentions m
        LEFT JOIN pages p ON p.id = m.page_id
        WHERE m.entity_id = ${id}
        ORDER BY m.created_at DESC
        LIMIT 100`;

    const related = await sql`SELECT r.relationship_type, r.confidence,
        e2.id AS other_id, e2.canonical_name AS other_name, e2.entity_type AS other_type
        FROM entity_relationships r
        JOIN entities e2 ON e2.id = CASE WHEN r.from_entity_id = ${id} THEN r.to_entity_id ELSE r.from_entity_id END
        WHERE r.from_entity_id = ${id} OR r.to_entity_id = ${id}
        ORDER BY r.confidence DESC NULLS LAST
        LIMIT 50`;

    return { entity, mentions, related };
});
