import { readOne, requireAuth } from '../../../utils/workspace';
import type { PageRecord } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;
    const page = await readOne<PageRecord>(ctx, 'pages', id);
    if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found' });
    return page;
});
