import { deleteOne, requireAuth } from '../../../utils/workspace';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;
    await deleteOne(ctx, 'collections', id);
    return { ok: true };
});
