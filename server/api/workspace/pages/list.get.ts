import { readAll, requireAuth } from '../../../utils/workspace';
import type { PageRecord } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const pages = await readAll<PageRecord>(ctx, 'pages');
    pages.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return pages;
});
