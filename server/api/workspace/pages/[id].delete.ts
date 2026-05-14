import { deleteOne, readAll, requireAuth, writeOne } from '../../../utils/workspace';
import type { PageRecord } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;

    const all = await readAll<PageRecord>(ctx, 'pages');
    for (const child of all) {
        if (child.parentId === id) {
            child.parentId = null;
            await writeOne(ctx, 'pages', child);
        }
    }

    await deleteOne(ctx, 'pages', id);
    return { ok: true };
});
