import { nowIso, readOne, requireAuth, writeOne } from '../../../utils/workspace';
import type { SourceRecord } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;
    const body = await readBody<Partial<SourceRecord>>(event);
    const existing = await readOne<SourceRecord>(ctx, 'sources', id);
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Source not found' });
    const next: SourceRecord = {
        ...existing,
        ...body,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: nowIso(),
    };
    await writeOne(ctx, 'sources', next);
    return next;
});
