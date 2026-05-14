import { readAll, readOne, requireAuth } from '../../../utils/workspace';
import type { EntityRecord, PageRecord } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;
    const entity = await readOne<EntityRecord>(ctx, 'entities', id);
    if (!entity) throw createError({ statusCode: 404, statusMessage: 'Entity not found' });

    const allPages = await readAll<PageRecord>(ctx, 'pages');
    const pageMap = new Map(allPages.map((p) => [p.id, p]));
    const mentionedPages = entity.mentions
        .map((m) => pageMap.get(m.pageId))
        .filter((p): p is PageRecord => Boolean(p));

    const allEntities = await readAll<EntityRecord>(ctx, 'entities');
    const related = allEntities.filter((e) => entity.relatedIds.includes(e.id));

    return { entity, mentionedPages, relatedEntities: related };
});
