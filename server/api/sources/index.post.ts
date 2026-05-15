import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace, getUserSub } from '~/server/utils/workspace';
import { newId } from '~/server/utils/ids';

interface CreateSourceBody {
    source_type: string;
    display_name?: string;
    config?: Record<string, unknown>;
}

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }
    const body = await readBody<CreateSourceBody>(event);
    const userSub = await getUserSub(event);

    if (!body?.source_type) {
        throw createError({ statusCode: 400, statusMessage: 'source_type required' });
    }

    const id = newId('src');
    const name =
        body.display_name ||
        (body.source_type === 'notion_export'
            ? 'Notion Export'
            : body.source_type === 'google_drive'
              ? 'Google Drive'
              : body.source_type);

    await sql`INSERT INTO sources
        (id, workspace_id, source_type, display_name, status, config_jsonb, created_by)
        VALUES (${id}, ${workspaceId}, ${body.source_type}, ${name}, 'idle',
                ${JSON.stringify(body.config || {})}::jsonb, ${userSub})`;
    return { id, source_type: body.source_type, display_name: name };
});
