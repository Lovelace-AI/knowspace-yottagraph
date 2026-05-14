import { nowIso, readOne, requireAuth, writeOne } from '../../../../../utils/workspace';
import type { CollectionRecord } from '../../../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;
    const recordId = getRouterParam(event, 'recordId') as string;
    const body = await readBody<{ properties?: Record<string, unknown> }>(event);

    const existing = await readOne<CollectionRecord>(ctx, `collection_records:${id}`, recordId);
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Record not found' });

    const next: CollectionRecord = {
        ...existing,
        properties: { ...existing.properties, ...(body.properties ?? {}) },
        updatedAt: nowIso(),
    };
    await writeOne(ctx, `collection_records:${id}`, next);
    return next;
});
