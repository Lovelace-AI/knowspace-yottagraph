import { readAll, readOne, requireAuth } from '../../../utils/workspace';
import type { CollectionDef, CollectionRecord } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;
    const collection = await readOne<CollectionDef>(ctx, 'collections', id);
    if (!collection) throw createError({ statusCode: 404, statusMessage: 'Collection not found' });
    const allRecords = await readAll<CollectionRecord>(ctx, `collection_records:${id}`);
    return { collection, records: allRecords };
});
