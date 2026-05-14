import { getDb } from '~/server/utils/neon';
import { getOrCreateDefaultWorkspace, getUserSub, newId } from '~/server/utils/workspace';

interface AskBody {
    question?: string;
    page_id?: string | null;
}

/**
 * Grounded assistant scaffold. Retrieves matching pages via Postgres
 * full-text search and returns them as citations. Once a deployed ADK
 * agent is available, this route will forward the question + retrieved
 * snippets to it.
 */
export default defineEventHandler(async (event) => {
    const sql = getDb();
    const workspaceId = await getOrCreateDefaultWorkspace(event);
    if (!sql || !workspaceId) {
        throw createError({ statusCode: 503, statusMessage: 'Database not configured' });
    }
    const body = await readBody<AskBody>(event);
    const question = (body?.question || '').trim();
    if (!question) {
        throw createError({ statusCode: 400, statusMessage: 'question required' });
    }
    const userSub = await getUserSub(event);

    let citations: any[] = [];
    try {
        const rows: any = await sql`SELECT id, title, emoji, content_markdown,
            ts_rank(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content_markdown,'')),
                    plainto_tsquery('english', ${question})) AS rank
            FROM pages
            WHERE workspace_id = ${workspaceId}
              AND deleted_at IS NULL
              AND to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content_markdown,''))
                  @@ plainto_tsquery('english', ${question})
            ORDER BY rank DESC
            LIMIT 5`;
        citations = rows.map((r: any) => {
            const md: string = r.content_markdown || '';
            const lower = md.toLowerCase();
            const idx = lower.indexOf(question.toLowerCase().split(/\s+/)[0] || '');
            const snippet =
                idx >= 0 ? md.slice(Math.max(0, idx - 80), idx + 200) : md.slice(0, 280);
            return {
                page_id: r.id,
                title: r.title,
                emoji: r.emoji,
                snippet,
            };
        });
    } catch (err: any) {
        if (!err.message?.includes('does not exist')) throw err;
    }

    const answer =
        citations.length === 0
            ? `I could not find any workspace pages matching this question. Once content is imported or written, I will be able to ground answers in your own knowledge.`
            : `Based on ${citations.length} matching page${citations.length === 1 ? '' : 's'} in your workspace, here is what was found. (The grounded generator runs once an ADK agent is deployed; for now the matched citations are shown directly.)`;

    const id = newId('ans');
    await sql`INSERT INTO ai_answers (id, workspace_id, user_sub, question, answer_markdown, citations_jsonb)
        VALUES (${id}, ${workspaceId}, ${userSub}, ${question}, ${answer},
                ${JSON.stringify(citations)}::jsonb)`;

    return { id, answer, citations };
});
