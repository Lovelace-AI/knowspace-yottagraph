import { readAll, requireAuth } from '../../../utils/workspace';
import type { ImportBatch } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const batches = await readAll<ImportBatch>(ctx, 'imports');
    batches.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
    return batches;
});
