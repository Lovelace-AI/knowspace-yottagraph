import { deleteOne, requireAuth } from '../../../../../utils/workspace';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;
    const recordId = getRouterParam(event, 'recordId') as string;
    await deleteOne(ctx, `collection_records:${id}`, recordId);
    return { ok: true };
});
