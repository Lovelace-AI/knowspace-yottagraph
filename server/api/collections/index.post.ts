import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace, newId } from '~/server/utils/workspace';

interface CreateCollectionBody {
    name?: string;
    description?: string;
}

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }
    const body = await readBody<CreateCollectionBody>(event);
    const id = newId('col');
    const name = (body.name || 'Untitled Collection').slice(0, 200);

    await sql`INSERT INTO collections (id, workspace_id, name, description)
        VALUES (${id}, ${workspaceId}, ${name}, ${body.description || null})`;

    await sql`INSERT INTO collection_fields (id, collection_id, name, field_type, position)
        VALUES (${newId('fld')}, ${id}, 'Name', 'text', 0)`;
    await sql`INSERT INTO collection_fields (id, collection_id, name, field_type, position)
        VALUES (${newId('fld')}, ${id}, 'Status', 'select', 1)`;
    await sql`INSERT INTO collection_fields (id, collection_id, name, field_type, position)
        VALUES (${newId('fld')}, ${id}, 'Updated', 'date', 2)`;

    return { id, name };
});
