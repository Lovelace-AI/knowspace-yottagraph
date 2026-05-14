// Quick navigation summary: counts and recent items so the sidebar/dashboard
// can render without spamming individual list endpoints.

import { readAll, requireAuth } from '../../../utils/workspace';
import type {
    CollectionDef,
    EntityRecord,
    ImportBatch,
    PageRecord,
    SourceRecord,
} from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);

    const [pages, collections, sources, entities, imports] = await Promise.all([
        readAll<PageRecord>(ctx, 'pages'),
        readAll<CollectionDef>(ctx, 'collections'),
        readAll<SourceRecord>(ctx, 'sources'),
        readAll<EntityRecord>(ctx, 'entities'),
        readAll<ImportBatch>(ctx, 'imports'),
    ]);

    pages.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    return {
        counts: {
            pages: pages.length,
            collections: collections.length,
            sources: sources.length,
            entities: entities.length,
            imports: imports.length,
        },
        recentPages: pages.slice(0, 8).map((p) => ({
            id: p.id,
            title: p.title,
            emoji: p.emoji,
            updatedAt: p.updatedAt,
            parentId: p.parentId,
        })),
        favorites: pages
            .filter((p) => p.favorite)
            .slice(0, 8)
            .map((p) => ({ id: p.id, title: p.title, emoji: p.emoji })),
        importStatus: {
            active: imports.filter((i) => i.status === 'processing' || i.status === 'queued')
                .length,
            failed: imports.filter((i) => i.status === 'failed').length,
            completed: imports.filter((i) => i.status === 'completed').length,
        },
    };
});
