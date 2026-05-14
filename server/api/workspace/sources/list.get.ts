import { readAll, requireAuth } from '../../../utils/workspace';
import type { SourceRecord } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const sources = await readAll<SourceRecord>(ctx, 'sources');
    sources.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return sources;
});
