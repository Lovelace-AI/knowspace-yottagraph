import { newId, nowIso, readAll, requireAuth, writeOne } from '../../../utils/workspace';
import { extractEntities } from '../../../utils/entityExtractor';
import type { EntityRecord, PageRecord } from '../../../../utils/knowspaceTypes';

function slugify(input: string): string {
    return (
        input
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'untitled'
    );
}

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const body = await readBody<Partial<PageRecord>>(event);

    const now = nowIso();
    const page: PageRecord = {
        id: newId('pg'),
        title: body.title?.trim() || 'Untitled',
        slug: slugify(body.title || 'untitled'),
        emoji: body.emoji || '📄',
        parentId: body.parentId ?? null,
        contentMarkdown: body.contentMarkdown ?? '',
        tags: body.tags ?? [],
        sourceId: body.sourceId ?? null,
        sourceObjectId: body.sourceObjectId ?? null,
        importStatus: body.importStatus ?? 'manual',
        importPath: body.importPath ?? null,
        favorite: false,
        createdAt: now,
        updatedAt: now,
    };

    await writeOne(ctx, 'pages', page);

    if (page.contentMarkdown.trim()) {
        const extracted = extractEntities(`${page.title}\n\n${page.contentMarkdown}`);
        if (extracted.length) {
            const existing = await readAll<EntityRecord>(ctx, 'entities');
            const byKey = new Map(existing.map((e) => [e.canonicalName.toLowerCase(), e]));
            for (const cand of extracted) {
                const key = cand.name.toLowerCase();
                const prior = byKey.get(key);
                if (prior) {
                    prior.mentions.push({
                        pageId: page.id,
                        snippet: cand.snippet,
                        confidence: cand.confidence,
                    });
                    prior.confidence = Math.min(1, prior.confidence + 0.05);
                    prior.updatedAt = now;
                    await writeOne(ctx, 'entities', prior);
                } else {
                    const entity: EntityRecord = {
                        id: newId('ent'),
                        canonicalName: cand.name,
                        type: cand.type,
                        aliases: [],
                        confidence: cand.confidence,
                        summary: '',
                        mentions: [
                            {
                                pageId: page.id,
                                snippet: cand.snippet,
                                confidence: cand.confidence,
                            },
                        ],
                        relatedIds: [],
                        createdAt: now,
                        updatedAt: now,
                    };
                    await writeOne(ctx, 'entities', entity);
                    byKey.set(key, entity);
                }
            }
        }
    }

    return page;
});
