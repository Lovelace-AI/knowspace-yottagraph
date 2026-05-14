import { newId, nowIso, requireAuth, writeOne } from '../../../../utils/workspace';
import type { CollectionRecord } from '../../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;
    const body = await readBody<{ properties?: Record<string, unknown> }>(event);
    const now = nowIso();
    const record: CollectionRecord = {
        id: newId('rec'),
        workspaceId: ctx.workspaceId,
        collectionId: id,
        properties: body.properties ?? {},
        createdAt: now,
        updatedAt: now,
    };
    await writeOne(ctx, `collection_records:${id}`, record);
    return record;
});
