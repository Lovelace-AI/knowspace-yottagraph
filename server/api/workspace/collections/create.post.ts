import { newId, nowIso, requireAuth, writeOne } from '../../../utils/workspace';
import type { CollectionDef, CollectionField } from '../../../../utils/knowspaceTypes';

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const body = await readBody<Partial<CollectionDef>>(event);

    const now = nowIso();
    const fields: CollectionField[] = body.fields?.length
        ? body.fields
        : [
              { id: newId('fld'), name: 'Name', type: 'text' },
              {
                  id: newId('fld'),
                  name: 'Status',
                  type: 'select',
                  options: ['Todo', 'Doing', 'Done'],
              },
              { id: newId('fld'), name: 'Tags', type: 'multi_select', options: [] },
          ];

    const collection: CollectionDef = {
        id: newId('col'),
        name: body.name?.trim() || 'Untitled collection',
        description: body.description || '',
        icon: body.icon || '🗂️',
        fields,
        sourceId: body.sourceId ?? null,
        createdAt: now,
        updatedAt: now,
    };

    await writeOne(ctx, 'collections', collection);
    return collection;
});
