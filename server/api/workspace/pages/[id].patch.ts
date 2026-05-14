import { nowIso, readAll, readOne, requireAuth, writeOne } from '../../../utils/workspace';
import { extractEntities } from '../../../utils/entityExtractor';
import type { EntityRecord, PageRecord } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const id = getRouterParam(event, 'id') as string;
    const body = await readBody<Partial<PageRecord>>(event);

    const existing = await readOne<PageRecord>(ctx, 'pages', id);
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Page not found' });

    const next: PageRecord = {
        ...existing,
        ...body,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: nowIso(),
    };

    await writeOne(ctx, 'pages', next);

    if (body.contentMarkdown !== undefined && body.contentMarkdown !== existing.contentMarkdown) {
        const extracted = extractEntities(`${next.title}\n\n${next.contentMarkdown}`);
        if (extracted.length) {
            const allEntities = await readAll<EntityRecord>(ctx, 'entities');
            const byKey = new Map(allEntities.map((e) => [e.canonicalName.toLowerCase(), e]));
            const now = nowIso();
            for (const cand of extracted) {
                const key = cand.name.toLowerCase();
                const prior = byKey.get(key);
                if (prior) {
                    const alreadyMentioned = prior.mentions.some((m) => m.pageId === next.id);
                    if (!alreadyMentioned) {
                        prior.mentions.push({
                            pageId: next.id,
                            snippet: cand.snippet,
                            confidence: cand.confidence,
                        });
                        prior.confidence = Math.min(1, prior.confidence + 0.03);
                        prior.updatedAt = now;
                        await writeOne(ctx, 'entities', prior);
                    }
                }
            }
        }
    }

    return next;
});
