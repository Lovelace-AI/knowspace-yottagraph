import { readOne, requireAuth } from '../../../utils/workspace';
import type { ImportBatch } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;
    const batch = await readOne<ImportBatch>(ctx, 'imports', id);
    if (!batch) throw createError({ statusCode: 404, statusMessage: 'Import not found' });
    return batch;
});
