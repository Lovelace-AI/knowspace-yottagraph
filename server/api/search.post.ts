import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace } from '~/server/utils/workspace';

interface SearchBody {
    q?: string;
    types?: string[];
    limit?: number;
}

export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    const body = await readBody<SearchBody>(event);
    const query = (body?.q || '').trim();

    if (!sql || !workspaceId) {
        return { results: [], dbConfigured: false, query };
    }
    if (!query) return { results: [], dbConfigured: true, query };

    const types =
        body?.types && body.types.length > 0 ? body.types : ['page', 'collection', 'entity', 'tag'];
    const limit = Math.min(Math.max(body?.limit ?? 30, 1), 100);

    const results: any[] = [];

    try {
        if (types.includes('page')) {
            const pageRows: any = await sql`SELECT id, title, emoji, content_markdown, updated_at,
                ts_rank(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content_markdown,'')),
                        plainto_tsquery('english', ${query})) AS rank
                FROM pages
                WHERE workspace_id = ${workspaceId}
                  AND deleted_at IS NULL
                  AND to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content_markdown,''))
                      @@ plainto_tsquery('english', ${query})
                ORDER BY rank DESC
                LIMIT ${limit}`;
            for (const r of pageRows) {
                const md: string = r.content_markdown || '';
                const lower = md.toLowerCase();
                const idx = lower.indexOf(query.toLowerCase());
                const snippet =
                    idx >= 0 ? md.slice(Math.max(0, idx - 60), idx + 140) : md.slice(0, 200);
                results.push({
                    type: 'page',
                    id: r.id,
                    title: r.title,
                    emoji: r.emoji,
                    snippet,
                    updated_at: r.updated_at,
                    score:
                        Number(r.rank || 0) +
                        1 / (1 + (Date.now() - new Date(r.updated_at).getTime()) / 86400000),
                });
            }
        }

        if (types.includes('collection')) {
            const colRows: any = await sql`SELECT id, name, description, updated_at
                FROM collections
                WHERE workspace_id = ${workspaceId}
                  AND (name ILIKE ${'%' + query + '%'} OR coalesce(description,'') ILIKE ${'%' + query + '%'})
                LIMIT ${limit}`;
            for (const r of colRows) {
                results.push({
                    type: 'collection',
                    id: r.id,
                    title: r.name,
                    snippet: r.description || '',
                    updated_at: r.updated_at,
                    score: 0.4,
                });
            }
        }

        if (types.includes('entity')) {
            const eRows: any = await sql`SELECT id, canonical_name, entity_type, summary, updated_at
                FROM entities
                WHERE workspace_id = ${workspaceId}
                  AND canonical_name ILIKE ${'%' + query + '%'}
                LIMIT ${limit}`;
            for (const r of eRows) {
                results.push({
                    type: 'entity',
                    id: r.id,
                    title: r.canonical_name,
                    snippet: r.summary || r.entity_type || '',
                    updated_at: r.updated_at,
                    score: 0.5,
                });
            }
        }

        if (types.includes('tag')) {
            const tagRows: any = await sql`SELECT tag, COUNT(*)::int AS usage_count
                FROM (
                    SELECT jsonb_array_elements_text(coalesce(tags, '[]'::jsonb)) AS tag
                    FROM pages
                    WHERE workspace_id = ${workspaceId}
                      AND deleted_at IS NULL
                ) t
                WHERE tag ILIKE ${'%' + query + '%'}
                GROUP BY tag
                ORDER BY usage_count DESC, tag ASC
                LIMIT ${limit}`;
            for (const r of tagRows) {
                results.push({
                    type: 'tag',
                    id: r.tag,
                    title: `#${r.tag}`,
                    snippet: `${r.usage_count} docs`,
                    updated_at: null,
                    score: 0.6 + Math.min(0.4, Number(r.usage_count || 0) / 100),
                });
            }
        }
    } catch (err: any) {
        if (!err.message?.includes('does not exist')) throw err;
    }

    results.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    return { results: results.slice(0, limit), dbConfigured: true, query };
});
