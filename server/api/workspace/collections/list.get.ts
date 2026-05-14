import { readAll, requireAuth } from '../../../utils/workspace';
import type { CollectionDef } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const collections = await readAll<CollectionDef>(ctx, 'collections');
    collections.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return collections;
});
