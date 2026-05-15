import { commitBundle } from '~/server/utils/notionImport';
import { isDbConfigured } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace, getUserSub } from '~/server/utils/workspace';

/**
 * Service-to-service commit endpoint used by `scripts/notion-prep.ts
 * --upload`. Accepts the bundle as the JSON body. Authentication is
 * either:
 *
 *   - the standard Auth0 cookie (when called from a browser session), or
 *   - an `X-Api-Key` header matching `NUXT_PUBLIC_QS_API_KEY` /
 *     `runtimeConfig.public.qsApiKey` (the same key the gateway uses,
 *     committed to broadchurch.yaml). This lets a CLI run from a
 *     developer's laptop without an Auth0 session.
 */
export default defineEventHandler(async (event) => {
    if (!isDbConfigured()) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }

    const config = useRuntimeConfig(event);
    const headerKey = getRequestHeader(event, 'x-api-key');
    const cookieSub = await getUserSub(event);
    const apiKeyValid =
        headerKey && config.public.qsApiKey && headerKey === (config.public.qsApiKey as string);

    if (!cookieSub && !apiKeyValid) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized — supply Auth0 cookie or matching X-Api-Key',
        });
    }

    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!workspaceId) {
        throw createError({ statusCode: 503, statusMessage: 'Workspace bootstrap failed' });
    }

    const bundle = await readBody(event);
    if (!bundle || typeof bundle !== 'object') {
        throw createError({ statusCode: 400, statusMessage: 'Body must be a JSON bundle object' });
    }

    const userSub = cookieSub || 'cli-import';
    try {
        const result = await commitBundle(bundle, { workspaceId, userSub });
        return { ...result, status: 'completed' };
    } catch (err: any) {
        throw createError({
            statusCode: 400,
            statusMessage: `Bundle commit failed: ${err?.message || err}`,
        });
    }
});
