import { nowIso, readOne, requireAuth, writeOne } from '../../../utils/workspace';
import type { CollectionDef } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;
    const body = await readBody<Partial<CollectionDef>>(event);
    const existing = await readOne<CollectionDef>(ctx, 'collections', id);
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Collection not found' });
    const next: CollectionDef = {
        ...existing,
        ...body,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: nowIso(),
    };
    await writeOne(ctx, 'collections', next);
    return next;
});
