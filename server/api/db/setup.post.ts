import { ensureSchema } from '~/server/utils/schema';
import { isDbConfigured } from '~/server/utils/neon';

export default defineEventHandler(async () => {
    if (!isDbConfigured()) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }
    const ok = await ensureSchema();
    return { ok };
});
