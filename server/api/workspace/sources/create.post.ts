import { newId, nowIso, requireAuth, writeOne } from '../../../utils/workspace';
import type { SourceRecord, SourceType } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const body = await readBody<Partial<SourceRecord> & { sourceType: SourceType }>(event);
    const now = nowIso();

    const source: SourceRecord = {
        id: newId('src'),
        sourceType: body.sourceType,
        displayName: body.displayName || defaultDisplayName(body.sourceType),
        status: body.status ?? 'pending',
        config: body.config ?? {},
        createdAt: now,
        updatedAt: now,
    };
    await writeOne(ctx, 'sources', source);
    return source;
});

function defaultDisplayName(type: SourceType): string {
    switch (type) {
        case 'notion_export':
            return 'Notion export';
        case 'google_drive':
            return 'Google Drive';
        case 'google_doc':
            return 'Google Doc';
        case 'upload':
            return 'Uploaded file';
        default:
            return 'Manual source';
    }
}
