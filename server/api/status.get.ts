import { isDbConfigured } from '~/server/utils/neon';
import { isKVConfigured } from '~/server/utils/redis';

export default defineEventHandler(() => {
    return {
        db: isDbConfigured(),
        kv: isKVConfigured(),
    };
});
