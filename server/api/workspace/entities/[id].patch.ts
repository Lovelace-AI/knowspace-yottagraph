import { nowIso, readOne, requireAuth, writeOne } from '../../../utils/workspace';
import type { EntityRecord } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;
    const body = await readBody<Partial<EntityRecord>>(event);
    const existing = await readOne<EntityRecord>(ctx, 'entities', id);
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Entity not found' });
    const next: EntityRecord = {
        ...existing,
        ...body,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: nowIso(),
    };
    await writeOne(ctx, 'entities', next);
    return next;
});
