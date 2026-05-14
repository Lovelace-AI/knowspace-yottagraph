import { readAll, requireAuth } from '../../../utils/workspace';
import type { EntityRecord } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const entities = await readAll<EntityRecord>(ctx, 'entities');
    entities.sort((a, b) => b.mentions.length - a.mentions.length);
    return entities;
});
